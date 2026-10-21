"""يبني «دفتر التجويد» (PDF) من بيانات البرنامج: أحكام، ثم مخارج، ثم صفات.

يُنتج HTML بخطوط مضمَّنة ثم يطبعه Chrome بلا واجهة إلى PDF:
  python scripts/build_notebook.py --out frontend/dist/notebook.pdf
  python scripts/build_notebook.py --html-only --out notebook.html     (للمعاينة)
نص القرآن يُنقل كما هو من بيانات البرنامج دون أي تعديل.
"""
import argparse
import base64
import html
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "frontend" / "public" / "data"
FONTS = ROOT / "frontend" / "node_modules" / "@fontsource"

AR = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")
num = lambda n: str(n).translate(AR)
esc = lambda s: html.escape(str(s or ""), quote=False)

SECTIONS = [
    ("noon-sakinah", "أحكام النون الساكنة والتنوين"),
    ("meem-sakinah", "أحكام الميم الساكنة"),
    ("ghunnah", "النون والميم المشددتان ومراتب الغنة"),
    ("idgham", "الإدغام العام"),
    ("mudood", "المدود"),
    ("qalqalah", "القلقلة"),
    ("lamat", "اللامات"),
    ("tafkheem", "التفخيم والترقيق"),
    ("ra", "أحكام الراء"),
    ("hamzah", "همزة الوصل والقطع"),
    ("ha-kinayah", "هاء الكناية"),
    ("waqf", "الوقف والابتداء"),
    ("sakt", "السكت"),
    ("hafs-special", "المواضع الخاصة برواية حفص"),
]
SIFA_NAMES = {}  # id → اسم الصفة، يُملأ من letters.json


def load(rel):
    return json.loads((DATA / rel).read_text(encoding="utf-8"))


def font_face(family, weight, path):
    b64 = base64.b64encode(Path(path).read_bytes()).decode()
    return f"@font-face{{font-family:'{family}';font-weight:{weight};src:url(data:font/woff2;base64,{b64}) format('woff2')}}"


