"""يولّد بنك الأسئلة data/content/quiz.json من محتوى الدروس والحروف وبيانات المصحف.

التشغيل:  python scripts/build_quiz.py

أنواع الأسئلة:
  mcq       اختيار من متعدد          tf        صح أو خطأ
  spot      حدّد المخرج على الرسم     classify  صنّف الحروف حسب صفة (سحب وإفلات)
  extract   اضغط كلمة فيها الحكم (يُصحَّح من مواضع الأحكام في المصحف)
  listen    استمع إلى الآية وحدّد حكم الكلمة
المستويات: ١ أساسيات الحروف والصفات، ٢ الأحكام من الأمثلة والمخارج على الرسم والتصنيف، ٣ الاستخراج والاستماع.
"""
from __future__ import annotations

import json
import random
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "data" / "content"
DB = ROOT / "data" / "tajweed.db"

rng = random.Random(1446)  # ثابت: البنك نفسه في كل بناء


def options(correct: str, pool: list[str], n: int = 4) -> tuple[list[str], int]:
    others = [p for p in dict.fromkeys(pool) if p != correct]
    picked = rng.sample(others, min(n - 1, len(others))) + [correct]
    rng.shuffle(picked)
    return picked, picked.index(correct)


def letter_questions(L: dict) -> list[dict]:
    qs = []
    letters = [x for x in L["letters"] if x["id"] != "alif"]
    makharij = {m["id"]: m for m in L["makharij"]}
    names = [m["name"] for m in L["makharij"]]
    sifat = {i["id"]: i for g in L["opposite"] for i in g["items"]} | {s["id"]: s for s in L["non_opposite"]}

    for x in letters:
        m = makharij[x["makhraj"]]
        opts, ans = options(m["name"], names)
        qs.append({"id": f"makhraj-{x['id']}", "level": 1, "type": "mcq", "topic": "المخارج",
                   "question": f"ما مخرج حرف {x['name']} ({x['char']})؟", "options": opts, "answer": ans,
                   "explain": m["desc"], "link": f"/makharij/letters/{x['id']}"})
        # صح أو خطأ في صفة
        s_id = rng.choice(x["sifat"] + x["extra"])
        truth = rng.random() < 0.5
        if not truth:
            group = next((g for g in L["opposite"] if any(i["id"] == s_id for i in g["items"])), None)
            if group:
                s_id = rng.choice([i["id"] for i in group["items"] if i["id"] != s_id])
            else:
                truth = True
        has = s_id in x["sifat"] or s_id in x["extra"]
        all_names = "، ".join(sifat[s]["name"] for s in x["sifat"] + x["extra"])
        qs.append({"id": f"tf-{x['id']}-{s_id}", "level": 1, "type": "tf", "topic": "الصفات",
                   "question": f"من صفات حرف {x['name']} ({x['char']}): {sifat[s_id]['name']}.", "answer": has,
                   "explain": f"صفات {x['name']}: {all_names}.", "link": "/sifat/cards"})
        # حدّد المخرج على الرسم
        qs.append({"id": f"spot-{x['id']}", "level": 2, "type": "spot", "topic": "المخارج",
                   "question": f"اضغط على الرسم موضع مخرج حرف {x['name']} ({x['char']}).", "letter": x["id"],
                   "answer": x["makhraj"], "explain": f"مخرجه: {m['name']}. {m['desc']}",
                   "link": f"/makharij/letters/{x['id']}"})

    # أي الحروف التالية فيه الصفة؟
    for s in [*L["non_opposite"], *[i for g in L["opposite"] for i in g["items"] if i["letters"]]]:
        chars = s["letters"]
        inside = [x for x in letters if x["char"] in chars]
        outside = [x for x in letters if x["char"] not in chars]
        if not inside or len(outside) < 3:
            continue
        right = rng.choice(inside)
        opts = rng.sample(outside, 3) + [right]
        rng.shuffle(opts)
        qs.append({"id": f"which-{s['id']}", "level": 1, "type": "mcq", "topic": "الصفات",
                   "question": f"أيّ هذه الحروف من حروف {s['name']}؟", "options": [o["char"] for o in opts],
                   "answer": opts.index(right), "big_options": True,
                   "explain": f"حروف {s['name']}: {' '.join(chars)}.", "link": "/sifat/matrix"})

    # الأقوى من بين أربعة حروف
    for i in range(10):
        four = rng.sample(letters, 4)
        if len({x["score"] for x in four}) < 4:
            continue
        best = max(four, key=lambda x: x["score"])
        qs.append({"id": f"strong-{i}", "level": 3, "type": "mcq", "topic": "قوة الحروف",
                   "question": "أيّ هذه الحروف أقوى بصفاته؟", "options": [x["char"] for x in four],
                   "answer": four.index(best), "big_options": True,
                   "explain": f"أقواها {best['name']} ({best['level']})، لكثرة صفاته القوية.", "link": "/sifat/strength"})

    # التصنيف: لكل زوج متضاد ستة حروف
    for g in L["opposite"]:
        bins = [{"id": i["id"], "name": i["name"]} for i in g["items"]]
        for k in range(2):
            picked = rng.sample(letters, 6)
            answer = {x["id"]: next(s for s in x["sifat"] if s in {b["id"] for b in bins}) for x in picked}
            qs.append({"id": f"classify-{g['id']}-{k}", "level": 2, "type": "classify", "topic": "الصفات",
                       "question": f"صنّف الحروف حسب {g['name']}: اسحب كل حرف إلى صفته.",
                       "bins": bins, "letters": [{"id": x["id"], "char": x["char"]} for x in picked],
                       "answer": answer, "explain": " · ".join(
                           f"{b['name']}: {' '.join(x['char'] for x in picked if answer[x['id']] == b['id']) or '—'}" for b in bins),
                       "link": "/sifat/opposite"})
    return qs


