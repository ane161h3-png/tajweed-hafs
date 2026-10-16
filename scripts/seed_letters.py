"""يكتب محتوى المخارج والصفات (letters_seed.py) في data/content/letters.json.

التشغيل:  python scripts/seed_letters.py [--force]

صفات كل حرف تُحسب من مجموعات الحروف، وقوة الحرف من عدد صفاته القوية والضعيفة.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import letters_seed as S

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "content" / "letters.json"

STRENGTH_LEVELS = [  # (أدنى مجموع، الاسم)
    (4, "أقوى"), (2, "قوي"), (0, "متوسط"), (-3, "ضعيف"), (-99, "أضعف"),
]


def letter_sifat(char: str) -> tuple[list[str], list[str]]:
    opposite = []
    for group in S.OPPOSITE:
        chosen = next((i for i in group["items"] if i["letters"] and char in i["letters"]), None)
        chosen = chosen or next(i for i in group["items"] if i["letters"] is None)
        opposite.append(chosen["id"])
    non = [s["id"] for s in S.NON_OPPOSITE if char in s["letters"]]
    return opposite, non


def build() -> dict:
    strength = {i["id"]: i["strength"] for g in S.OPPOSITE for i in g["items"]}
    strength |= {s["id"]: s["strength"] for s in S.NON_OPPOSITE}
    letters = []
    for lid, char, name, makhraj, laqab in S.LETTERS:
        opposite, non = letter_sifat(char)
        if lid == "alif":
            non = [x for x in non if x != "leen"]  # الألف لا تكون إلا مدية
        all_sifat = opposite + non
        score = sum({"strong": 1, "weak": -1}.get(strength[x], 0) for x in all_sifat)
        level = next(n for lo, n in STRENGTH_LEVELS if score >= lo)
        letters.append({
            "id": lid, "char": char, "name": name, "makhraj": makhraj, "madd_makhraj": S.MADD_MAKHRAJ.get(lid),
            "laqab": laqab, "sifat": opposite, "extra": non, "score": score, "level": level,
            "pronounce": "ا" if lid == "alif" else f"أَ{char}ْ",
            "mistakes": S.MISTAKES.get(lid, ""),
        })
    by_char = {x["char"]: x["id"] for x in letters}
    makharij = [{**m, "order": i, "letter_ids": [by_char[c] for c in m["letters"]]} for i, m in enumerate(S.SPECIFIC, 1)]
    return {
        "version": 1,
        "status": "draft",
        "note": "مسودة على ما في المقدمة الجزرية؛ يراجعها مقرئ متخصص قبل الاعتماد.",
        "general": S.GENERAL,
        "makharij": makharij,
        "makharij_verses": [{"source": s, "first": f, "second": t} for s, f, t in S.MAKHARIJ_VERSES],
        "opposite": S.OPPOSITE,
        "non_opposite": S.NON_OPPOSITE,
        "sifat_verses": [{"source": s, "first": f, "second": t} for s, f, t in S.SIFAT_VERSES],
        "strength_levels": [n for _, n in STRENGTH_LEVELS],
        "letters": letters,
        "alqab": S.ALQAB,
        "teeth": S.TEETH,
        "comparisons": S.COMPARISONS,
    }


def validate(data: dict) -> list[str]:
    problems = []
    if len(data["letters"]) != 29:
        problems.append(f"عدد الحروف {len(data['letters'])} والمتوقع 29 (28 حرفاً والألف)")
    if len(data["makharij"]) != 17:
        problems.append(f"عدد المخارج {len(data['makharij'])} والمتوقع 17")
    ids = {m["id"] for m in data["makharij"]}
    for x in data["letters"]:
        if x["makhraj"] not in ids:
            problems.append(f"{x['name']}: مخرج غير معروف {x['makhraj']}")
        if len(x["sifat"]) != 5:
            problems.append(f"{x['name']}: يجب خمس صفات متضادة")
    return problems


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--force", action="store_true")
    args = p.parse_args(argv)
    data = build()
    problems = validate(data)
    if problems:
        print("مشكلات:", *problems, sep="\n  ", file=sys.stderr)
        return 2
    if OUT.exists() and not args.force:
        print(f"{OUT} موجود؛ استعمل --force للاستبدال.")
        return 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"كُتب {OUT}: {len(data['letters'])} حرفاً، {len(data['makharij'])} مخرجاً")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    raise SystemExit(main())