CSS = """
@page { size: A4; margin: 20mm 16mm 20mm 16mm; background: #fffdf6;
  @bottom-center { content: counter(page, arabic-indic); font: 10pt 'Plex'; color: #7a8a86 } }
@page :first { margin: 0; background: #14574a; @bottom-center { content: none } }
@page part { @top-center { content: string(part); font: 9.5pt 'Plex'; color: #1f6f5c; border-bottom: .6pt solid #cfd9d3; padding-bottom: 2mm; width: 100% } }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact }
html { font-family: 'Plex', sans-serif; color: #1d2a2c; font-size: 11.5pt; line-height: 1.85 }
body { margin: 0; direction: rtl }
.q { font-family: 'Quran', serif; line-height: 2.4 }
h1,h2,h3,h4 { font-weight: 700; margin: 0; break-after: avoid }

/* الغلاف */
.cover { page: first; height: 297mm; width: 210mm; position: relative; padding: 14mm; background: #14574a; color: #f7f1dc; break-after: page; overflow: hidden }
.cover .frame { position: absolute; inset: 9mm; border: 1.2pt solid #d9b45f; border-radius: 3mm }
.cover .frame2 { position: absolute; inset: 12mm; border: .5pt solid #d9b45f99; border-radius: 2mm }
.cover .inner { position: relative; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 7mm; padding: 0 16mm }
.cover .bism { font-family: 'Quran'; font-size: 22pt; color: #e9cf8b }
.cover h1 { font-size: 40pt; line-height: 1.4; color: #fff8e3 }
.cover .sub { font-size: 15pt; color: #e9dcb4 }
.cover .orn { width: 60mm; height: 1.2pt; background: linear-gradient(90deg, transparent, #d9b45f, transparent) }
.cover .parts { display: flex; gap: 6mm; font-size: 13pt; color: #f4e7b8 }
.cover .parts span { border: .8pt solid #d9b45f; border-radius: 6mm; padding: 1mm 6mm }
.cover .who { margin-top: 12mm; width: 100%; font-size: 13pt; text-align: right; color: #f0e4bd }
.cover .who div { border-bottom: .8pt dotted #d9b45fb0; padding: 2mm 0; margin-top: 3mm }
.cover .foot { position: absolute; bottom: 20mm; left: 0; right: 0; text-align: center; font-size: 10pt; color: #cbbf94 }

/* الفهرس والمقدمة */
.toc { break-after: page }
.toc h2 { font-size: 22pt; color: #14574a; margin-bottom: 6mm; text-align: center }
.toc .part { margin-top: 5mm; font-size: 14pt; color: #14574a; border-bottom: .8pt solid #d9b45f; padding-bottom: 1mm }
.toc ul { list-style: none; padding: 0; margin: 2mm 0 0; columns: 2; column-gap: 10mm }
.toc li { font-size: 11pt; padding: .6mm 0 }
.note { background: #f4efdc; border-right: 3pt solid #d9b45f; padding: 3mm 4mm; border-radius: 1.5mm; font-size: 10pt; margin-top: 8mm; color: #4a4636 }

/* غلاف الباب */
.partcover { string-set: part attr(data-part); page: part; break-before: page; break-after: page; height: 235mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 6mm }
.partcover .no { font-size: 22pt; color: #b8922f; line-height: 1; font-weight: 700; letter-spacing: .5mm }
.partcover h2 { font-size: 34pt; color: #14574a }
.partcover p { max-width: 120mm; color: #5d6b67; font-size: 12pt }
.partcover .orn { width: 50mm; height: 1.2pt; background: linear-gradient(90deg, transparent, #d9b45f, transparent) }
.partbody { page: part }

/* الدروس */
.chapter { break-before: page; margin-bottom: 6mm }
.chapter h2 { font-size: 20pt; color: #14574a; border-bottom: 1.5pt solid #d9b45f; padding-bottom: 2mm }
.lesson { margin-top: 7mm; break-inside: auto }
.lesson h3 { font-size: 15pt; color: #14574a; background: #e9f2ee; border-radius: 1.5mm; padding: 1.5mm 4mm; border-right: 3pt solid #1f6f5c }
.def { margin: 3mm 0 0; display: grid; grid-template-columns: 22mm 1fr; gap: 1mm 4mm; break-inside: avoid }
.def dt { font-weight: 700; color: #9b2f2f; font-size: 11pt }
.def dd { margin: 0 }
.ex { margin-top: 3mm }
.ex h4 { font-size: 11.5pt; color: #9b2f2f; margin-bottom: 1.5mm }
.ex ol { margin: 0; padding: 0; list-style: none }
.ex li { border-top: .5pt dashed #cfd9d3; padding: 1.5mm 0; break-inside: avoid }
.ex .t { font-family: 'Quran'; font-size: 16pt; line-height: 2.3 }
.ex mark { background: #fbe0dc; color: #a12a1d; border-radius: 1mm; padding: 0 1mm }
.ex .m { font-size: 9.5pt; color: #6b7a75 }
.verses { margin-top: 3mm; padding: 2mm 4mm; background: #f4efdc; border-radius: 1.5mm; break-inside: avoid }
.verses .src { font-size: 9.5pt; color: #7a6a3a; font-weight: 700 }
.bayt { display: flex; justify-content: space-between; gap: 10mm; font-family: 'Quran'; font-size: 15pt; line-height: 2.1; text-align: center }
.bayt span { flex: 1 }
.caveat { margin-top: 3mm; background: #fdf3e3; border-right: 3pt solid #d98a2b; padding: 2mm 4mm; font-size: 10.5pt; break-inside: avoid }
table { width: 100%; border-collapse: collapse; margin-top: 3mm; font-size: 10.5pt; break-inside: avoid }
th { background: #1f6f5c; color: #fff; font-weight: 700; padding: 1.5mm 2mm; text-align: center }
td { border: .5pt solid #cfd9d3; padding: 1.3mm 2mm; text-align: center }
tr:nth-child(even) td { background: #f6f9f7 }
caption { font-weight: 700; color: #14574a; text-align: right; padding-bottom: 1mm; caption-side: top }

/* المخارج والصفات */
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm }
.card { border: .7pt solid #cfd9d3; border-radius: 2mm; padding: 2.5mm 4mm; break-inside: avoid; background: #fff }
.card h4 { font-size: 12.5pt; color: #14574a }
.card .l { font-family: 'Quran'; font-size: 20pt; color: #a12a1d; letter-spacing: 2mm; line-height: 1.6 }
.card p { margin: 0; font-size: 10.5pt }
.tag { display: inline-block; font-size: 9pt; border-radius: 3mm; padding: 0 2.5mm; background: #e9f2ee; color: #14574a }
.lcard { border: .7pt solid #cfd9d3; border-radius: 2mm; padding: 2.5mm 4mm; margin-top: 3mm; break-inside: avoid; display: grid; grid-template-columns: 24mm 1fr; gap: 4mm; background: #fff }
.lcard .big { font-family: 'Quran'; font-size: 46pt; color: #a12a1d; text-align: center; line-height: 1.5; border-left: .7pt solid #e5ebe7 }
.lcard h4 { font-size: 13pt; color: #14574a; display: flex; gap: 3mm; align-items: baseline }
.lcard p { margin: 0; font-size: 10.5pt }
.lcard .k { color: #9b2f2f; font-weight: 700 }
.matrix { font-size: 9pt }
.matrix th, .matrix td { padding: 0 .8mm; line-height: 1.25 }
.matrix td { height: 6.4mm }
.matrix .c { line-height: 1.1 }
.matrix .c { font-family: 'Quran'; font-size: 14pt; color: #a12a1d }
.dot { color: #1f6f5c; font-weight: 700 }
.sifa { margin-top: 3mm; break-inside: avoid }
.sifa h4 { font-size: 12.5pt; color: #14574a }

/* صفحات الملاحظات المسطّرة */
.notes { break-before: page; height: 235mm; page: part }
.notes h3 { font-size: 16pt; color: #14574a; margin-bottom: 4mm }
.notes .ruled { border-right: 1.2pt solid #e8a3a8; padding-right: 3mm }
.notes .ruled i { display: block; height: 9mm; border-bottom: .6pt solid #cdd9e3 }
.end { break-before: page; page: first; height: 297mm; width: 210mm; position: relative }
"""


