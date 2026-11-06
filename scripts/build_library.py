"""يبني نصوص قسمَي «الأدعية» و«المكتبة» من مصادر رقمية مفتوحة، ويكتبها JSON في
frontend/src/features/library/data/ (تُضمَّن في البرنامج فتعمل دون إنترنت).

التشغيل:  python scripts/build_library.py [مجلد_التخزين_المؤقت]

المصادر (كلها نصوص تراثية، ونسخها الرقمية من مشروع OpenITI بترخيص CC BY-NC-SA 4.0):
  - الصحيفة السجادية: OpenITI ‏0786ShahidAwwal.SahifaSajjadiyya.Shia001112-ara1
  - نهج البلاغة:      OpenITI ‏0406SharifRadi.NahjBalagha.Shia20200618-ara1 (متن الشريف الرضي دون شرح محمد عبده)
  - مفاتيح الجنان:     OpenITI ‏1359CabbasQummi.MafatihJinan.Zaydiyya0000236-ara1 (الأدعية المشهورة)

كل ملف مثبّت على إيداع محدد (COMMIT)، فالناتج يتكرر حرفاً بحرف. لا يُعدَّل المتن:
تُحذف علامات الترقيم الآلية (أرقام الصفحات ms/PageV) فقط، ويبقى الإملاء كما في الطبعة.
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "frontend" / "src" / "features" / "library" / "data"

COMMIT = "cfc4157a3cf2054c0888f133970a4eaa3e22e58c"  # OpenITI/RELEASE
RAW = f"https://raw.githubusercontent.com/OpenITI/RELEASE/{COMMIT}/data/"
LICENSE = "CC BY-NC-SA 4.0"

SOURCES = {
    "sahifa": "0786ShahidAwwal/0786ShahidAwwal.SahifaSajjadiyya/0786ShahidAwwal.SahifaSajjadiyya.Shia001112-ara1.completed",
    "nahj": "0406SharifRadi/0406SharifRadi.NahjBalagha/0406SharifRadi.NahjBalagha.Shia20200618-ara1.mARkdown",
    "mafatih": "1359CabbasQummi/1359CabbasQummi.MafatihJinan/1359CabbasQummi.MafatihJinan.Zaydiyya0000236-ara1",
}

ARABIC_DIGITS = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")


def fetch(key: str, cache: Path) -> list[str]:
    cache.mkdir(parents=True, exist_ok=True)
    path = cache / Path(SOURCES[key]).name
    if not path.exists():
        with urllib.request.urlopen(RAW + SOURCES[key], timeout=120) as r:
            path.write_bytes(r.read())
    return path.read_text(encoding="utf-8").splitlines()


def clean(text: str) -> str:
    text = re.sub(r"PageV\d+P\d+", " ", text)
    text = re.sub(r"\bms\d+\b", " ", text)
    text = re.sub(r"\bAUTO\b", " ", text)
    text = re.sub(r"(^|\s)و\s+(?=[\u0621-\u064A])", r"\1و", text)  # واو العطف المنفصلة في الطبعة الخطية: «و من» ← «ومن»
    text = re.sub(r"\s+([،,.:؛؟!)\]])", r"\1", text)
    text = re.sub(r"([(\[])\s+", r"\1", text)
    return re.sub(r"\s+", " ", text).strip()


def paragraphs(lines: list[str]) -> list[str]:
    """أسطر mARkdown ← فقرات: «# » تبدأ فقرة، و«~~» تكمل السابقة، وسطر رقم الصفحة وحده يُهمل."""
    out: list[str] = []
    for raw in lines:
        line = raw.rstrip()
        if not line.strip() or re.fullmatch(r"#?\s*PageV\d+P\d+(\s+ms\d+)?\s*", line.strip()):
            continue
        if line.startswith("~~") and out:
            out[-1] += " " + line[2:]
        elif line.startswith("# "):
            out.append(line[2:])
        elif line.startswith("~~"):
            out.append(line[2:])
        else:
            out.append(line)
    return [p for p in (clean(p) for p in out) if p]


def heading(line: str) -> tuple[int, str]:
    m = re.match(r"^### (\|+) ?(.*)$", line)
    return (len(m.group(1)), clean(m.group(2))) if m else (0, "")


def body(lines: list[str]) -> list[str]:
    return lines[next(i for i, l in enumerate(lines) if l.startswith("#META#Header#End#")) + 1 :]


# ---------------------------------------------------------------- الصحيفة

