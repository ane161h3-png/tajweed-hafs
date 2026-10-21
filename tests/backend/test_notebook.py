"""دفتر التجويد (PDF): يحوي كل الدروس والأمثلة والحروف، ونص القرآن فيه كما هو في البيانات."""
import html
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import build_notebook as nb  # noqa: E402

DATA = ROOT / "frontend" / "public" / "data"


def page():
    return nb.build_html()


def test_all_lessons_and_titles():
    p = page()
    lessons = json.loads((DATA / "lessons.json").read_text(encoding="utf-8"))["lessons"]
    assert len(lessons) == 42
    for x in lessons:
        assert html.escape(x["title"], quote=False) in p, x["id"]


def test_every_example_verse_is_verbatim():
    p = page()
    lessons = json.loads((DATA / "lessons.json").read_text(encoding="utf-8"))["lessons"]
    count = 0
    for x in lessons:
        for e in json.loads((DATA / "lessons" / f"{x['id']}.json").read_text(encoding="utf-8"))["examples"]:
            text, m = e["ayah_text"], e["match"]
            # النص قبل الكلمة المظلّلة وبعدها ونفس الكلمة، متتالية دون تغيير حرف
            assert f"{html.escape(text[:m[0]], quote=False)}<mark>{html.escape(text[m[0]:m[1]], quote=False)}</mark>{html.escape(text[m[1]:], quote=False)}" in p
            count += 1
    assert count == 192


def test_letters_matrix_and_cards():
    p = page()
    letters = json.loads((DATA / "letters.json").read_text(encoding="utf-8"))["letters"]
    assert len(letters) == 29
    assert p.count("class='lcard'") >= 29
    assert p.count("<td class='c'>") == 29


def test_three_parts_and_ruled_notes():
    p = page()
    for w in ("الباب الأول", "الباب الثاني", "الباب الثالث"):
        assert w in p
    assert p.count("class='notes'") == 3
    assert "data:font/woff2;base64" in p