def example_html(e):
    t = e.get("ayah_text") or ""
    m = e.get("match")
    if m and 0 <= m[0] < m[1] <= len(t):
        body = f"{esc(t[:m[0]])}<mark>{esc(t[m[0]:m[1]])}</mark>{esc(t[m[1]:])}"
    else:
        body = esc(t)
    note = f" — {esc(e.get('note'))}" if e.get("note") else ""
    ref = f"سورة {esc(e.get('surah_name'))}، الآية {num(e['ayah'])}"
    return f"<li><div class='t'>{body}</div><div class='m'>{ref}{note}</div></li>"


def verses_html(vs):
    if not vs:
        return ""
    rows = "".join(f"<div class='bayt'><span>{esc(v['first'])}</span><span>{esc(v['second'])}</span></div>" for v in vs)
    return f"<div class='verses'><div class='src'>{esc(vs[0].get('source') or 'نظم')}</div>{rows}</div>"


def table_html(t):
    if not t:
        return ""
    head = "".join(f"<th>{esc(h)}</th>" for h in t["headers"])
    rows = "".join("<tr>" + "".join(f"<td>{esc(c)}</td>" for c in r) + "</tr>" for r in t["rows"])
    cap = f"<caption>{esc(t.get('caption'))}</caption>" if t.get("caption") else ""
    return f"<table>{cap}<tr>{head}</tr>{rows}</table>"


def lesson_html(l):
    d = []
    if l.get("lugha"):
        d.append(("لغةً", l["lugha"]))
    if l.get("istilah"):
        d.append(("اصطلاحاً", l["istilah"]))
    if l.get("letters"):
        d.append(("حروفه", l["letters"]))
    if l.get("method"):
        d.append(("طريقة أدائه", l["method"]))
    out = [f"<section class='lesson'><h3>{esc(l['title'])}</h3>"]
    if d:
        out.append("<dl class='def'>" + "".join(f"<dt>{k}</dt><dd>{esc(v)}</dd>" for k, v in d) + "</dl>")
    out.append(table_html(l.get("table")))
    if l.get("exceptions"):
        out.append(f"<div class='caveat'><b>تنبيه:</b> {esc(l['exceptions'])}</div>")
    if l.get("notes"):
        out.append(f"<div class='caveat'><b>ملاحظة:</b> {esc(l['notes'])}</div>")
    if l.get("examples"):
        out.append("<div class='ex'><h4>أمثلة من القرآن الكريم</h4><ol>" + "".join(example_html(e) for e in l["examples"]) + "</ol></div>")
    out.append(verses_html(l.get("verses")))
    out.append("</section>")
    return "".join(out)


