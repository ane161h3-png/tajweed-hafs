"""ينزّل البيانات العامة ويولّد ملفات source-data.

التشغيل:  python scripts/fetch_sources.py [--refresh] [--check-audio]

- الملفات الخام تُحفظ في source-data/raw كما نُزّلت (للرجوع إلى المصدر).
- الملفات المولّدة: quran-tajweed-hafs.json, surahs.json, juz-starts.json,
  tajweed-rules.json, reciters.json, minshawi-library.json
- لا يُولَّد ahkam-hafs.md: المحتوى العلمي يُكتب ويُراجع في البرنامج نفسه.
"""
from __future__ import annotations

import argparse
import ast
import colorsys
import json
import re
import sys
import urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "source-data"
RAW = OUT / "raw"

SOURCES = {
    # نسخة نص تنزيل التي بُنيت عليها مواقع الأحكام في cpfair (انظر README المشروع)
    "quran-uthmani.txt": "https://github.com/cpfair/quran-tajweed/files/7281388/quran-uthmani.txt",
    "tajweed.hafs.uthmani-pause-sajdah.json":
        "https://raw.githubusercontent.com/cpfair/quran-tajweed/master/output/tajweed.hafs.uthmani-pause-sajdah.json",
    "quran-data.js": "https://tanzil.net/res/text/metadata/quran-data.js",
    "everyayah-recitations.js": "https://everyayah.com/data/recitations.js",
    "mp3quran-reciters-ar.json": "https://mp3quran.net/api/v3/reciters?language=ar",
}

# الأحكام الثمانية عشر: الاسم العربي، والباب في فهرس الألوان، واللون، ووصف مختصر.
RULES = [
    ("ikhfa", "الإخفاء الحقيقي", "noon", "#e67e22",
     "النون الساكنة أو التنوين قبل أحد حروف الإخفاء الخمسة عشر: تُنطق بين الإظهار والإدغام مع غنة."),
    ("idghaam_ghunnah", "الإدغام بغنة", "noon", "#27ae60",
     "النون الساكنة أو التنوين قبل أحد حروف «ينمو»: تُدغم في الحرف التالي مع غنة."),
    ("idghaam_no_ghunnah", "الإدغام بغير غنة", "noon", "#7f8c3a",
     "النون الساكنة أو التنوين قبل اللام أو الراء: تُدغم فيهما إدغاماً كاملاً بلا غنة."),
    ("iqlab", "الإقلاب", "noon", "#16a3b8",
     "النون الساكنة أو التنوين قبل الباء: تُقلب ميماً مخفاة مع الغنة."),
    ("ikhfa_shafawi", "الإخفاء الشفوي", "meem", "#d63384",
     "الميم الساكنة قبل الباء: تُخفى مع الغنة."),
    ("idghaam_shafawi", "الإدغام الشفوي", "meem", "#8e44ad",
     "الميم الساكنة قبل ميم متحركة: تُدغم فيها مع الغنة."),
    ("ghunnah", "الغنة", "ghunnah", "#e0a100",
     "النون والميم المشددتان: غنة كاملة بمقدار حركتين."),
    ("madd_2", "المد الطبيعي", "madd", "#e07a5f",
     "حرف المد بلا همز ولا سكون بعده: يُمد حركتين."),
    ("madd_muttasil", "المد المتصل", "madd", "#a3243f",
     "حرف المد وبعده همزة في كلمة واحدة: يُمد أربع أو خمس حركات."),
    ("madd_munfasil", "المد المنفصل", "madd", "#c2448f",
     "حرف المد في آخر كلمة والهمزة في أول التالية: يُمد أربع أو خمس حركات."),
    ("madd_246", "المد العارض للسكون ومد اللين", "madd", "#d64545",
     "حرف مد أو لين بعده سكون عارض للوقف: يُمد حركتين أو أربعاً أو ستاً."),
    ("madd_6", "المد اللازم", "madd", "#7a1325",
     "حرف المد وبعده سكون أصلي: يُمد ست حركات لزوماً."),
    ("qalqalah", "القلقلة", "qalqalah", "#2471e8",
     "أحد حروف «قطب جد» ساكناً: يُنطق باضطراب في المخرج حتى يُسمع له نبرة قوية."),
    ("hamzat_wasl", "همزة الوصل", "silent", "#9aa0a6",
     "همزة تثبت في الابتداء وتسقط في الوصل."),
    ("lam_shamsiyyah", "اللام الشمسية", "silent", "#8a9199",
     "لام «ال» قبل الحروف الشمسية: تُكتب ولا تُنطق، ويُشدَّد الحرف بعدها."),
    ("silent", "حرف لا يُنطق", "silent", "#b0b5bb",
     "حرف مكتوب في الرسم لا يُنطق وصلاً ولا وقفاً، أو يُنطق وقفاً فقط."),
    ("idghaam_mutajanisayn", "إدغام المتجانسين", "idgham", "#a0522d",
     "حرفان اتفقا مخرجاً واختلفا صفة، الأول ساكن: يُدغم الأول في الثاني."),
    ("idghaam_mutaqaribayn", "إدغام المتقاربين", "idgham", "#6d4c41",
     "حرفان تقاربا مخرجاً أو صفة، الأول ساكن: يُدغم الأول في الثاني."),
]

