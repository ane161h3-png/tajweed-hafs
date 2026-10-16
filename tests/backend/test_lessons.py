import pytest

from app.lessons import find_word


@pytest.fixture
def lessons_client(client, monkeypatch, tmp_path):
    monkeypatch.setenv("TAJWEED_CONTENT", str(tmp_path / "ahkam.json"))
    return client


LESSON = {
    "section": "noon-sakinah",
    "title": "الإظهار الحلقي",
    "lugha": "البيان",
    "istilah": "إخراج كل حرف من مخرجه من غير غنة في الحرف المظهَر",
    "examples": [{"surah": 112, "ayah": 4, "word": "يَكُن", "note": "مثال"}],
    "verses": [{"source": "تحفة الأطفال", "first": "شطر أول", "second": "شطر ثانٍ"}],
}


def test_create_read_update_delete(lessons_client, tmp_path):
    c = lessons_client
    created = c.post("/api/lessons", json=LESSON).json()
    assert created["id"] == "noon-sakinah-1" and created["order"] == 1 and created["status"] == "draft"

    second = c.post("/api/lessons", json={**LESSON, "title": "الإدغام"}).json()
    assert second["id"] == "noon-sakinah-2" and second["order"] == 2

    got = c.get("/api/lessons/noon-sakinah-1").json()
    assert got["lugha"] == "البيان"
    ex = got["examples"][0]
    assert ex["surah_name"] == "الإخلاص"
    assert ex["ayah_text"][ex["match"][0]:ex["match"][1]] == "يَكُن"

    updated = c.put("/api/lessons/noon-sakinah-1", json={**LESSON, "lugha": "الإيضاح والبيان", "status": "reviewed"}).json()
    assert updated["lugha"] == "الإيضاح والبيان" and updated["status"] == "reviewed"
    assert c.get("/api/lessons").json()["lessons"][0]["status"] == "reviewed"

    # نسخة احتياطية قبل كل تعديل
    assert len(list((tmp_path / "backups").glob("ahkam-*.json"))) == 2

    assert c.delete("/api/lessons/noon-sakinah-2").status_code == 204
    assert [x["id"] for x in c.get("/api/lessons").json()["lessons"]] == ["noon-sakinah-1"]
    assert c.delete("/api/lessons/noon-sakinah-2").status_code == 404


def test_validation(lessons_client):
    c = lessons_client
    assert c.post("/api/lessons", json={**LESSON, "title": ""}).status_code == 422
    assert c.post("/api/lessons", json={**LESSON, "section": "../x"}).status_code == 422
    assert c.post("/api/lessons", json={**LESSON, "examples": [{"surah": 115, "ayah": 1}]}).status_code == 422
    assert c.put("/api/lessons/none", json=LESSON).status_code == 404


def test_example_not_found_is_flagged(lessons_client):
    c = lessons_client
    lid = c.post("/api/lessons", json={**LESSON, "examples": [{"surah": 112, "ayah": 4, "word": "كتاب"}]}).json()["id"]
    assert c.get(f"/api/lessons/{lid}").json()["examples"][0]["match"] is None


def test_ayah_words(lessons_client):
    data = lessons_client.get("/api/ayah/112/4").json()
    assert [w["text"] for w in data["words"]] == ["وَلَمْ", "يَكُن", "لَّهُۥ", "كُفُوًا", "أَحَدٌۢ"]
    assert lessons_client.get("/api/ayah/112/9").status_code == 404


TEXT = "وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ"


@pytest.mark.parametrize("word, expected", [
    ("يَكُن", "يَكُن"),          # منسوخة حرفياً
    ("يكن", "يَكُن"),            # بلا تشكيل
    ("يكن له", "يَكُن لَّهُۥ"),    # كلمتان متتاليتان
    ("كفوا", "كُفُوًا"),
    ("لم", "وَلَمْ"),            # جزء من كلمة
])
def test_find_word(word, expected):
    span = find_word(TEXT, word)
    assert TEXT[span[0]:span[1]] == expected


def test_find_word_spelled_dagger():
    text = "ذَٰلِكَ ٱلْكِتَٰبُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى لِّلْمُتَّقِينَ"
    span = find_word(text, "الكتاب")
    assert text[span[0]:span[1]] == "ٱلْكِتَٰبُ"


def test_find_word_joined_words():
    text = "يَٰٓأَيُّهَا ٱلنَّاسُ ٱعْبُدُوا۟ رَبَّكُمُ"
    span = find_word(text, "يا أيها")
    assert text[span[0]:span[1]] == "يَٰٓأَيُّهَا"


def test_find_word_missing():
    assert find_word(TEXT, "الصلاة") is None
    assert find_word(TEXT, "") is None
