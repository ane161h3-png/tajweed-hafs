"""قراءة ملفات source-data وتحويلها إلى بنية موحّدة.

كل دالة load_* مسؤولة عن ملف واحد. إن تغيّرت بنية ملف في المصدر فعدّل دالته فقط.
"""
from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app.arabic import normalize  # noqa: E402

SOURCE_DIR = ROOT / "source-data"
BISMILLAH_NORM = "بسم الله الرحمن الرحيم"
NO_BISMILLAH_SPLIT = {1, 9}  # الفاتحة: البسملة آية منها، والتوبة: لا بسملة


def read_json(path: Path):
    with open(path, encoding="utf-8-sig") as f:
        return json.load(f)


def pick(d: dict, *keys, default=None):
    for k in keys:
        if k in d and d[k] is not None:
            return d[k]
    return default


@dataclass
class Ayah:
    surah: int
    ayah: int
    text: str
    tajweed: list[dict] = field(default_factory=list)
    has_bismillah: bool = False
    juz: int = 0


def split_bismillah(surah: int, ayah: int, text: str, tajweed: list[dict]) -> tuple[str, list[dict], bool]:
    """يفصل البسملة عن أول آية من السورة ويطرح طولها من مواقع الأحكام.

    يرجع (النص بلا بسملة، الأحكام بعد الإزاحة، هل وُجدت بسملة).
    الأحكام الواقعة كلها داخل البسملة تُحذف، والمتداخلة معها تُقصّ من بدايتها.
    """
    if ayah != 1 or surah in NO_BISMILLAH_SPLIT:
        return text, tajweed, False
    words = text.split(" ")
    if len(words) < 5 or normalize(" ".join(words[:4])) != BISMILLAH_NORM:
        return text, tajweed, False
    cut = len(" ".join(words[:4]))
    while cut < len(text) and text[cut].isspace():
        cut += 1
    shifted = []
    for t in tajweed:
        start, end = t["start"] - cut, t["end"] - cut
        if end <= 0:
            continue
        shifted.append({**t, "start": max(start, 0), "end": end})
    return text[cut:], shifted, True


def _iter_ayah_records(raw):
    """يقبل قائمة آيات مسطّحة، أو {"ayahs": [...]}، أو قائمة سور فيها "ayahs"/"verses"."""
    if isinstance(raw, dict):
        raw = pick(raw, "ayahs", "verses", "surahs", "data", default=[])
    for item in raw:
        nested = pick(item, "ayahs", "verses")
        if isinstance(nested, list):
            s = pick(item, "surah", "number", "id", "sura")
            for i, a in enumerate(nested, start=1):
                yield {"surah": s, "ayah": pick(a, "ayah", "number", "aya", default=i), **a}
        else:
            yield item


def load_quran(path: Path | None = None) -> list[Ayah]:
    raw = read_json(path or SOURCE_DIR / "quran-tajweed-hafs.json")
    ayahs = []
    for rec in _iter_ayah_records(raw):
        tajweed = [
            {"rule": t["rule"], "start": int(t["start"]), "end": int(t["end"])}
            for t in pick(rec, "tajweed", "annotations", default=[])
        ]
        ayahs.append(Ayah(int(pick(rec, "surah", "sura")), int(pick(rec, "ayah", "aya")), rec["text"], tajweed))
    ayahs.sort(key=lambda a: (a.surah, a.ayah))
    return ayahs


def load_surahs(path: Path | None = None) -> list[dict]:
    raw = read_json(path or SOURCE_DIR / "surahs.json")
    if isinstance(raw, dict):
        raw = pick(raw, "surahs", "data", default=list(raw.values()))
    out = []
    for i, s in enumerate(raw, start=1):
        out.append({
            "number": int(pick(s, "number", "id", "index", "surah", default=i)),
            "name": pick(s, "name_ar", "name", "arabic", "nameAr"),
            "name_en": pick(s, "name_en", "transliteration", "english", "nameEn", default=""),
            "ayah_count": int(pick(s, "ayah_count", "ayahs", "verses", "numberOfAyahs", "count")),
            "revelation": pick(s, "type", "revelation", "revelationType", "place", default=""),
        })
    return sorted(out, key=lambda s: s["number"])


def load_pages(path: Path | None = None) -> list[dict]:
    """أول آية في كل صفحة من صفحات المصحف الـ ٦٠٤."""
    raw = read_json(path or SOURCE_DIR / "pages.json")
    out = [{"page": int(p["page"]), "surah": int(p["surah"]), "ayah": int(p["ayah"])} for p in raw]
    out.sort(key=lambda p: p["page"])
    return out


def load_hizb(path: Path | None = None) -> list[dict]:
    """أول آية في كل ربع حزب (٢٤٠ ربعاً)."""
    raw = read_json(path or SOURCE_DIR / "hizb.json")
    out = [{"quarter": int(h["quarter"]), "surah": int(h["surah"]), "ayah": int(h["ayah"])} for h in raw]
    out.sort(key=lambda h: h["quarter"])
    return out


def load_juz_starts(path: Path | None = None) -> list[dict]:
    raw = read_json(path or SOURCE_DIR / "juz-starts.json")
    if isinstance(raw, dict):
        raw = pick(raw, "juz", "juzs", "data", default=raw)
        if isinstance(raw, dict):  # {"1": {...}, "2": {...}}
            raw = [{"juz": int(k), **v} for k, v in raw.items()]
    out = []
    for i, j in enumerate(raw, start=1):
        out.append({
            "juz": int(pick(j, "juz", "number", "id", default=i)),
            "surah": int(pick(j, "surah", "sura")),
            "ayah": int(pick(j, "ayah", "aya", "verse")),
        })
    return sorted(out, key=lambda j: j["juz"])


def load_rules(path: Path | None = None) -> list[dict]:
    raw = read_json(path or SOURCE_DIR / "tajweed-rules.json")
    if isinstance(raw, dict):
        listed = pick(raw, "rules", "data")
        raw = listed if listed is not None else [{"id": k, **v} for k, v in raw.items()]
    return [{
        "id": pick(r, "id", "rule", "key"),
        "name": pick(r, "name_ar", "name", "arabic"),
        "color": pick(r, "color", "colour"),
        "description": pick(r, "description", "desc", default=""),
        "count": int(pick(r, "count", "occurrences", default=0)),
        "raw": r,
    } for r in raw]


def assign_juz(ayahs: list[Ayah], juz_starts: list[dict]) -> None:
    starts = [((j["surah"], j["ayah"]), j["juz"]) for j in juz_starts]
    k = 0
    for a in ayahs:
        while k + 1 < len(starts) and (a.surah, a.ayah) >= starts[k + 1][0]:
            k += 1
        a.juz = starts[k][1]


def prepare_ayahs(ayahs: list[Ayah]) -> tuple[int, str | None]:
    """يفصل البسملة في كل السور.

    يرجع (عدد السور التي فُصلت بسملتها، نص البسملة كما ورد في المصدر لعرضه عنواناً).
    """
    count, bismillah = 0, None
    for a in ayahs:
        original = a.text
        a.text, a.tajweed, a.has_bismillah = split_bismillah(a.surah, a.ayah, a.text, a.tajweed)
        if a.has_bismillah:
            count += 1
            bismillah = bismillah or original[: len(original) - len(a.text)].strip()
    return count, bismillah
