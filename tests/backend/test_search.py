import pytest

from app.search import fts_expressions, parse


@pytest.mark.parametrize("q, surah, ayah", [
    ("2:255", 2, 255), ("٢:٢٥٥", 2, 255), ("2 255", 2, 255), ("112/1", 112, 1), (" 3 : 7 ", 3, 7),
])
def test_parse_reference(q, surah, ayah):
    p = parse(q)
    assert (p.kind, p.surah, p.ayah) == ("ref", surah, ayah)


def test_parse_surah_number():
    p = parse("36")
    assert (p.kind, p.surah) == ("surah_num", 36)


@pytest.mark.parametrize("q, n", [
    ("جزء 30", 30), ("الجزء 1", 1), ("جزء ٣٠", 30), ("الجزء الثلاثون", 30), ("جزء الحادي والعشرون", 21),
    ("الجزء الأول", 1), ("جزء عم", 30), ("جزء تبارك", 29),
])
def test_parse_juz(q, n):
    p = parse(q)
    assert (p.kind, p.juz) == ("juz", n)


@pytest.mark.parametrize("q", ["البقرة 255", "البقره 255", "سورة البقرة 255", "البقرة ٢٥٥"])
def test_parse_name_and_ayah(q):
    p = parse(q)
    assert (p.kind, p.text, p.ayah) == ("name_ayah", "البقره", 255)


@pytest.mark.parametrize("q", ["الله لا اله الا هو", "جزاء", "البقرة"])
def test_parse_text(q):
    assert parse(q).kind == "text"


def test_fts_expressions():
    assert fts_expressions("قل هو") == ['"قل هو"*', '"قل" AND "هو"*']
    assert fts_expressions("ا") == []
    assert fts_expressions('ق"ل') == ['"ق ل"*', '"ق" AND "ل"*']  # لا حقن لعلامات الاستعلام


# ---- على قاعدة بيانات الاختبار ----

def results(client, q):
    r = client.get("/api/search", params={"q": q})
    assert r.status_code == 200
    return r.json()["results"]


@pytest.mark.parametrize("q", ["البقره", "البقرة", "بقره", "سورة البقرة"])
def test_search_surah_name(client, q):
    first = results(client, q)[0]
    assert (first["type"], first["surah"]) == ("surah", 2)


def test_search_surah_name_hamza(client):
    assert results(client, "الاخلاص")[0]["surah"] == 112


def test_search_reference(client):
    r = results(client, "112:3")
    assert [(x["type"], x["surah"], x["ayah"]) for x in r] == [("ayah", 112, 3)]


def test_search_name_ayah(client):
    r = results(client, "الإخلاص 2")
    assert (r[0]["surah"], r[0]["ayah"]) == (112, 2)


def test_search_juz(client):
    r = results(client, "الجزء الثلاثون")  # سورة النبأ ليست في بيانات الاختبار
    assert r[0] == {"type": "juz", "juz": 30, "surah": 78, "ayah": 1, "surah_name": None}


def test_search_text_phrase(client):
    r = [x for x in results(client, "قل هو الله احد") if x["type"] == "ayah"]
    assert (r[0]["surah"], r[0]["ayah"]) == (112, 1)


def test_search_text_while_typing(client):
    r = [(x["surah"], x["ayah"]) for x in results(client, "قل هو الل") if x["type"] == "ayah"]
    assert (112, 1) in r


def test_search_text_imlai_spelling(client):
    # «العالمين» بالإملاء الحديث تجد «ٱلْعَٰلَمِينَ»
    r = [(x["surah"], x["ayah"]) for x in results(client, "رب العالمين") if x["type"] == "ayah"]
    assert r[0] == (1, 2)


def test_search_text_does_not_match_bismillah_prefix(client):
    # البسملة مفصولة عن أول آية؛ «الرحمن الرحيم» تجد 1:1 و1:3 فقط
    r = {(x["surah"], x["ayah"]) for x in results(client, "الرحمن الرحيم") if x["type"] == "ayah"}
    assert r == {(1, 1), (1, 3)}
