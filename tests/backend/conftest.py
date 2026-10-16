import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "scripts"))

BISM = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ"

# آيات حقيقية من نص تنزيل العثماني لبيانات الاختبار المصغّرة.
FIXTURE_AYAHS = {
    (1, 1): BISM,
    (1, 2): "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ",
    (1, 3): "ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
    (1, 4): "مَٰلِكِ يَوْمِ ٱلدِّينِ",
    (1, 5): "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ",
    (1, 6): "ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ",
    (1, 7): "صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ",
    (2, 1): BISM + " الٓمٓ",
    (9, 1): "بَرَآءَةٌ مِّنَ ٱللَّهِ وَرَسُولِهِۦٓ إِلَى ٱلَّذِينَ عَٰهَدتُّم مِّنَ ٱلْمُشْرِكِينَ",
    (112, 1): BISM + " قُلْ هُوَ ٱللَّهُ أَحَدٌ",
    (112, 2): "ٱللَّهُ ٱلصَّمَدُ",
    (112, 3): "لَمْ يَلِدْ وَلَمْ يُولَدْ",
    (112, 4): "وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ",
}


def span(text: str, sub: str, rule: str, nth: int = 0) -> dict:
    """موقع أول حرف من sub (أو الـ nth) داخل النص، بطول حرف واحد."""
    i = -1
    for _ in range(nth + 1):
        i = text.index(sub, i + 1)
    return {"rule": rule, "start": i, "end": i + 1}


def fixture_tajweed(key, text):
    marks = [span(text, "ٱ", "hamzat_wasl")] if text.startswith(BISM) or key == (1, 1) else []
    if key == (112, 1):
        marks.append(span(text, "ٱ", "hamzat_wasl", nth=3))  # همزة وصل ٱللَّهُ بعد البسملة
        marks.append({"rule": "qalqalah", "start": text.index("أَحَدٌ") + 4, "end": text.index("أَحَدٌ") + 6})
    if key == (112, 3):
        marks.append(span(text, "دْ", "qalqalah"))
    return marks


@pytest.fixture(scope="session")
def fixture_source(tmp_path_factory) -> Path:
    d = tmp_path_factory.mktemp("source-data")
    ayahs = [{"surah": s, "ayah": a, "text": t, "tajweed": fixture_tajweed((s, a), t)}
             for (s, a), t in FIXTURE_AYAHS.items()]
    names = {1: ("الفاتحة", "مكية"), 2: ("البقرة", "مدنية"), 9: ("التوبة", "مدنية"), 112: ("الإخلاص", "مكية")}
    surahs = [{"number": n, "name": nm, "ayahs": sum(1 for (s, _) in FIXTURE_AYAHS if s == n), "type": t}
              for n, (nm, t) in names.items()]
    juz = [{"juz": 1, "surah": 1, "ayah": 1}, {"juz": 10, "surah": 8, "ayah": 41}, {"juz": 30, "surah": 78, "ayah": 1}]
    rules = [{"id": r, "name_ar": r, "color": "#000", "description": "", "count": 0}
             for r in ("hamzat_wasl", "qalqalah")]
    for name, data in [("quran-tajweed-hafs.json", ayahs), ("surahs.json", surahs),
                       ("juz-starts.json", juz), ("tajweed-rules.json", rules), ("reciters.json", [])]:
        (d / name).write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return d


@pytest.fixture(scope="session")
def fixture_db(fixture_source, tmp_path_factory):
    from build_db import build
    out = tmp_path_factory.mktemp("db") / "tajweed.db"
    stats = build(fixture_source, out)
    return out, stats


@pytest.fixture
def client(fixture_db, monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app
    monkeypatch.setenv("TAJWEED_DB", str(fixture_db[0]))
    return TestClient(app)
