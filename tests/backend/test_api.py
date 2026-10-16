def test_health(client):
    body = client.get("/api/health").json()
    assert body["db"] is True and body["meta"]["ayahs"] == "13"


def test_surahs(client):
    data = client.get("/api/surahs").json()
    assert [s["number"] for s in data] == [1, 2, 9, 112]
    ikhlas = data[-1]
    assert ikhlas["name"] == "الإخلاص" and ikhlas["bismillah"] is True and ikhlas["juz"] == 30


def test_surah(client):
    data = client.get("/api/surah/112").json()
    assert data["surah"]["ayah_count"] == 4
    assert [a["ayah"] for a in data["ayahs"]] == [1, 2, 3, 4]
    assert data["ayahs"][0]["text"].startswith("قُلْ")
    assert data["bismillah_text"] == "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ"
    assert client.get("/api/surah/9").json()["bismillah_text"] is None


def test_surah_not_found(client):
    assert client.get("/api/surah/115").status_code == 404


def test_juz(client):
    data = client.get("/api/juz/10").json()
    assert data["start"] == {"surah": 9, "ayah": 1}
    assert data["surahs"][0]["name"] == "التوبة"
    assert client.get("/api/juz/31").status_code == 404


def test_juz_list(client):
    data = client.get("/api/juz").json()
    assert [j["juz"] for j in data] == [1, 10, 30]
    assert data[0] == {"juz": 1, "surah": 1, "ayah": 1, "surah_name": "الفاتحة"}


def test_rules(client):
    assert {r["id"] for r in client.get("/api/rules").json()} == {"hamzat_wasl", "qalqalah"}


def test_placeholders(client):
    assert client.get("/api/lessons").status_code == 200
    assert client.get("/api/letters").status_code == 200
    level1 = client.get("/api/quiz?level=1").json()["questions"]
    assert all(q["level"] == 1 for q in level1)
    assert client.get("/api/lessons/../x").status_code in (400, 404)


def test_missing_db_returns_503(monkeypatch, tmp_path):
    from fastapi.testclient import TestClient
    from app.main import app
    monkeypatch.setenv("TAJWEED_DB", str(tmp_path / "none.db"))
    r = TestClient(app).get("/api/surahs")
    assert r.status_code == 503 and "build_db" in r.json()["detail"]


def test_rules_first_occurrence(client):
    rules = {r["id"]: r for r in client.get("/api/rules").json()}
    # في بيانات الاختبار: همزة الوصل في الفاتحة، والقلقلة أول ما تقع في الإخلاص بعد فصل البسملة
    assert rules["hamzat_wasl"]["first"] == {"surah": 1, "ayah": 1}
    assert rules["qalqalah"]["first"] == {"surah": 112, "ayah": 1}


def test_rule_surahs(client):
    data = client.get("/api/rules/qalqalah/surahs").json()
    assert data == [{"surah": 112, "name": "الإخلاص", "ayahs": 2, "marks": 2, "first_ayah": 1}]
    assert client.get("/api/rules/nope/surahs").status_code == 404


def test_search_returns_match_span(client):
    r = [x for x in client.get("/api/search", params={"q": "هو الله"}).json()["results"] if x["type"] == "ayah"][0]
    assert r["text"][r["match"][0]:r["match"][1]] == "هُوَ ٱللَّهُ"