PART_WORDS = {1: "الباب الأول", 2: "الباب الثاني", 3: "الباب الثالث"}


def part_cover(n, title, blurb):
    return (
        f"<section class='partcover' data-part='{esc(title)}'><div class='no'>{PART_WORDS[n]}</div><div class='orn'></div>"
        f"<h2>{esc(title)}</h2><p>{esc(blurb)}</p><div class='orn'></div></section>"
    )


def notes_page(title="ملاحظاتي"):
    return f"<section class='notes'><h3>{esc(title)}</h3><div class='ruled'>{'<i></i>' * 22}</div></section>"


def build_ahkam():
    idx = load("lessons.json")["lessons"]
    by = {}
    for x in sorted(idx, key=lambda x: (x["section"], x.get("order", 0))):
        by.setdefault(x["section"], []).append(load(f"lessons/{x['id']}.json"))
    out = [part_cover(1, "الأحكام", "أحكام التجويد برواية حفص عن عاصم من طريق الشاطبية: التعريف لغةً واصطلاحاً، وطريقة الأداء، وأمثلة من القرآن الكريم.")]
    toc = []
    for sid, title in SECTIONS:
        lessons = by.get(sid, [])
        if not lessons:
            continue
        toc.append(title)
        out.append(f"<div class='partbody'><section class='chapter'><h2>{esc(title)}</h2>" + "".join(lesson_html(l) for l in lessons) + "</section></div>")
    out.append(notes_page("ملاحظاتي على الأحكام"))
    return "".join(out), toc


def sifat_for(letter, names):
    return "، ".join(names[s] for s in letter["sifat"] + letter["extra"] if s in names)


def build_makharij(c):
    out = [part_cover(2, "المخارج", "مخارج الحروف العربية: الجوف والحلق واللسان والشفتان والخيشوم، ومخرج كل حرف وألقابه وأخطاؤه الشائعة.")]
    body = ["<div class='partbody'><section class='chapter'><h2>المخارج العامة الخمسة</h2>"]
    body.append("<div class='grid2' style='margin-top:4mm'>")
    for g in c["general"]:
        body.append(f"<div class='card'><h4>{esc(g['name'])} <span class='tag'>{num(g['count'])} مخرج</span></h4><p>{esc(g['desc'])}</p></div>")
    body.append("</div>")
    body.append(verses_html(c["makharij_verses"]))
    body.append("</section>")
    body.append("<section class='chapter'><h2>المخارج الخاصة السبعة عشر</h2>")
    letters = {l["id"]: l for l in c["letters"]}
    gname = {g["id"]: g["name"] for g in c["general"]}
    for m in sorted(c["makharij"], key=lambda m: m["order"]):
        ls = "  ".join(letters[i]["char"] for i in m["letter_ids"] if i in letters) or esc(m["letters"])
        body.append(
            f"<div class='lcard' style='grid-template-columns:34mm 1fr'><div class='big' style='font-size:26pt;line-height:1.7'>{esc(ls)}</div>"
            f"<div><h4>{num(m['order'])}. {esc(m['name'])} <span class='tag'>{esc(gname.get(m['general'], ''))}</span></h4><p>{esc(m['desc'])}</p></div></div>"
        )
    body.append("</section>")
    body.append("<section class='chapter'><h2>الحروف واحداً واحداً</h2>")
    mk = {m["id"]: m for m in c["makharij"]}
    for l in c["letters"]:
        m = mk.get(l["makhraj"])
        parts = [f"<h4>{esc(l['name'])} <span class='tag'>{esc(l['laqab'])}</span> <span class='tag'>{esc(l['level'])}</span></h4>"]
        if m:
            parts.append(f"<p><span class='k'>المخرج:</span> {esc(m['name'])}</p>")
        if l.get("pronounce"):
            parts.append(f"<p><span class='k'>للنطق به:</span> <span class='q' style='font-size:14pt'>{esc(l['pronounce'])}</span></p>")
        if l.get("mistakes"):
            parts.append(f"<p><span class='k'>الأخطاء الشائعة:</span> {esc(l['mistakes'])}</p>")
        body.append(f"<div class='lcard'><div class='big'>{esc(l['char'])}</div><div>{''.join(parts)}</div></div>")
    body.append("</section>")
    body.append("<section class='chapter'><h2>ألقاب الحروف وأسماء الأسنان</h2><table><tr><th>اللقب</th><th>حروفه</th><th>سبب التسمية</th></tr>")
    for a in c["alqab"]:
        body.append(f"<tr><td>{esc(a['name'])}</td><td class='q' style='font-size:16pt'>{esc('  '.join(a['letters']))}</td><td style='text-align:right'>{esc(a['why'])}</td></tr>")
    body.append("</table><table><caption>أسماء الأسنان</caption><tr><th>السن</th><th>عددها</th><th>وصفها</th></tr>")
    for t in c["teeth"]:
        body.append(f"<tr><td>{esc(t['name'])}</td><td>{num(t['count'])}</td><td style='text-align:right'>{esc(t['desc'])}</td></tr>")
    body.append("</table></section></div>")
    out.append("".join(body))
    out.append(notes_page("ملاحظاتي على المخارج"))
    return "".join(out)