GROUPS = {
    "noon": "أحكام النون الساكنة والتنوين",
    "meem": "أحكام الميم الساكنة",
    "ghunnah": "الغنة",
    "madd": "المدود",
    "qalqalah": "القلقلة",
    "silent": "حروف لا تُنطق",
    "idgham": "إدغام المتجانسين والمتقاربين",
}

# قرّاء رواية حفص: مجلد everyayah (آية آية) ورقم مصحف mp3quran (السورة كاملة).
RECITERS = [
    ("minshawi-murattal", "محمد صديق المنشاوي", "مرتل", "Minshawy_Murattal_128kbps", 112),
    ("minshawi-mujawwad", "محمد صديق المنشاوي", "مجوّد", "Minshawy_Mujawwad_192kbps", 113),
    ("minshawi-muallim", "محمد صديق المنشاوي", "معلّم", None, 114),
    ("husary-murattal", "محمود خليل الحصري", "مرتل", "Husary_128kbps", 118),
    ("husary-mujawwad", "محمود خليل الحصري", "مجوّد", "Husary_128kbps_Mujawwad", 119),
    ("husary-muallim", "محمود خليل الحصري", "معلّم", "Husary_Muallim_128kbps", None),
    ("ayman-sowaid", "أيمن رشدي سويد", "معلّم", "Ayman_Sowaid_64kbps", 10925),
    ("abdulbasit-murattal", "عبد الباسط عبد الصمد", "مرتل", "Abdul_Basit_Murattal_192kbps", 53),
    ("abdulbasit-mujawwad", "عبد الباسط عبد الصمد", "مجوّد", "Abdul_Basit_Mujawwad_128kbps", 51),
    ("banna-murattal", "محمود علي البنا", "مرتل", "mahmoud_ali_al_banna_32kbps", 121),
    ("tablawi-murattal", "محمد الطبلاوي", "مرتل", "Mohammad_al_Tablaway_128kbps", 106),
    ("mustafa-ismail", "مصطفى إسماعيل", "مرتل", "Mustafa_Ismail_48kbps", 125),
    ("hudhaifi", "علي بن عبد الرحمن الحذيفي", "مرتل", "Hudhaify_128kbps", 74),
    ("ayyub", "محمد أيوب", "مرتل", "Muhammad_Ayyoub_128kbps", 109),
    ("alafasy", "مشاري راشد العفاسي", "مرتل", "Alafasy_128kbps", 123),
]
# مصاحف المنشاوي في mp3quran لمكتبته الخاصة
MINSHAWI_MOSHAF = [(112, "مرتل"), (113, "مجوّد"), (114, "معلّم"), (10924, "مرتل - تسجيل 1387هـ / 1967م")]
MINSHAWI_EVERYAYAH = {"مرتل": "Minshawy_Murattal_128kbps", "مجوّد": "Minshawy_Mujawwad_192kbps"}