def build_sahifa(cache: Path) -> dict:
    lines = body(fetch("sahifa", cache))
    items, cur = [], None
    for line in lines:
        level, title = heading(line)
        if level == 1 and title == "|EDITOR|" or line.startswith("### |EDITOR|"):
            cur = None
            continue
        if level == 1:
            m = re.match(r"\((\d+)\)\s*\[(.+)\]", title)
            cur = {
                "id": int(m.group(1)) if m else 0,
                "title": clean(m.group(2)) if m else title.strip("[]"),
                "lines": [],
            }
            items.append(cur)
        elif cur is not None:
            cur["lines"].append(line)
    chapters = []
    for it in items:
        paras = paragraphs(it.pop("lines"))
        # الفقرة الأولى في كل دعاء عنوانه الأصلي («وكان من دعائه عليه السلام …»): تُعرض تمهيداً فوق المتن
        intro = []
        if paras and paras[0].startswith("وكان من دعائه"):
            intro.append(paras.pop(0))
            if paras and paras[0].startswith("بدأ "):  # الدعاء الأول: عنوانه في سطرين
                intro.append(paras.pop(0))
        chapters.append({"id": it["id"], "title": it["title"], "intro": intro, "paras": paras})
    if [c["id"] for c in chapters[1:]] != list(range(1, 55)):
        raise SystemExit("الصحيفة: عدد الأدعية ليس ٥٤")
    chapters[0]["title"] = "مقدمة الصحيفة (السند)"
    # قائمة الأبواب في السند (رواية المطهري) من المتن: تبقى، ويُكتب رقمها بالأرقام العربية
    chapters[0]["paras"] = [p.translate(ARABIC_DIGITS) for p in chapters[0]["paras"]]
    return {
        "id": "sahifa",
        "title": "الصحيفة السجادية",
        "author": "الإمام علي بن الحسين زين العابدين (عليه السلام)",
        "about": "زبور آل محمد: أربعة وخمسون دعاءً أملاها الإمام السجاد (عليه السلام)، برواية المتوكل بن هارون.",
        "source": source_note("sahifa", "الصحيفة الكاملة السجادية، طبعة دفتر انتشارات إسلامي (قم ١٣٧٤ش)"),
        "groups": [{"id": "all", "title": "الأدعية", "chapters": chapters}],
    }


# ---------------------------------------------------------------- نهج البلاغة

NAHJ_PARTS = [("intro", "مقدمة الشريف الرضي"), ("khutab", "الخطب"), ("kutub", "الكتب والرسائل"), ("hikam", "الحكم والمواعظ")]


# بقايا ترقيم الطبعة في النسخة الرقمية: «57 - وقال…» أو «0 1 - (ومن كتاب…» (أي ١٠ مقلوبة) تعني بداية نص
# جديد التصق بما قبله، فيُفصل عنه. ورقم منفرد في آخر فقرة («فيحلب 2») أو «(5» بقية حاشية، فيُحذف.
SPLIT = re.compile(r"\s+\d+(?:\s\d+)*\s*-\s*(?=\(ومن|[ء-ي]|$)")


def strip_numbers(p: str) -> str:
    p = re.sub(r"\s\(\d+\.?(?=\s|$)", "", p)
    p = re.sub(r"(^|\s)\d+(?:\s\d+)*\s*-?\s*$", "", p)
    return p.strip()


def split_merged(chapters: list[dict]) -> list[dict]:
    out: list[dict] = []
    for ch in chapters:
        cur = {"title": ch["title"], "paras": []}
        out.append(cur)
        pending = False  # فقرة سابقة انتهت بـ«75 -»: ما بعدها نص جديد
        for para in ch["paras"]:
            if pending:
                cur = {"title": None, "paras": []}
                out.append(cur)
                pending = False
            pieces = SPLIT.split(para)
            for j, piece in enumerate(pieces):
                piece = piece.strip()
                if j > 0:
                    if not piece:
                        pending = True
                        continue
                    cur = {"title": None, "paras": []}
                    out.append(cur)
                if piece:
                    cur["paras"].append(piece)
    for ch in out:
        if ch["title"] is None and ch["paras"]:
            m = re.match(r"^((?:\([^)]*\)\s*)+)(.*)$", ch["paras"][0])
            if m:  # عنوان الكتاب بين أقواس في أول النص
                ch["title"] = clean(m.group(1))
                ch["paras"][0] = m.group(2).strip()
                if not ch["paras"][0]:
                    ch["paras"].pop(0)
            else:
                ch["title"] = ""
    return [c for c in out if c["paras"]]


