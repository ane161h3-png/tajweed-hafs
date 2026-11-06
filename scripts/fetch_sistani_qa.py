"""ينقل استفتاءات السيد السيستاني (دام ظله) من الموقع الرسمي لمكتبه إلى
frontend/src/features/masail/data/qa.json، فتُعرض في قسم «المسائل الشرعية» وتعمل دون إنترنت.

التشغيل:  python scripts/fetch_sistani_qa.py [مجلد_التخزين_المؤقت]

المصدر: https://www.sistani.org/arabic/qa/ (فهرس المواضيع، ثم صفحة كل موضوع).
النص يُنقل حرفياً: السؤال والجواب كما في الموقع، مع رقم الاستفتاء ورابطه الدائم (sistani.org/رقم)
ليرجع القارئ إلى الأصل. تُحفظ الصفحات في مجلد مؤقت فلا يُطلب من الموقع إلا ما لم يُحفظ،
وبين كل طلبين مهلة قصيرة رفقاً بالموقع.
"""
from __future__ import annotations

import html
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "frontend" / "src" / "features" / "masail" / "data" / "qa.json"
BASE = "https://www.sistani.org"
INDEX = "/arabic/qa/"
DELAY = 0.5  # ثانية بين الطلبات
AR = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


# أبواب القسم: يُوضع كل موضوع من مواضيع الموقع (مرتّبة فيه أبجدياً) في باب بحسب عنوانه.
# الترتيب مهم: أول باب يطابق يأخذ الموضوع («الخمس في الحج» في الخمس، «صوم المسافر» في الصوم).
BABS = [
    ("taqlid", "التقليد والاجتهاد", r"تقليد|الاجتهاد|المجتهد|الأحكام الشرعيّة|أهل الخبرة|البلوغ في|ولاية الفقيه"),
    ("khums", "الخمس والحقوق الشرعية", r"خمس|سهم الإمام|الحقوق الشرعيّة|الأنفال|ردّ المظالم|مجهول المالك"),
    ("zakat", "الزكاة والصدقات", r"زكاة|الزكاة|الصدقة|التبرّعات|الجمعيّات الخيريّة"),
    ("hajj", "الحج والعمرة والزيارة", r"(^|\s)(ال)?حجّ?($|\s)|العمرة|عمرة|طواف|السعي|منى|المطاف|الحرمين|الحلق والتقصير|الزيارة|زيارة|العتبات|التربة الحسينيّة|الشعائر الحسينيّة"),
    ("sawm", "الصوم والاعتكاف", r"(^|\s)(ال)?صوم|الصيام|الصائم|الإفطار|رؤية الهلال|الاعتكاف"),
    ("mayyit", "أحكام الأموات", r"الميّت|الميت($|\s)|الاحتضار|القبور|نبش القبر|الوفاة في البلدان"),
    ("salat", "الصلاة", r"صلاة|الصلاة|الصلوات|الأذان|أوقات الفرائض|سجود السهو|سجدة التلاوة|الشكوك|كثير الشك|النوافل|مكان المصلي|المساجد|المسافر|القواطع في السفر|الإعراض عن الوطن|التجويد|سور العزائم"),
    ("tahara", "الطهارة", r"طهار|الوضوء|غسل|الغسل|التيمّم|الجنابة|الحيض|الاستحاضة|النفاس|الدماء الثلاثة|نجس|متنجّس|المطهرات|المياه|الماء الكر|الأسآر|الاستنجاء|الاستبراء|التخلّي|الخرطات|الجبيرة|فاقد الطهورين|دائم الحدث|المسلوس|عرق الجُنُب|ولوغ|الوسواس|الاستظهار|الحائض|الغَسل"),
    ("nikah", "الزواج والأسرة", r"زواج|النكاح|المهر|(?<!إ)طلاق|الخلع|العدة|العدّة|الرضاع|المحارم|المصاهرة|الخطوبة|الزوجيّة|الزوجات|الحضانة|الوالدين|الأبناء|الأولاد|التبنّي|تسمية|الولادة|العقيقة|الختان|النشوز|الظهار|الإيلاء|اللعان|الرجعة|المباراة|الحمل وموانع|التلقيح|إجارة الرحم|الجنين|الثيّب|الفتاة الباكر|ملك اليمين|وطء الشبهة|المفقود زوجها|الزوجين|نذر الزوجة|صلة الأرحام|النسب|ولاية الأب|القذف|الجماع|التمكين|الحداد|الأعراس|التربية الجنسيّة"),
    ("muamalat", "المعاملات والعمل", r"بيع|البيع|الشراء|تجار|التجارة|الربا|البنوك|المصارف|المصرفيّة|الأسهم|السندات|البورصة|الإجارة|الأجرة|الدَين|الرهن|الضمان|الشركة|الشركات|الصلح|المصالحة|الوكالة|الوديعة|العارية|الاستعارة|الهبة|الهدية|الوقف|الوصية|المضاربة|المزارعة|المساقاة|المغارسة|خيار|الشفعة|القسمة|الكفالة|الحوالات|الكمبيالات|(^|\s)العمل|التوظيف|الراتب|العمولة|السرقفليّة|الجعالة|الإقالة|العربون|التأمين|الاعتمادات|الائتمان|المكشوف|الادّخار|الاستثمار|العملات|العملة|المزايدة|المساومة|النجش|الغش في المعاملات|التدليس|الغصب|الأرش|التعويض|الجوائز|اليانصيب|الرهان|المسابقات|السبق|الإيداع|الفوائد|القيمة السوقية|المحاماة|حقّ الطبع|استنساخ البرامج|المزابنة|المحاقلة|السلف|إبراء الذمّة|المشتركات|إحياء الأراضي|أموال|الحَجْر|السفه|الإقرار|القرعة|اللقيط|المفقودات|الضالة|سفر الغريم|الغرامات|الرشوة|الرواتب|إيفاد|المنح|ضراب الفحل|العقد|الشرط الضمني|المعاملات|الإكراميّة|تبديل الطحين|القيمومة|الضوابط القانونية|التقيّد بالأحكام"),
    ("tib", "الطب والمستجدات", r"(^|\s)(ال)?طب($|\s)|الطبيّة|الطبيب|الأعضاء|تشريح|الاستنساخ|الهندسة الوراثية|الفحص الجيني|الموت الدماغي|الأدوية|الحجامة|التجميل|الليزر|الأيدز|تغيير الجنسيّة|التبرّع بالدم|العدسات|المنشطات"),
    ("atima", "الأطعمة والأشربة والصيد", r"اللحوم|الأسماك|السمك|الذباحة|التذكية|الصيد|الطيور|حيوان|الميتة|الجيلاتين|الأنفحة|الأجبان|الكحول|الخمر|الفقاع|عصير العنب|الشعير|المائدة|شرب الماء|أكل الطين|الخلّ|الدم في البيض|الجلود|الأضحية|الأطعمة"),
    ("amma", "مسائل عامة: الأخلاق واللباس والعلاقات", r"."),
]