EVERYAYAH = "https://everyayah.com/data/{folder}/{{sss}}{{aaa}}.mp3"


def download(refresh: bool) -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    for name, url in SOURCES.items():
        path = RAW / name
        if path.exists() and not refresh:
            continue
        print(f"تنزيل {name} …")
        req = urllib.request.Request(url, headers={"User-Agent": "tajweed-app/0.1"})
        with urllib.request.urlopen(req, timeout=120) as r:
            path.write_bytes(r.read())


def write_lines(path: Path, items, wrap=None) -> None:
    """JSON بعنصر في كل سطر، ليسهل تعديله يدوياً (مثل إضافة قارئ بسطر واحد)."""
    body = ",\n".join("  " + json.dumps(x, ensure_ascii=False) for x in items)
    text = f"[\n{body}\n]\n"
    if wrap:
        text = wrap(text)
    path.write_text(text, encoding="utf-8")


def read_tanzil_text() -> dict[tuple[int, int], str]:
    verses = {}
    for line in (RAW / "quran-uthmani.txt").read_text(encoding="utf-8-sig").splitlines():
        if not line or line.startswith("#"):
            continue
        s, a, text = line.split("|", 2)
        verses[(int(s), int(a))] = text
    return verses


def js_array(src: str, name: str) -> list:
    m = re.search(rf"QuranData\.{name}\s*=\s*\[(.*?)\];", src, re.S)
    body = re.sub(r"//[^\n]*", "", m.group(1))
    return [x for x in ast.literal_eval("[" + body + "]") if x]  # مصفوفات JS هنا صالحة كقيم بايثون


def build_quran() -> Counter:
    text = read_tanzil_text()
    annotations = json.loads((RAW / "tajweed.hafs.uthmani-pause-sajdah.json").read_text(encoding="utf-8"))
    assert len(text) == 6236 and len(annotations) == 6236, (len(text), len(annotations))
    counts: Counter = Counter()
    rows = []
    for rec in sorted(annotations, key=lambda r: (r["surah"], r["ayah"])):
        key = (rec["surah"], rec["ayah"])
        marks = sorted(({"rule": a["rule"], "start": a["start"], "end": a["end"]} for a in rec["annotations"]),
                       key=lambda a: (a["start"], a["end"]))
        counts.update(m["rule"] for m in marks)
        rows.append({"surah": key[0], "ayah": key[1], "text": text[key], "tajweed": marks})
    write_lines(OUT / "quran-tajweed-hafs.json", rows)
    return counts


def build_meta() -> None:
    src = (RAW / "quran-data.js").read_text(encoding="utf-8")
    suras = js_array(src, "Sura")[:114]  # الصف الأخير علامة نهاية [6236, 1]
    types = {"Meccan": "مكية", "Medinan": "مدنية"}
    write_lines(OUT / "surahs.json", [
        {"number": i, "name": s[4], "name_en": s[5], "ayah_count": s[1], "type": types[s[7]], "revelation_order": s[2]}
        for i, s in enumerate(suras, start=1)
    ])
    juz = js_array(src, "Juz")[:30]
    write_lines(OUT / "juz-starts.json", [{"juz": i, "surah": s, "ayah": a} for i, (s, a) in enumerate(juz, start=1)])
    # صفحات مصحف المدينة (٦٠٤): أول آية في كل صفحة. الصف الأخير علامة نهاية
    pages = js_array(src, "Page")[:604]
    write_lines(OUT / "pages.json", [{"page": i, "surah": s, "ayah": a} for i, (s, a) in enumerate(pages, start=1)])
    # أرباع الأحزاب (٢٤٠): كل حزب أربعة أرباع. الصف الأخير علامة نهاية
    hizb = js_array(src, "HizbQaurter")[:240]
    write_lines(OUT / "hizb.json", [{"quarter": i, "surah": s, "ayah": a} for i, (s, a) in enumerate(hizb, start=1)])


