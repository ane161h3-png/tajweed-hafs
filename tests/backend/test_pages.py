"""صفحات المصحف (٦٠٤): تغطي كل آيات القرآن مرة واحدة بالترتيب، بلا فجوات ولا تكرار."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_pages_list_is_complete_and_ordered():
    pages = client.get("/api/pages").json()
    assert [p["page"] for p in pages] == list(range(1, 605))
    keys = [(p["surah"], p["ayah"]) for p in pages]
    assert keys == sorted(keys)
    assert pages[0] == {"page": 1, "surah": 1, "ayah": 1, "surah_name": "الفاتحة"}
    assert (pages[1]["surah"], pages[1]["ayah"]) == (2, 1)
    assert (pages[603]["surah"], pages[603]["ayah"]) == (112, 1)


def test_every_ayah_is_on_exactly_one_page_in_order():
    seen = []
    for n in range(1, 605):
        d = client.get(f"/api/page/{n}").json()
        assert d["page"] == n and d["ayahs"]
        assert (d["start"]["surah"], d["start"]["ayah"]) == (d["ayahs"][0]["surah"], d["ayahs"][0]["ayah"])
        seen += [(a["surah"], a["ayah"]) for a in d["ayahs"]]
    assert len(seen) == 6236
    assert seen == sorted(seen) and len(set(seen)) == 6236


def test_known_pages():
    p1 = client.get("/api/page/1").json()
    assert p1["end"] == {"surah": 1, "ayah": 7}
    last = client.get("/api/page/604").json()
    assert [s["number"] for s in last["surahs"]] == [112, 113, 114]
    assert last["end"] == {"surah": 114, "ayah": 6}


def test_out_of_range():
    assert client.get("/api/page/0").status_code == 404
    assert client.get("/api/page/605").status_code == 404


def test_hizb_quarters_align_with_juz():
    hizb = client.get("/api/hizb").json()
    assert [h["quarter"] for h in hizb] == list(range(1, 241))
    keys = [(h["surah"], h["ayah"]) for h in hizb]
    assert keys == sorted(keys)
    juz = client.get("/api/juz").json()
    # كل جزء ثمانية أرباع: بداية كل جزء هي بداية الربع (٨ن+١)
    for j in juz:
        q = hizb[(j["juz"] - 1) * 8]
        assert (q["surah"], q["ayah"]) == (j["surah"], j["ayah"]), j["juz"]
