import json
import sqlite3

from conftest import BISM, FIXTURE_AYAHS
from quran_data import split_bismillah


def test_split_bismillah_shifts_offsets():
    text = FIXTURE_AYAHS[(112, 1)]
    after = text[len(BISM) + 1:]
    q = text.index("أَحَدٌ")
    tajweed = [
        {"rule": "hamzat_wasl", "start": 5, "end": 6},          # داخل البسملة → يُحذف
        {"rule": "hamzat_wasl", "start": text.index("ٱللَّهُ"), "end": text.index("ٱللَّهُ") + 1},
        {"rule": "qalqalah", "start": q + 4, "end": q + 6},
    ]
    new_text, new_tajweed, found = split_bismillah(112, 1, text, tajweed)
    assert found
    assert new_text == after == "قُلْ هُوَ ٱللَّهُ أَحَدٌ"
    assert [t["rule"] for t in new_tajweed] == ["hamzat_wasl", "qalqalah"]
    # الحروف المشار إليها هي نفسها قبل الإزاحة وبعدها
    for old, new in zip(tajweed[1:], new_tajweed):
        assert text[old["start"]:old["end"]] == new_text[new["start"]:new["end"]]
    assert new_text[new_tajweed[1]["start"]:new_tajweed[1]["end"]] == "دٌ"


def test_split_bismillah_clips_overlapping_mark():
    text = FIXTURE_AYAHS[(2, 1)]
    cut = len(BISM) + 1
    _, tajweed, _ = split_bismillah(2, 1, text, [{"rule": "x", "start": cut - 3, "end": cut + 2}])
    assert tajweed == [{"rule": "x", "start": 0, "end": 2}]


def test_split_bismillah_exceptions():
    fatiha = FIXTURE_AYAHS[(1, 1)]
    assert split_bismillah(1, 1, fatiha, []) == (fatiha, [], False)       # الفاتحة: البسملة آية
    tawba = FIXTURE_AYAHS[(9, 1)]
    assert split_bismillah(9, 1, tawba, []) == (tawba, [], False)         # التوبة بلا بسملة
    assert split_bismillah(112, 2, "ٱللَّهُ ٱلصَّمَدُ", [])[2] is False   # ليست أول آية


def test_build_fixture(fixture_db):
    path, stats = fixture_db
    assert stats["ayahs"] == len(FIXTURE_AYAHS)
    assert stats["bismillah_split"] == 2  # البقرة والإخلاص
    con = sqlite3.connect(path)
    flags = dict(con.execute("SELECT number, bismillah FROM surahs"))
    assert flags == {1: 0, 2: 1, 9: 0, 112: 1}
    text, tajweed = con.execute("SELECT text, tajweed FROM ayahs WHERE surah=112 AND ayah=1").fetchone()
    assert text == "قُلْ هُوَ ٱللَّهُ أَحَدٌ"
    marks = json.loads(tajweed)
    assert [text[m["start"]:m["end"]] for m in marks] == ["ٱ", "دٌ"]
    juz = dict(con.execute("SELECT surah * 1000 + ayah, juz FROM ayahs"))
    assert juz[1001] == 1 and juz[9001] == 10 and juz[112001] == 30


def test_build_keeps_source_text(fixture_db):
    """نص القرآن لا يُعدّل: النص المخزّن + البسملة = نص المصدر حرفاً بحرف."""
    con = sqlite3.connect(fixture_db[0])
    for surah, ayah, text, bism in con.execute(
            "SELECT a.surah, a.ayah, a.text, s.bismillah FROM ayahs a JOIN surahs s ON s.number=a.surah"):
        original = FIXTURE_AYAHS[(surah, ayah)]
        assert (BISM + " " + text if bism and ayah == 1 else text) == original