def build_sifat(c):
    names = {}
    for g in c["opposite"]:
        for it in g["items"]:
            names[it["id"]] = it["name"]
    for it in c["non_opposite"]:
        names[it["id"]] = it["name"]
    out = [part_cover(3, "الصفات", "صفات الحروف: المتضادة وغير المتضادة، وبطاقة لكل حرف، وقوة الحروف، والفرق بين الحروف المتشابهة.")]
    body = ["<div class='partbody'><section class='chapter'><h2>الصفات المتضادة</h2>"]
    for g in c["opposite"]:
        body.append(f"<div class='sifa'><h3 style='font-size:14pt;color:#9b2f2f'>{esc(g['name'])}</h3>")
        for it in g["items"]:
            lt = f"<span class='q' style='font-size:16pt;color:#a12a1d'>{esc('  '.join(it['letters']))}</span>" if it.get("letters") else "<span class='tag'>باقي الحروف</span>"
            code = f" <span class='q' style='font-size:13pt'>{esc(it['code'])}</span>" if it.get("code") else ""
            body.append(
                f"<div class='card' style='margin-top:2mm'><h4>{esc(it['name'])} {lt}{code}</h4>"
                f"<p><span class='k' style='color:#9b2f2f;font-weight:700'>لغةً:</span> {esc(it['lugha'])} <span style='color:#9b2f2f;font-weight:700'>اصطلاحاً:</span> {esc(it['istilah'])}</p></div>"
            )
        body.append("</div>")
    body.append("</section><section class='chapter'><h2>الصفات غير المتضادة</h2>")
    for it in c["non_opposite"]:
        lt = f"<span class='q' style='font-size:16pt;color:#a12a1d'>{esc('  '.join(it['letters']))}</span>" if it.get("letters") else ""
        body.append(
            f"<div class='card' style='margin-top:2.5mm'><h4>{esc(it['name'])} {lt}</h4>"
            f"<p><span style='color:#9b2f2f;font-weight:700'>لغةً:</span> {esc(it['lugha'])} <span style='color:#9b2f2f;font-weight:700'>اصطلاحاً:</span> {esc(it['istilah'])}</p></div>"
        )
    body.append(verses_html(c["sifat_verses"]))
    body.append("</section><section class='chapter'><h2>جدول صفات الحروف</h2>")
    cols = ["jahr", "hams", "shidda", "tawassut", "rikhwa", "istila", "istifal", "itbaq", "infitah", "idhlaq", "ismat"]
    cols = [x for x in cols if x in names]
    head = "".join(f"<th>{esc(names[x])}</th>" for x in cols)
    body.append(f"<table class='matrix'><tr><th>الحرف</th>{head}<th>صفات أخرى</th></tr>")
    for l in c["letters"]:
        have = set(l["sifat"])
        cells = "".join(f"<td class='dot'>{'●' if x in have else ''}</td>" for x in cols)
        extra = "، ".join(names[s] for s in l["extra"] if s in names)
        body.append(f"<tr><td class='c'>{esc(l['char'])}</td>{cells}<td style='font-size:9pt'>{esc(extra)}</td></tr>")
    body.append("</table></section>")
    ln = {l["id"]: l for l in c["letters"]}
    body.append("<section class='chapter'><h2>الفرق بين الحروف المتشابهة</h2>")
    for cmp_ in c["comparisons"]:
        chars = "  ".join(ln[i]["char"] for i in cmp_["letters"] if i in ln)
        body.append(f"<div class='card' style='margin-top:3mm'><h4><span class='q' style='font-size:22pt;color:#a12a1d'>{esc(chars)}</span></h4><p>{esc(cmp_['note'])}</p></div>")
    body.append("</section></div>")
    out.append("".join(body))
    out.append(notes_page("ملاحظاتي على الصفات"))
    return "".join(out)