def bab_of(title: str) -> str:
    return next(bid for bid, _, pat in BABS if re.search(pat, title))


def get(path: str, cache: Path) -> str:
    name = re.sub(r"[^0-9a-z]+", "_", path.strip("/")) or "index"
    f = cache / f"{name}.html"
    if f.exists():
        return f.read_text(encoding="utf-8")
    req = urllib.request.Request(BASE + path, headers={"User-Agent": "tajweed-hafs-app (educational, offline copy with links)"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                text = r.read().decode("utf-8")
            break
        except Exception:  # noqa: BLE001 — إعادة المحاولة عند انقطاع الشبكة
            if attempt == 3:
                raise
            time.sleep(2 ** (attempt + 1))
    f.write_text(text, encoding="utf-8")
    time.sleep(DELAY)
    return text


def plain(fragment: str) -> str:
    """HTML ← نص: <br> سطر جديد، وتُحذف بقية الوسوم، وتُفك الرموز؛ لا يُمسّ النص نفسه."""
    s = re.sub(r"<br\s*/?>", "\n", fragment, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s).replace("\xa0", " ")
    lines = [re.sub(r"[ \t]+", " ", l).strip() for l in s.split("\n")]
    return "\n".join(l for l in lines if l)


def topics(cache: Path) -> list[dict]:
    page = get(INDEX, cache)
    out, seen = [], set()
    for a in re.finditer(r"<a\b[^>]*>.*?</a>", page, re.S):
        tag = a.group(0)
        href = re.search(r'href="(/arabic/qa/(\d+)/)"', tag)
        count = re.search(r'title="عدد الأسئلة: ([٠-٩0-9]+)"', tag)
        if not href or not count or href.group(1) in seen:
            continue
        seen.add(href.group(1))
        out.append({"id": href.group(2), "title": plain(re.sub(r"^<a\b[^>]*>|</a>$", "", tag)), "count": int(count.group(1).translate(AR))})
    return out


QA = re.compile(r'<div class="one-qa">\s*<a href="/arabic/qa/(\d+)/".*?<span id="q\1">(.*?)<span class=disn>sistani\.org/\1</span>', re.S)


def parse_topic(page: str) -> list[dict]:
    items = []
    for ref, body in QA.findall(page):
        q_html, _, rest = body.partition('<div class="b">')
        a_html = rest.rsplit("</div>", 1)[0]
        q = re.sub(r"^السؤال\s*:\s*", "", plain(q_html))
        a = re.sub(r"^الجواب\s*:\s*", "", plain(a_html))
        if q and a:
            items.append({"ref": int(ref), "q": q, "a": a})
    return items


def main() -> None:
    cache = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / ".cache" / "sistani"
    cache.mkdir(parents=True, exist_ok=True)
    tops = topics(cache)
    if len(tops) < 500:
        raise SystemExit(f"الفهرس: {len(tops)} موضوعاً فقط")
    result, missing = [], []
    for i, t in enumerate(tops, 1):
        qa = parse_topic(get(f"/arabic/qa/{t['id']}/", cache))
        if len(qa) != t["count"]:
            missing.append((t["title"], t["count"], len(qa)))
        result.append({"id": t["id"], "title": t["title"], "bab": bab_of(t["title"]), "qa": qa})
        if i % 50 == 0:
            print(f"{i}/{len(tops)}")
    if missing:
        # عدد الأسئلة في الفهرس قد يزيد على ما في صفحة الموضوع نفسها (الفهرس لا يُحدَّث دائماً)؛ الصفحة هي الأصل
        print("مواضيع يختلف عددها في الفهرس عن صفحتها:", missing[:20], f"({len(missing)})")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "marja": "السيد علي الحسيني السيستاني (دام ظله)",
        "source": {"name": "الموقع الرسمي لمكتب سماحة السيد السيستاني: الاستفتاءات", "url": BASE + INDEX, "fetched": time.strftime("%Y-%m-%d")},
        "babs": [{"id": bid, "title": title} for bid, title, _ in BABS],
        "topics": result,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    n = sum(len(t["qa"]) for t in result)
    print(f"{len(result)} موضوعاً، {n} استفتاءً، {OUT.stat().st_size // 1024} ك.ب")


if __name__ == "__main__":
    main()