def dark_variant(hex_color: str) -> str:
    """لون أفتح قليلاً يبقى مقروءاً على الخلفية الداكنة."""
    r, g, b = (int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    r, g, b = colorsys.hls_to_rgb(h, max(l, 0.62), min(s, 0.75))
    return "#" + "".join(f"{round(c * 255):02x}" for c in (r, g, b))


def build_rules(counts: Counter) -> None:
    unknown = set(counts) - {r[0] for r in RULES}
    assert not unknown, f"أحكام غير معرّفة: {unknown}"
    write_lines(OUT / "tajweed-rules.json", [
        {"id": rid, "name": name, "group": group, "group_name": GROUPS[group], "color": color,
         "color_dark": dark_variant(color), "description": desc, "count": counts[rid]}
        for rid, name, group, color, desc in RULES
    ])


def build_reciters() -> list[str]:
    everyayah = json.loads((RAW / "everyayah-recitations.js").read_text(encoding="utf-8"))
    folders = {v["subfolder"] for k, v in everyayah.items() if k != "ayahCount"}
    moshaf = {m["id"]: m for r in json.loads((RAW / "mp3quran-reciters-ar.json").read_text(encoding="utf-8"))["reciters"]
              for m in r["moshaf"]}
    urls, rows = [], []
    for rid, name, style, folder, moshaf_id in RECITERS:
        assert folder is None or folder in folders, f"مجلد everyayah غير موجود: {folder}"
        m = moshaf.get(moshaf_id) if moshaf_id else None
        assert moshaf_id is None or m, f"مصحف mp3quran غير موجود: {moshaf_id}"
        row = {
            "id": rid, "name": name, "style": style, "riwaya": "حفص عن عاصم",
            "ayah_url": EVERYAYAH.format(folder=folder) if folder else None,
            "surah_url": m["server"] + "{sss}.mp3" if m else None,
            "surahs": [int(x) for x in m["surah_list"].split(",")] if m and m["surah_total"] < 114 else None,
        }
        rows.append({k: v for k, v in row.items() if v is not None})
        urls += [u for u in (row["ayah_url"], row["surah_url"]) if u]
    write_lines(OUT / "reciters.json", rows)

    items = []
    for mid, style in MINSHAWI_MOSHAF:
        m = moshaf[mid]
        folder = MINSHAWI_EVERYAYAH.get(style)
        items.append({k: v for k, v in {
            "style": style, "moshaf_name": m["name"], "surah_url": m["server"] + "{sss}.mp3",
            "ayah_url": EVERYAYAH.format(folder=folder) if folder else None,
            "surahs": [int(x) for x in m["surah_list"].split(",")] if m["surah_total"] < 114 else None,
        }.items() if v is not None})
    (OUT / "minshawi-library.json").write_text(json.dumps(
        {"reciter": "محمد صديق المنشاوي", "riwaya": "حفص عن عاصم", "items": items}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8")
    return urls


def check_audio(urls: list[str]) -> list[str]:
    bad = []
    for u in urls:
        test = u.replace("{sss}", "001").replace("{aaa}", "001")
        try:
            req = urllib.request.Request(test, method="HEAD", headers={"User-Agent": "tajweed-app/0.1"})
            with urllib.request.urlopen(req, timeout=20) as r:
                ok = r.status == 200
        except Exception:  # noqa: BLE001
            ok = False
        if not ok:
            bad.append(test)
    return bad


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--refresh", action="store_true", help="أعد تنزيل الملفات الخام")
    p.add_argument("--check-audio", action="store_true", help="تحقّق من أن روابط الصوت تعمل")
    args = p.parse_args(argv)
    download(args.refresh)
    counts = build_quran()
    build_meta()
    build_rules(counts)
    urls = build_reciters()
    print(f"المصحف: 6236 آية، {sum(counts.values())} موضع حكم في {len(counts)} حكماً")
    print(f"القرّاء: {len(RECITERS)}")
    if args.check_audio:
        bad = check_audio(urls)
        print("روابط الصوت: كلها تعمل" if not bad else "روابط لا تعمل:\n  " + "\n  ".join(bad))
        return 1 if bad else 0
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