def build_html():
    c = load("letters.json")
    ahkam, toc_ahkam = build_ahkam()
    faces = "".join(
        [
            font_face("Plex", 400, FONTS / "ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-400-normal.woff2"),
            font_face("Plex", 700, FONTS / "ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-700-normal.woff2"),
            font_face("Quran", 400, FONTS / "amiri-quran/files/amiri-quran-arabic-400-normal.woff2"),
        ]
    )
    cover = (
        "<section class='cover'><div class='frame'></div><div class='frame2'></div><div class='inner'>"
        "<div class='bism'>بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div><div class='orn'></div>"
        "<h1>دفتر أحكام التجويد<br>وتلاوته</h1>"
        "<div class='sub'>برواية حفص عن عاصم من طريق الشاطبية</div>"
        "<div class='parts'><span>الأحكام</span><span>المخارج</span><span>الصفات</span></div>"
        "<div class='who'><div>اسم الطالب:</div><div>المعلّم / الحلقة:</div><div>التاريخ:</div></div>"
        "</div><div class='foot'>من برنامج «تعلّم التجويد»</div></section>"
    )
    toc = (
        "<section class='toc'><h2>الفهرس</h2>"
        "<div class='part'>الباب الأول: الأحكام</div><ul>" + "".join(f"<li>{esc(t)}</li>" for t in toc_ahkam) + "</ul>"
        "<div class='part'>الباب الثاني: المخارج</div><ul><li>المخارج العامة الخمسة</li><li>المخارج الخاصة السبعة عشر</li><li>الحروف واحداً واحداً</li><li>ألقاب الحروف وأسماء الأسنان</li></ul>"
        "<div class='part'>الباب الثالث: الصفات</div><ul><li>الصفات المتضادة</li><li>الصفات غير المتضادة</li><li>جدول صفات الحروف</li><li>الفرق بين الحروف المتشابهة</li></ul>"
        f"<div class='note'>{esc(c['note'])} نصوص الآيات منقولة كما هي من المصحف دون تعديل. في آخر كل باب صفحة مسطّرة لتدوين ملاحظاتك.</div></section>"
    )
    return (
        f"<!doctype html><html lang='ar' dir='rtl'><head><meta charset='utf-8'><title>دفتر أحكام التجويد وتلاوته</title><style>{faces}{CSS}</style></head>"
        f"<body>{cover}{toc}{ahkam}{build_makharij(c)}{build_sifat(c)}</body></html>"
    )


def find_browser():
    for p in [os.environ.get("CHROME_BIN"), shutil.which("google-chrome"), shutil.which("chromium"), shutil.which("chromium-browser"),
              r"C:\Program Files\Google\Chrome\Application\chrome.exe", r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
              r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"]:
        if p and Path(p).exists():
            return p
    raise SystemExit("لم أجد Chrome أو Edge؛ حدّد CHROME_BIN")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--html-only", action="store_true")
    a = ap.parse_args()
    out = Path(a.out).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    page = build_html()
    if a.html_only:
        out.write_text(page, encoding="utf-8")
        return
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "notebook.html"
        src.write_text(page, encoding="utf-8")
        cmd = [find_browser(), "--headless=new", "--disable-gpu", "--no-sandbox", f"--user-data-dir={tmp}/profile", "--no-pdf-header-footer",
               "--generate-pdf-document-outline", "--virtual-time-budget=20000", f"--print-to-pdf={out}", src.as_uri()]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    if not out.exists() or out.stat().st_size < 10_000:
        sys.exit(f"فشل بناء PDF: {r.stderr[-500:]}")
    print(f"{out} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