def build_nahj(cache: Path) -> dict:
    lines = body(fetch("nahj", cache))
    parts: list[dict] = []
    cur = None
    for line in lines:
        level, title = heading(line)
        if level == 1:
            pid, ptitle = NAHJ_PARTS[len(parts)]
            parts.append({"id": pid, "title": ptitle, "chapters": []})
            if pid == "intro":
                cur = {"title": ptitle, "lines": []}
                parts[-1]["chapters"].append(cur)
            continue
        if not parts:
            continue
        if level == 2:
            cur = {"title": title, "lines": []}
            parts[-1]["chapters"].append(cur)
        elif level >= 3 and cur is not None:
            cur["lines"].append("# ⟨" + title + "⟩")  # عنوان فرعي داخل الخطبة
        elif cur is not None:
            cur["lines"].append(line)
    for part in parts:
        for ch in part["chapters"]:
            ch["paras"] = paragraphs(ch.pop("lines"))
        if part["id"] in ("kutub", "hikam"):
            part["chapters"] = split_merged(part["chapters"])
        for i, ch in enumerate(part["chapters"], 1):
            ch["id"] = i
            ch["paras"] = [q for q in (strip_numbers(x) for x in ch["paras"]) if q]
            if part["id"] == "hikam":
                ch["title"] = f"الحكمة {str(i).translate(ARABIC_DIGITS)}"
    counts = {p["id"]: len(p["chapters"]) for p in parts}
    if counts.get("khutab", 0) < 230 or counts.get("kutub", 0) < 70 or counts.get("hikam", 0) < 460:
        raise SystemExit(f"نهج البلاغة: أعداد غير متوقعة {counts}")
    return {
        "id": "nahj",
        "title": "نهج البلاغة",
        "author": "من كلام أمير المؤمنين علي بن أبي طالب (عليه السلام)، جمع الشريف الرضي (ت ٤٠٦هـ)",
        "about": "مختار خطب أمير المؤمنين (عليه السلام) وكتبه وحكمه. الترقيم بحسب طبعة الشيخ محمد عبده، وقد يختلف قليلاً عن طبعة صبحي الصالح.",
        "source": source_note("nahj", "نهج البلاغة بشرح محمد عبده (المتن وحده دون الشرح)"),
        "groups": parts,
    }


# ---------------------------------------------------------------- الأدعية المشهورة (مفاتيح الجنان)

# (المعرّف، العنوان، الوصف، سطر التمهيد [من، إلى] أو None، سطر المتن [من، إلى]) — أرقام الأسطر في الملف المثبّت
MAFATIH = [
    ("kumayl", "دعاء كميل", "علّمه أمير المؤمنين (عليه السلام) كميلَ بن زياد، يُقرأ ليلة الجمعة وليلة النصف من شعبان", (1595, 1603), (1604, 1702)),
    ("sabah", "دعاء الصباح", "لأمير المؤمنين (عليه السلام)، يُقرأ بعد صلاة الصبح", (1539, 1540), (1541, 1583)),
    ("simat", "دعاء السمات", "المعروف بدعاء الشبور، يُقرأ آخر ساعة من نهار الجمعة", (1774, 1783), (1784, 1842)),
    ("ashrat", "دعاء العشرات", "يُقرأ كل صباح ومساء، وأفضله عصر الجمعة", (1703, 1706), (1709, 1771)),
    ("mujeer", "دعاء المجير", "مروي عن النبي (صلى الله عليه وآله)، يُقرأ في الأيام البيض من شهر رمضان", (2022, 2031), (2032, 2101)),
    ("jawshan-kabir", "دعاء الجوشن الكبير", "مئة فصل في أسماء الله الحسنى، نزل به جبرئيل على النبي (صلى الله عليه وآله)", (2167, 2180, "المذكور في"), (2199, 2451, "وهو هذا الدعاء")),
    ("jawshan-saghir", "دعاء الجوشن الصغير", "دعاء عظيم الشأن لدفع الشدائد", (2454, 2463), (2464, 2604)),
    ("tawassul", "دعاء التوسل", "التوسل بالنبي والأئمة (عليهم السلام)، رواه الشيخ الصدوق", (2647, 2650), (2651, 2701)),
    ("iftitah", "دعاء الافتتاح", "يُقرأ كل ليلة من ليالي شهر رمضان", (4796, 4799), (4800, 4869)),
    ("baha", "دعاء السحر (البهاء)", "عن الإمام الرضا (عليه السلام)، يُقرأ في أسحار شهر رمضان", (4943, 4947), (4948, 4974)),
    ("abu-hamza", "دعاء أبي حمزة الثمالي", "كان الإمام زين العابدين (عليه السلام) يدعو به في أسحار شهر رمضان", (4979, 4982), (4983, 5229)),
]


