"""يكتب مسودة دروس الأحكام (ahkam_seed.py) في data/content/ahkam.json.

التشغيل:  python scripts/seed_ahkam.py [--check] [--force]

- يبحث عن كلمة كل مثال داخل آيتها ويخزّنها كما رُسمت في المصحف. إن لم يجدها يتوقف ويذكر المثال.
- لا يكتب فوق ملف موجود (فيه تعديلاتك) إلا مع --force، وحينئذ يحفظ نسخة احتياطية أولاً.
- --check: يتحقق من الأمثلة فقط دون كتابة.
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys

from quran_data import ROOT, normalize  # يضيف backend إلى المسار
from app.lessons import CONTENT_DIR, LessonIn, _save, find_word, tokens  # noqa: E402
from ahkam_seed import LESSONS  # noqa: E402

DB = ROOT / "data" / "tajweed.db"
_LOOSE = re.compile("[ءؤئا]")


def loose(s: str) -> str:
    return _LOOSE.sub("", normalize(s, spell_dagger=True))


def resolve(text: str, word: str) -> tuple[str | None, bool]:
    """يرجع (الكلمة كما في المصحف، هل احتجنا للمطابقة المرنة)."""
    span = find_word(text, word)
    if span:
        return text[span[0]:span[1]], False
    # مطابقة مرنة تتجاهل صور الهمز والألف (مثل «سيئت» ← «سِيٓـَٔتْ»)
    target = [loose(w) for w in word.split()]
    toks = tokens(text)
    keys = [loose(t["text"]) for t in toks]
    n = len(target)
    for i in range(len(toks) - n + 1):
        if keys[i:i + n] == target:
            return text[toks[i]["start"]:toks[i + n - 1]["end"]], True
    for i, k in enumerate(keys):
        if n == 1 and target[0] and target[0] in k:
            return toks[i]["text"], True
    return None, False


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--check", action="store_true")
    p.add_argument("--force", action="store_true")
    args = p.parse_args(argv)
    if not DB.exists():
        print("ابنِ قاعدة البيانات أولاً: python scripts/build_db.py", file=sys.stderr)
        return 1
    con = sqlite3.connect(DB)
    missing, fuzzy, out = [], [], []
    order: dict[str, int] = {}
    for n, raw in enumerate(LESSONS, start=1):
        lesson = json.loads(json.dumps(raw))
        for ex in lesson["examples"]:
            row = con.execute("SELECT text FROM ayahs WHERE surah=? AND ayah=?", (ex["surah"], ex["ayah"])).fetchone()
            found, was_loose = resolve(row[0], ex["word"]) if row else (None, False)
            ref = f"{ex['surah']}:{ex['ayah']} «{ex['word']}» ({lesson['title']})"
            if not found:
                missing.append(ref)
                continue
            if was_loose:
                fuzzy.append(f"{ref} ← {found}")
            ex["word"] = found
        order[lesson["section"]] = order.get(lesson["section"], 0) + 1
        lesson["order"] = order[lesson["section"]]
        LessonIn(**lesson)  # تحقق من البنية
        out.append({"id": f"{lesson['section']}-{lesson['order']}", **lesson, "status": "draft", "updated_at": ""})

    print(f"الدروس: {len(out)}، الأمثلة: {sum(len(x['examples']) for x in out)}")
    if fuzzy:
        print("مطابقة مرنة (راجعها):", *fuzzy, sep="\n  ")
    if missing:
        print("أمثلة لم تُوجد:", *missing, sep="\n  ", file=sys.stderr)
        return 2
    if args.check:
        return 0
    path = CONTENT_DIR / "ahkam.json"
    if path.exists() and not args.force:
        print(f"{path} موجود وفيه تعديلاتك؛ لم يُكتب شيء. استعمل --force للاستبدال (مع نسخة احتياطية).")
        return 0
    _save({"version": 1, "riwaya": "حفص عن عاصم من طريق الشاطبية", "lessons": out})
    print(f"كُتب {path}")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    raise SystemExit(main())
