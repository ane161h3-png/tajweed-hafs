"""محتوى المخارج والصفات وبنك الأسئلة."""
import json
import sqlite3

import pytest

from conftest import ROOT

CONTENT = ROOT / "data" / "content"
LETTERS = CONTENT / "letters.json"
QUIZ = CONTENT / "quiz.json"
DB = ROOT / "data" / "tajweed.db"


def test_letter_sifat_from_groups():
    import seed_letters
    data = seed_letters.build()
    assert seed_letters.validate(data) == []
    L = {x["char"]: x for x in data["letters"]}
    assert L["ط"]["sifat"] == ["jahr", "shidda", "istila", "itbaq", "ismat"] and "qalqalah" in L["ط"]["extra"]
    assert L["ص"]["sifat"] == ["hams", "rikhwa", "istila", "itbaq", "ismat"] and L["ص"]["extra"] == ["safir"]
    assert L["ع"]["sifat"][1] == "tawassut"
    assert L["ر"]["extra"] == ["inhiraf", "takrir"]
    assert L["ض"]["extra"] == ["istitala"] and L["ش"]["extra"] == ["tafashi"]
    # أقوى الحروف الطاء وأضعفها الهاء
    assert max(data["letters"], key=lambda x: x["score"])["char"] == "ط"
    assert min(data["letters"], key=lambda x: x["score"])["char"] == "ه"


def test_seventeen_makharij_cover_all_letters():
    import seed_letters
    data = seed_letters.build()
    covered = {c for m in data["makharij"] for c in m["letters"]}
    assert {x["char"] for x in data["letters"]} <= covered


@pytest.mark.skipif(not LETTERS.exists(), reason="لا يوجد letters.json")
def test_letters_api(client):
    data = client.get("/api/letters").json()
    assert len(data["letters"]) == 29 and len(data["makharij"]) == 17


@pytest.mark.skipif(not (QUIZ.exists() and DB.exists()), reason="لا يوجد بنك أسئلة")
def test_quiz_bank_is_consistent():
    qs = json.loads(QUIZ.read_text(encoding="utf-8"))["questions"]
    letters = json.loads(LETTERS.read_text(encoding="utf-8"))
    makharij = {m["id"] for m in letters["makharij"]}
    con = sqlite3.connect(DB)
    assert len({q["id"] for q in qs}) == len(qs)
    assert {q["level"] for q in qs} == {1, 2, 3}
    for q in qs:
        if q["type"] in ("mcq", "listen"):
            assert 0 <= q["answer"] < len(q["options"]) and len(set(q["options"])) == len(q["options"]), q["id"]
        elif q["type"] == "spot":
            assert q["answer"] in makharij
        elif q["type"] == "classify":
            assert set(q["answer"].values()) <= {b["id"] for b in q["bins"]}
        elif q["type"] == "extract":
            tj = json.loads(con.execute("SELECT tajweed FROM ayahs WHERE surah=? AND ayah=?", (q["surah"], q["ayah"])).fetchone()[0])
            assert any(m["rule"] == q["rule"] for m in tj), q["id"]


def test_minshawi_and_ayah_tajweed(client):
    assert "tajweed" in client.get("/api/ayah/112/1").json()