def lesson_questions(lessons: list[dict], con) -> list[dict]:
    qs = []
    ruled = [x for x in lessons if len(x.get("rules", [])) == 1]  # دروس التمهيد (عدة أحكام) ليست إجابة لـ«ما الحكم؟»
    titles = [x["title"] for x in ruled]
    for x in ruled:
        same = [y["title"] for y in ruled if y["section"] == x["section"]]
        pool = same if len(same) >= 4 else same + titles
        for j, ex in enumerate(x["examples"][:4]):
            text = con.execute("SELECT text FROM ayahs WHERE surah=? AND ayah=?", (ex["surah"], ex["ayah"])).fetchone()[0]
            name = con.execute("SELECT name FROM surahs WHERE number=?", (ex["surah"],)).fetchone()[0]
            opts, ans = options(x["title"], pool)
            explain = f"{ex['note']}. {x['istilah']}".strip(". ") if ex.get("note") else x["istilah"]
            base = {"topic": "الأحكام", "options": opts, "answer": ans, "explain": explain,
                    "surah": ex["surah"], "ayah": ex["ayah"], "word": ex["word"], "surah_name": name,
                    "link": f"/ahkam/{x['section']}/{x['id']}"}
            qs.append({**base, "id": f"rule-{x['id']}-{j}", "level": 2, "type": "mcq",
                       "question": f"ما الحكم في «{ex['word']}»؟", "ayah_text": text})
            qs.append({**base, "id": f"listen-{x['id']}-{j}", "level": 3, "type": "listen",
                       "question": f"استمع إلى الآية، ثم حدّد الحكم في «{ex['word']}»."})
    return qs


def extract_questions(con, rules: dict[str, str]) -> list[dict]:
    qs = []
    for rule, name in rules.items():
        rows = con.execute(
            "SELECT a.surah, a.ayah FROM rule_ayahs r JOIN ayahs a ON a.surah=r.surah AND a.ayah=r.ayah "
            "WHERE r.rule=? AND length(a.text) BETWEEN 25 AND 90 ORDER BY a.id", (rule,)).fetchall()
        for k, (s, a) in enumerate(rng.sample(rows, min(3, len(rows)))):
            qs.append({"id": f"extract-{rule}-{k}", "level": 3, "type": "extract", "topic": "الأحكام",
                       "question": f"اضغط على كلمة فيها حكم «{name}».", "surah": s, "ayah": a, "rule": rule,
                       "explain": f"المواضع الملوّنة هي مواضع {name} في الآية.", "link": "/mushaf/surah/" + str(s) + f"?rule={rule}&ayah={a}"})
    return qs


def main() -> int:
    L = json.loads((CONTENT / "letters.json").read_text(encoding="utf-8"))
    lessons = json.loads((CONTENT / "ahkam.json").read_text(encoding="utf-8"))["lessons"]
    con = sqlite3.connect(DB)
    rules = dict(con.execute("SELECT id, name FROM rules WHERE id NOT IN ('silent')"))
    qs = letter_questions(L) + lesson_questions(lessons, con) + extract_questions(con, rules)
    ids = [q["id"] for q in qs]
    assert len(ids) == len(set(ids)), "معرّفات مكررة"
    out = {"version": 1, "status": "draft", "questions": qs}
    (CONTENT / "quiz.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    by = {}
    for q in qs:
        by[(q["level"], q["type"])] = by.get((q["level"], q["type"]), 0) + 1
    print(f"{len(qs)} سؤالاً:", ", ".join(f"م{lv} {t}={n}" for (lv, t), n in sorted(by.items())))
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
