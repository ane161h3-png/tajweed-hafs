"""تطبيع النص العربي للبحث.

يُستعمل للبحث فقط؛ النص المعروض يبقى كما هو في المصدر دون أي تعديل.
"""
import re
import unicodedata

# الحركات والتنوين والشدة والسكون وعلامات الهمز المركّبة (064B–065F)،
# وعلامات الضبط والوقف القرآنية (06D6–06ED)، وعلامات التنوين المفتوح (08D3–08FF)، والتطويل.
_MARKS = re.compile("[ً-ٟۖ-ۭ࣓-ࣿـ]")
_DAGGER = "ٰ"  # الألف الخنجرية
_ALEFS = str.maketrans({c: "ا" for c in "أإآٱٲٳٵ"})
_LETTERS = str.maketrans({"ى": "ي", "ة": "ه"})
_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
_NON_WORD = re.compile(r"[^\w\s:]", re.UNICODE)
_SPACES = re.compile(r"\s+")


def to_ascii_digits(s: str) -> str:
    return s.translate(_DIGITS)


def normalize(s: str, *, spell_dagger: bool = False) -> str:
    """يزيل التشكيل ويوحّد الألفات (أ إ آ ٱ ← ا)، والياء (ى ← ي)، والتاء المربوطة (ة ← ه).

    spell_dagger=False: تُحذف الألف الخنجرية (ٱلرَّحْمَٰنِ ← الرحمن، هَٰذَا ← هذا).
    spell_dagger=True: تُكتب ألفاً كالرسم الإملائي (ٱلْكِتَٰبُ ← الكتاب، ٱلصَّلَوٰةَ ← الصلاه)،
    وتُكتب الياء الصغيرة ياءً (إِبْرَٰهِـۧمَ ← ابراهيم).
    يُفهرس النص بالشكلين معاً حتى يجد المستخدم الآية بأي إملاء كتب.
    """
    s = unicodedata.normalize("NFC", s)
    s = to_ascii_digits(s)
    if spell_dagger:
        s = re.sub("[ۦۧ]", "ي", s)
        s = _MARKS.sub("", s)
        s = s.replace("و" + _DAGGER + "ة", "اة")
        # ىٰ في وسط الكلمة ألف (أَتَىٰكَ ← أتاك)، وفي آخرها تبقى ألفاً مقصورة (عَلَىٰ ← على)
        s = re.sub("ى" + _DAGGER + r"(?=\w)", "ا", s)
        s = s.replace("ى" + _DAGGER, "ى").replace(_DAGGER, "ا")
    else:
        s = _MARKS.sub("", s).replace(_DAGGER, "")
    s = s.translate(_ALEFS).translate(_LETTERS)
    s = _NON_WORD.sub(" ", s)
    return _SPACES.sub(" ", s).strip()


# الأعداد الترتيبية للأجزاء بعد التطبيع (ة ← ه، أ ← ا).
_UNITS = ["", "الاول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع"]
_UNITS_COMPOUND = ["", "الحادي", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع"]


def _ordinals() -> dict[str, int]:
    table: dict[str, int] = {}
    for n in range(1, 10):
        table[_UNITS[n]] = n
    table["العاشر"] = 10
    for n in range(1, 10):
        table[f"{_UNITS_COMPOUND[n]} عشر"] = 10 + n
    table["العشرون"] = table["العشرين"] = 20
    for n in range(1, 10):
        table[f"{_UNITS_COMPOUND[n]} والعشرون"] = table[f"{_UNITS_COMPOUND[n]} والعشرين"] = 20 + n
    table["الثلاثون"] = table["الثلاثين"] = 30
    # الصيغ بلا «ال»: «حادي عشر»، «ثلاثون»
    for k, v in list(table.items()):
        if k.startswith("ال"):
            table.setdefault(k[2:], v)
    return table


ORDINALS = _ordinals()

# أسماء الأجزاء المشهورة بأول كلماتها.
JUZ_NICKNAMES = {"عم": 30, "تبارك": 29, "قد سمع": 28}


def parse_ordinal(word: str) -> int | None:
    word = normalize(word)
    if word.isdigit():
        return int(word)
    return ORDINALS.get(word)
