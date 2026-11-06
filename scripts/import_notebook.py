"""يدمج محتوى دفتر الطالب (notebook_seed.py) في data/content/ahkam.json.

التشغيل:  python scripts/import_notebook.py [--check]

- الدروس التي في الدفتر: يحلّ نص الدفتر محلّ نصها، وتُضاف أمثلته وأمثلة إضافية إلى أمثلتها القديمة
  (بلا تكرار)، وتبقى الأبيات وروابط أحكام المصحف. تُوسم source="notebook".
- الدروس الجديدة من الدفتر تُضاف بالوسم نفسه.
- الدروس التي لم ترد في الدفتر تبقى كما هي وتُوسم source="app" («ليس في الدفتر»).
- كل مثال يُطابَق مع نص آيته ويُخزَّن كما رُسم في المصحف؛ يتوقف السكربت إن لم يجد مثالاً.
- يحفظ نسخة احتياطية قبل الكتابة (data/content/backups).
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys

from quran_data import ROOT, normalize  # يضيف backend إلى المسار
from app.lessons import CONTENT_DIR, LessonIn, _save  # noqa: E402
from seed_ahkam import DB, resolve  # noqa: E402
from notebook_seed import NEW, NOT_IN_NOTEBOOK, UPDATES  # noqa: E402

TEXT_FIELDS = ("title", "lugha", "istilah", "letters", "method", "exceptions", "notes", "table")


def _key(ex: dict) -> tuple:
    return ex["surah"], ex["ayah"], normalize(ex["word"], spell_dagger=True)


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--check", action="store_true", help="تحقق فقط دون كتابة")
    args = p.parse_args(argv)
    if not DB.exists():
        print("ابنِ قاعدة البيانات أولاً: python scripts/build_db.py", file=sys.stderr)
        return 1
    con = sqlite3.connect(DB)
    path = CONTENT_DIR / "ahkam.json"
    store = json.loads(path.read_text(encoding="utf-8"))
    by_id = {x["id"]: x for x in store["lessons"]}

    unknown = (set(UPDATES) | NOT_IN_NOTEBOOK) - set(by_id)
    if unknown:
        print("معرّفات غير موجودة في ahkam.json:", *sorted(unknown), file=sys.stderr)
        return 2

    missing: list[str] = []

    def resolve_all(examples: list[dict], title: str) -> list[dict]:
        out = []
        for ex in examples:
            row = con.execute("SELECT text FROM ayahs WHERE surah=? AND ayah=?", (ex["surah"], ex["ayah"])).fetchone()
            found, _ = resolve(row[0], ex["word"]) if row else (None, False)
            if not found:
                missing.append(f"{ex['surah']}:{ex['ayah']} «{ex['word']}» ({title})")
                continue
            out.append({**ex, "word": found})
        return out

    def merge_examples(first: list[dict], rest: list[dict]) -> list[dict]:
        seen, out = set(), []
        for ex in first + rest:
            k = _key(ex)
            if k not in seen:
                seen.add(k)
                out.append(ex)
        return out

    lessons = []
    for lesson in store["lessons"]:
        lesson = dict(lesson)
        upd = UPDATES.get(lesson["id"])
        if upd:
            for f in TEXT_FIELDS:
                if f in upd:
                    lesson[f] = upd[f]
            added = resolve_all(upd.get("add_ex", []), lesson["title"])
            lesson["examples"] = merge_examples(added, lesson.get("examples", []))
            lesson["source"] = "notebook"
        elif lesson["id"] in NOT_IN_NOTEBOOK:
            lesson["source"] = "app"
        else:
            lesson.setdefault("source", "app")
        lessons.append(lesson)

    ids = {x["id"] for x in lessons}
    for raw in NEW:
        n = 1
        while f"{raw['section']}-{n}" in ids:
            n += 1
        lesson_id = f"{raw['section']}-{n}"
        ids.add(lesson_id)
        lesson = {
            "id": lesson_id, "section": raw["section"], "title": raw["title"], "order": raw["order"],
            "status": "draft", "lugha": raw.get("lugha", ""), "istilah": raw.get("istilah", ""),
            "letters": raw.get("letters", ""), "method": raw.get("method", ""),
            "examples": merge_examples(resolve_all(raw.get("ex", []), raw["title"]), []),
            "exceptions": raw.get("exceptions", ""), "notes": raw.get("notes", ""),
            "verses": raw.get("verses", []), "table": raw.get("table"), "rules": raw.get("rules", []),
            "source": "notebook", "updated_at": "",
        }
        lessons.append(lesson)

    for lesson in lessons:
        LessonIn(**{k: v for k, v in lesson.items() if k not in ("id", "updated_at")})

    notebook = sum(1 for x in lessons if x["source"] == "notebook")
    print(f"الدروس: {len(lessons)} (من الدفتر {notebook}، ليست في الدفتر {len(lessons) - notebook})، "
          f"الأمثلة: {sum(len(x['examples']) for x in lessons)}")
    if missing:
        print("أمثلة لم تُوجد في آياتها:", *missing, sep="\n  ", file=sys.stderr)
        return 3
    if args.check:
        return 0
    _save({**store, "lessons": lessons})
    print(f"كُتب {path}")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    raise SystemExit(main())
