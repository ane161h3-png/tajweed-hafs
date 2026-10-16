"""البحث الذكي: يفهم اسم السورة، ورقمها، وسورة:آية، والجزء، ونص الآية."""
from __future__ import annotations

import re
import sqlite3
from dataclasses import dataclass

from .arabic import JUZ_NICKNAMES, normalize, parse_ordinal, to_ascii_digits
from .matching import find_word

_REF = re.compile(r"(\d{1,3})\s*[:：/.\-]\s*(\d{1,3})|(\d{1,3})\s+(\d{1,3})")
_JUZ = re.compile(r"(?:ال)?جزء?\s*(.*)")
_NAME_AYAH = re.compile(r"(.+?)\s+(\d{1,3})")


@dataclass
class Query:
    kind: str  # ref | surah_num | juz | name_ayah | text
    text: str = ""
    surah: int | None = None
    ayah: int | None = None
    juz: int | None = None


def parse(q: str) -> Query:
    raw = to_ascii_digits(q).strip()
    qn = normalize(raw)
    if m := _REF.fullmatch(raw):
        s, a = (m.group(1), m.group(2)) if m.group(1) else (m.group(3), m.group(4))
        return Query("ref", qn, surah=int(s), ayah=int(a))
    if raw.isdigit():
        return Query("surah_num", qn, surah=int(raw))
    if m := _JUZ.fullmatch(qn):
        rest = m.group(1).strip()
        n = parse_ordinal(rest) if rest else None
        n = n or JUZ_NICKNAMES.get(rest)
        if n:
            return Query("juz", qn, juz=n)
    if m := _NAME_AYAH.fullmatch(qn):
        return Query("name_ayah", strip_surah_word(m.group(1)), ayah=int(m.group(2)))
    return Query("text", qn)


def strip_surah_word(name: str) -> str:
    return re.sub(r"^سوره\s+", "", name).strip()


def _bare(name: str) -> str:
    return name[2:] if name.startswith("ال") and len(name) > 3 else name


def match_surahs(con: sqlite3.Connection, name: str, limit: int = 5) -> list[sqlite3.Row]:
    name = strip_surah_word(normalize(name))
    if not name:
        return []
    scored = []
    for row in con.execute("SELECT number, name, name_norm, ayah_count, revelation FROM surahs"):
        candidates = (row["name_norm"], _bare(row["name_norm"]))
        if name in candidates:
            score = 0
        elif any(c.startswith(name) or c.startswith(_bare(name)) for c in candidates):
            score = 1
        elif any(name in c or _bare(name) in c for c in candidates) and len(name) >= 3:
            score = 2
        else:
            continue
        scored.append((score, row["number"], row))
    return [r for _, _, r in sorted(scored)[:limit]]


def _surah_result(row) -> dict:
    return {"type": "surah", "surah": row["number"], "name": row["name"],
            "ayah_count": row["ayah_count"], "revelation": row["revelation"]}


def _ayah_rows(con, where: str, params) -> list[dict]:
    rows = con.execute(
        f"SELECT a.surah, a.ayah, a.juz, a.text, s.name AS surah_name FROM ayahs a "
        f"JOIN surahs s ON s.number = a.surah WHERE {where}", params).fetchall()
    return [{"type": "ayah", **dict(r)} for r in rows]


def fts_expressions(text: str) -> list[str]:
    """تعبير العبارة المتصلة أولاً، ثم كل الكلمات بأي ترتيب. الكلمة الأخيرة بادئة (أثناء الكتابة)."""
    tokens = [t for t in re.sub(r"[^\w\s]", " ", text).split() if t]
    if not tokens or len("".join(tokens)) < 2:
        return []
    phrase = '"' + " ".join(tokens) + '"*'
    exprs = [phrase]
    if len(tokens) > 1:
        exprs.append(" AND ".join(f'"{t}"' for t in tokens[:-1]) + f' AND "{tokens[-1]}"*')
    return exprs


def search_text(con, text: str, limit: int) -> tuple[list[dict], int]:
    seen: set[int] = set()
    results: list[dict] = []
    total = 0
    for expr in fts_expressions(text):
        ids = [r[0] for r in con.execute(
            "SELECT rowid FROM ayah_fts WHERE ayah_fts MATCH ? ORDER BY rank, rowid", (expr,))]
        total = max(total, len(ids))
        new = [i for i in ids if i not in seen][: max(0, limit - len(results))]
        seen.update(new)
        if new:
            by_id = {r["id"]: r for r in _ayah_rows_by_ids(con, new)}
            results.extend(by_id[i] for i in new)
        if len(results) >= limit:
            break
    return results, max(total, len(seen))


def _ayah_rows_by_ids(con, ids: list[int]) -> list[dict]:
    marks = ",".join("?" * len(ids))
    rows = con.execute(
        f"SELECT a.id, a.surah, a.ayah, a.juz, a.text, s.name AS surah_name FROM ayahs a "
        f"JOIN surahs s ON s.number = a.surah WHERE a.id IN ({marks})", ids).fetchall()
    return [{"type": "ayah", **dict(r)} for r in rows]


def search(con: sqlite3.Connection, q: str, limit: int = 20) -> dict:
    parsed = parse(q)
    results: list[dict] = []
    total_text = 0

    if parsed.kind == "ref":
        results += _ayah_rows(con, "a.surah = ? AND a.ayah = ?", (parsed.surah, parsed.ayah))
    elif parsed.kind == "surah_num":
        row = con.execute("SELECT number, name, ayah_count, revelation FROM surahs WHERE number = ?",
                          (parsed.surah,)).fetchone()
        if row:
            results.append(_surah_result(row))
    elif parsed.kind == "juz":
        row = con.execute("SELECT number, surah, ayah FROM juz WHERE number = ?", (parsed.juz,)).fetchone()
        if row:
            name = con.execute("SELECT name FROM surahs WHERE number = ?", (row["surah"],)).fetchone()
            results.append({"type": "juz", "juz": row["number"], "surah": row["surah"],
                            "ayah": row["ayah"], "surah_name": name[0] if name else None})
    elif parsed.kind == "name_ayah":
        for s in match_surahs(con, parsed.text, limit=3):
            results += _ayah_rows(con, "a.surah = ? AND a.ayah = ?", (s["number"], parsed.ayah))
    if parsed.kind in ("text", "name_ayah") and not results:
        results += [_surah_result(r) for r in match_surahs(con, parsed.text)]
        found, total_text = search_text(con, parsed.text, max(0, limit - len(results)))
        results += found

    for r in results:
        r.pop("id", None)
        if r["type"] == "ayah" and parsed.kind == "text":
            span = find_word(r["text"], parsed.text)  # لتظليل النص المطابق في النتيجة
            r["match"] = list(span) if span else None
    return {"query": q, "kind": parsed.kind, "results": results[:limit], "total_text": total_text}
