"""اختبارات على بيانات source-data الحقيقية. تُتجاوز إن لم تكن الملفات موجودة."""
import sqlite3

import pytest

from conftest import ROOT

SOURCE = ROOT / "source-data"
pytestmark = pytest.mark.skipif(
    not (SOURCE / "quran-tajweed-hafs.json").exists(), reason="ملفات source-data غير موجودة")


@pytest.fixture(scope="module")
def real_db(tmp_path_factory):
    from build_db import build
    out = tmp_path_factory.mktemp("real") / "tajweed.db"
    stats = build(SOURCE, out)
    return out, stats


@pytest.fixture
def real_client(real_db, monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app
    monkeypatch.setenv("TAJWEED_DB", str(real_db[0]))
    return TestClient(app)


def test_counts(real_db):
    _, stats = real_db
    assert stats["ayahs"] == 6236
    assert stats["surahs"] == 114
    assert stats["juz"] == 30


def test_no_problems(real_db):
    assert real_db[1]["problems"] == []


def test_bismillah_split_in_112_surahs(real_db):
    assert real_db[1]["bismillah_split"] == 112
    con = sqlite3.connect(real_db[0])
    no_bism = [n for (n,) in con.execute("SELECT number FROM surahs WHERE bismillah = 0")]
    assert no_bism == [1, 9]


def test_all_offsets_inside_text(real_db):
    import json
    con = sqlite3.connect(real_db[0])
    for text, tajweed in con.execute("SELECT text, tajweed FROM ayahs"):
        for t in json.loads(tajweed):
            assert 0 <= t["start"] < t["end"] <= len(text)


def _first_letter(seg: str) -> str:
    marks = lambda c: 0x064B <= ord(c) <= 0x065F or 0x06D6 <= ord(c) <= 0x06ED or c == "ٰ"  # noqa: E731
    return next((c for c in seg if not marks(c)), "")


@pytest.mark.parametrize("rule, letters", [
    ("hamzat_wasl", {"ٱ"}),
    ("lam_shamsiyyah", {"ل"}),
    ("qalqalah", set("قطبجد")),
    ("ikhfa_shafawi", {"م"}),
    ("idghaam_shafawi", {"م"}),
    ("ghunnah", {"ن", "م"}),
])
def test_offsets_hit_the_right_letters(real_db, rule, letters):
    """بعد فصل البسملة يجب أن تبقى المواضع على حروفها نفسها."""
    import json
    con = sqlite3.connect(real_db[0])
    found = set()
    for text, tajweed in con.execute("SELECT text, tajweed FROM ayahs"):
        found |= {_first_letter(text[t["start"]:t["end"]]) for t in json.loads(tajweed) if t["rule"] == rule}
    assert found == letters


@pytest.mark.parametrize("q, surah, ayah", [
    ("الله لا اله الا هو الحي القيوم", 2, 255),
    ("2:255", 2, 255),
    ("البقرة 255", 2, 255),
])
def test_search_real(real_client, q, surah, ayah):
    results = real_client.get("/api/search", params={"q": q}).json()["results"]
    assert any(r["type"] == "ayah" and (r["surah"], r["ayah"]) == (surah, ayah) for r in results)


def test_search_real_surah_name(real_client):
    assert real_client.get("/api/search", params={"q": "البقره"}).json()["results"][0]["surah"] == 2


def test_search_real_juz(real_client):
    r = real_client.get("/api/search", params={"q": "جزء 30"}).json()["results"][0]
    assert (r["juz"], r["surah"], r["ayah"]) == (30, 78, 1)


CONTENT = ROOT / "data" / "content" / "ahkam.json"


@pytest.mark.skipif(not CONTENT.exists(), reason="لا يوجد ملف دروس")
def test_every_lesson_example_is_found_in_its_ayah(real_db):
    """كل مثال في الدروس يجب أن تكون كلمته موجودة في آيته (يكشف الأخطاء بعد التعديل من البرنامج أيضاً)."""
    import json
    from app.lessons import find_word
    con = sqlite3.connect(real_db[0])
    bad = []
    for lesson in json.loads(CONTENT.read_text(encoding="utf-8"))["lessons"]:
        for ex in lesson["examples"]:
            row = con.execute("SELECT text FROM ayahs WHERE surah=? AND ayah=?", (ex["surah"], ex["ayah"])).fetchone()
            if not row or not find_word(row[0], ex["word"]):
                bad.append(f"{lesson['id']}: {ex['surah']}:{ex['ayah']} {ex['word']}")
    assert bad == []