def build_adiya(cache: Path) -> dict:
    lines = fetch("mafatih", cache)

    def span(a: int, b: int, after: str | None = None) -> list[str]:
        """أسطر [a، b]؛ و after: يبدأ النص من هذه العبارة (حين يشترك سطر واحد بين عنوان ومتن)."""
        out = []
        for l in lines[a - 1 : b]:
            if l.startswith("### "):  # عنوان قسم يقع داخل المدى: نهاية المتن
                break
            out.append(l)
        paras = paragraphs(out)
        if after:
            head = paras[0]
            if after not in head:
                raise SystemExit(f"لم أجد «{after}» في السطر {a}")
            rest = head[head.index(after) :]
            if after.startswith("وهو هذا"):
                rest = rest[len(after) :].strip()
            paras[0] = rest
        return paras

    chapters = []
    for i, (cid, title, desc, intro, text) in enumerate(MAFATIH, 1):
        paras = span(*text)
        if cid == "jawshan-kabir":  # مئة فصل مرقّمة «(1) … (100)»: فقرة لكل فصل
            paras = [q.strip() for p in paras for q in re.split(r"\s*\(\d+\)\s*", p) if q.strip()]
        chapters.append({"id": i, "slug": cid, "title": title, "desc": desc, "intro": span(*intro) if intro else [], "paras": paras})

    munajat = build_munajat(lines)
    return {
        "id": "adiya",
        "title": "الأدعية المشهورة",
        "author": "من مفاتيح الجنان للشيخ عباس القمي (ت ١٣٥٩هـ)",
        "about": "أشهر الأدعية المأثورة، والمناجيات الخمس عشرة للإمام زين العابدين (عليه السلام).",
        "source": source_note("mafatih", "مفاتيح الجنان، الشيخ عباس القمي"),
        "groups": [
            {"id": "mashhura", "title": "الأدعية المشهورة", "chapters": chapters},
            {"id": "munajat", "title": "المناجيات الخمس عشرة", "chapters": munajat},
        ],
    }


def build_munajat(lines: list[str]) -> list[dict]:
    """المناجيات الخمس عشرة: من «المناجاة الأولى» إلى نهاية الفصل الثامن."""
    start = next(i for i, l in enumerate(lines) if "المناجاة الاولى" in l)
    end = next(i for i in range(start, len(lines)) if lines[i].startswith("### |") or "المناجاة المنظومة" in lines[i])
    paras = paragraphs(lines[start:end])
    out, cur = [], None
    pat = re.compile(r"^(?:المناجاة\s+)?(الاولى|الثانية|الثالثة|الرابعة|الخامسة|السادسة|السابعة|الثامنة|التاسعة|العاشرة|الحادية عشرة|الثانية عشرة|الثالثة عشرة|الرابعة عشرة|الخامسة عشرة)\s*:\s*«\s*([^»]+?)\s*»\s*(.*)$")
    for p in paras:
        m = pat.match(p)
        if m:
            cur = {"id": len(out) + 1, "title": m.group(2), "paras": [m.group(3)] if m.group(3) else []}
            out.append(cur)
        elif cur is not None:
            cur["paras"].append(p)
    if len(out) != 15:
        raise SystemExit(f"المناجيات: وجدت {len(out)} بدل ١٥")
    return out


def source_note(key: str, edition: str) -> dict:
    uri = Path(SOURCES[key]).name
    return {
        "edition": edition,
        "digital": f"OpenITI ({uri})",
        "url": f"https://github.com/OpenITI/RELEASE/blob/{COMMIT}/data/{SOURCES[key]}",
        "license": LICENSE,
        "note": "النص كما في النسخة الرقمية دون تشكيل؛ لم يُضف إليه ولم يُحذف منه شيء.",
    }


def main() -> None:
    cache = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / ".cache" / "library"
    OUT.mkdir(parents=True, exist_ok=True)
    for name, build in (("sahifa", build_sahifa), ("nahj", build_nahj), ("adiya", build_adiya)):
        book = build(cache)
        (OUT / f"{name}.json").write_text(json.dumps(book, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        n = sum(len(g["chapters"]) for g in book["groups"])
        print(f"{name}: {n} فصلاً، {(OUT / f'{name}.json').stat().st_size // 1024} ك.ب")


if __name__ == "__main__":
    main()
