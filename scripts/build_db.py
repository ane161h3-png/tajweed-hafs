"""يبني قاعدة البيانات data/tajweed.db من ملفات source-data.

التشغيل:  python scripts/build_db.py  [--source DIR] [--out FILE]
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

from quran_data import (
    ROOT, SOURCE_DIR, assign_juz, load_juz_starts, load_quran, load_rules, load_surahs,
    normalize, prepare_ayahs,
)

SCHEMA = """
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE surahs (
    number INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    name_norm TEXT NOT NULL,
    name_en TEXT,
    ayah_count INTEGER NOT NULL,
    revelation TEXT,
    bismillah INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE ayahs (
    id INTEGER PRIMARY KEY,          -- الترتيب في المصحف 1..6236
    surah INTEGER NOT NULL REFERENCES surahs(number),
    ayah INTEGER NOT NULL,
    juz INTEGER NOT NULL,
    text TEXT NOT NULL,              -- نص المصدر كما هو (بلا البسملة في أول السورة)
    tajweed TEXT NOT NULL,           -- JSON: [{rule, start, end}] بعد طرح طول البسملة
    UNIQUE (surah, ayah)
);
CREATE INDEX ayahs_juz ON ayahs(juz);
CREATE TABLE juz (number INTEGER PRIMARY KEY, surah INTEGER NOT NULL, ayah INTEGER NOT NULL);
CREATE TABLE rules (
    id TEXT PRIMARY KEY, name TEXT, color TEXT, description TEXT, count INTEGER, raw TEXT
);
-- text_a: التشكيل محذوف والألف الخنجرية محذوفة. text_b: الخنجرية مكتوبة ألفاً.
-- مواضع كل حكم: لكل آية فيها الحكم عدد مواضعه (لزر «اعرض مواضع هذا الحكم» والتنقل بين السور)
CREATE TABLE rule_ayahs (rule TEXT NOT NULL, surah INTEGER NOT NULL, ayah INTEGER NOT NULL, marks INTEGER NOT NULL);
CREATE INDEX rule_ayahs_rule ON rule_ayahs(rule, surah, ayah);
CREATE VIRTUAL TABLE ayah_fts USING fts5(text_a, text_b, tokenize = 'unicode61 remove_diacritics 0');
"""


def build(source: Path, out: Path) -> dict:
    surahs = load_surahs(source / "surahs.json")
    ayahs = load_quran(source / "quran-tajweed-hafs.json")
    juz_starts = load_juz_starts(source / "juz-starts.json")
    rules = load_rules(source / "tajweed-rules.json")

    split, bismillah = prepare_ayahs(ayahs)
    assign_juz(ayahs, juz_starts)
    problems = validate(surahs, ayahs, rules)

    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".tmp")
    tmp.unlink(missing_ok=True)
    con = sqlite3.connect(tmp)
    con.executescript(SCHEMA)
    bism = {a.surah for a in ayahs if a.has_bismillah}
    con.executemany(
        "INSERT INTO surahs VALUES (?,?,?,?,?,?,?)",
        [(s["number"], s["name"], normalize(s["name"]), s["name_en"], s["ayah_count"], s["revelation"],
          int(s["number"] in bism)) for s in surahs],
    )
    con.executemany(
        "INSERT INTO ayahs VALUES (?,?,?,?,?,?)",
        [(i, a.surah, a.ayah, a.juz, a.text, json.dumps(a.tajweed, ensure_ascii=False))
         for i, a in enumerate(ayahs, start=1)],
    )
    con.executemany(
        "INSERT INTO ayah_fts(rowid, text_a, text_b) VALUES (?,?,?)",
        [(i, normalize(a.text), normalize(a.text, spell_dagger=True)) for i, a in enumerate(ayahs, start=1)],
    )
    counts = {}
    for a in ayahs:
        for t in a.tajweed:
            counts[(t["rule"], a.surah, a.ayah)] = counts.get((t["rule"], a.surah, a.ayah), 0) + 1
    con.executemany("INSERT INTO rule_ayahs VALUES (?,?,?,?)", [(*k, v) for k, v in counts.items()])
    con.executemany("INSERT INTO juz VALUES (?,?,?)", [(j["juz"], j["surah"], j["ayah"]) for j in juz_starts])
    con.executemany(
        "INSERT INTO rules VALUES (?,?,?,?,?,?)",
        [(r["id"], r["name"], r["color"], r["description"], r["count"], json.dumps(r["raw"], ensure_ascii=False))
         for r in rules],
    )
    stats = {
        "surahs": len(surahs), "ayahs": len(ayahs), "juz": len(juz_starts), "rules": len(rules),
        "bismillah_split": split, "tajweed_marks": sum(len(a.tajweed) for a in ayahs),
        "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    con.executemany("INSERT INTO meta VALUES (?,?)", [(k, str(v)) for k, v in stats.items()])
    if bismillah:
        con.execute("INSERT INTO meta VALUES ('bismillah_text', ?)", (bismillah,))
    con.execute("INSERT INTO ayah_fts(ayah_fts) VALUES ('optimize')")
    con.commit()
    con.execute("VACUUM")
    con.close()
    tmp.replace(out)
    return {**stats, "problems": problems}


def validate(surahs: list[dict], ayahs, rules: list[dict]) -> list[str]:
    problems = []
    if len(surahs) != 114:
        problems.append(f"عدد السور {len(surahs)} والمتوقع 114")
    if len(ayahs) != 6236:
        problems.append(f"عدد الآيات {len(ayahs)} والمتوقع 6236")
    per_surah: dict[int, int] = {}
    for a in ayahs:
        per_surah[a.surah] = per_surah.get(a.surah, 0) + 1
    for s in surahs:
        if per_surah.get(s["number"]) != s["ayah_count"]:
            problems.append(f"سورة {s['number']}: {per_surah.get(s['number'])} آية والمتوقع {s['ayah_count']}")
    rule_ids = {r["id"] for r in rules}
    for a in ayahs:
        for t in a.tajweed:
            if not (0 <= t["start"] < t["end"] <= len(a.text)):
                problems.append(f"{a.surah}:{a.ayah} موقع خارج النص {t}")
            if t["rule"] not in rule_ids:
                problems.append(f"{a.surah}:{a.ayah} حكم غير معروف {t['rule']}")
    return problems


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source", type=Path, default=SOURCE_DIR)
    p.add_argument("--out", type=Path, default=ROOT / "data" / "tajweed.db")
    args = p.parse_args(argv)
    missing = [n for n in ("quran-tajweed-hafs.json", "surahs.json", "juz-starts.json", "tajweed-rules.json")
               if not (args.source / n).exists()]
    if missing:
        print(f"ملفات ناقصة في {args.source}: {', '.join(missing)}", file=sys.stderr)
        return 1
    stats = build(args.source, args.out)
    problems = stats.pop("problems")
    for k, v in stats.items():
        print(f"{k}: {v}")
    if problems:
        print(f"\nتنبيهات ({len(problems)}):", *problems[:30], sep="\n  ", file=sys.stderr)
        return 2
    print(f"\nتم بناء {args.out}")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    raise SystemExit(main())
