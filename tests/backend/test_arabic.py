import pytest

from app.arabic import normalize, parse_ordinal


@pytest.mark.parametrize("raw, expected", [
    ("البقرة", "البقره"),
    ("البقره", "البقره"),
    ("الإخلاص", "الاخلاص"),
    ("آل عمران", "ال عمران"),
    ("ٱلرَّحْمَٰنِ", "الرحمن"),
    ("هَٰذَا", "هذا"),
    ("إِلَٰهَ", "اله"),
    ("عَلَىٰ", "علي"),
    ("مُوسَىٰ", "موسي"),
    ("ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ", "الله لا اله الا هو"),
    ("٢٥٥", "255"),
    ("  سورة   البقرة ", "سوره البقره"),
])
def test_normalize(raw, expected):
    assert normalize(raw) == expected


@pytest.mark.parametrize("raw, expected", [
    ("ٱلْكِتَٰبُ", "الكتاب"),
    ("ٱلْعَٰلَمِينَ", "العالمين"),
    ("ٱلصَّلَوٰةَ", "الصلاه"),
    ("ٱلزَّكَوٰةَ", "الزكاه"),
    ("ٱلسَّمَٰوَٰتِ", "السماوات"),
    ("إِبْرَٰهِـۧمَ", "ابراهيم"),
    ("عَلَىٰ", "علي"),
    ("أَتَىٰكَ", "اتاك"),
    ("أَنسَىٰنِيهُ", "انسانيه"),
])
def test_normalize_spelled_dagger(raw, expected):
    assert normalize(raw, spell_dagger=True) == expected


def test_normalize_strips_quranic_marks():
    # علامات الوقف الصغيرة لا تؤثر في البحث
    assert normalize("ٱلْقَيُّومُ ۚ لَا") == "القيوم لا"


@pytest.mark.parametrize("word, n", [
    ("الأول", 1), ("الاول", 1), ("العاشر", 10), ("الحادي عشر", 11), ("الثاني عشر", 12),
    ("العشرون", 20), ("الحادي والعشرون", 21), ("التاسع والعشرون", 29), ("الثلاثون", 30),
    ("ثلاثون", 30), ("٣٠", 30), ("7", 7),
])
def test_parse_ordinal(word, n):
    assert parse_ordinal(word) == n


def test_parse_ordinal_unknown():
    assert parse_ordinal("البقرة") is None
