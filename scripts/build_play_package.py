"""يجهّز «حزمة Google Play» كاملة: ملفات الرفع، صور المتجر، نصوص المتجر، ودليل PDF لرفع أي تطبيق.

  python scripts/build_play_package.py --out google-play-package

ينزّل آخر AAB وAPK من إصدار GitHub، وينسخ صور المتجر من store/google-play،
ويكتب نصوص المتجر والإجابات الجاهزة، ويبني الدليل بمتصفح Chrome/Edge بلا واجهة.
"""
import argparse
import base64
import html
import json
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).parent))
from build_notebook import find_browser  # noqa: E402

REPO = "ane161h3-png/tajweed-hafs"
SITE = "https://ane161h3-png.github.io/tajweed-hafs/"
RELEASE = f"https://github.com/{REPO}/releases/download/app-latest"
PRIVACY = SITE + "privacy.html"
EMAIL = "hydrzyd83@gmail.com"
APP_ID = "com.Hussein.tajweed"
FONTS = ROOT / "frontend" / "node_modules" / "@fontsource"

# ————————————————————————— نصوص المتجر —————————————————————————
AR_NAME = "تعلّم التجويد - رواية حفص"
AR_SHORT = "تعلّم التجويد برواية حفص: مصحف ملوّن، الأحكام، المخارج، الصفات، واختبار بصوتك"
AR_FULL = """تطبيق تعليمي مجاني لتعلّم أحكام التجويد برواية حفص عن عاصم من طريق الشاطبية، بلا إعلانات ولا تسجيل دخول، ويعمل دون إنترنت.

📖 المصحف على هيئة صفحات
• المصحف كاملاً (٦٠٤ صفحة) بالرسم العثماني، ملوّناً بأحكام التجويد.
• في أعلى كل صفحة اسم السورة والجزء والحزب، وفي أسفلها رقم الصفحة.
• اضغط على أي آية: تظهر لوحتها بنصها وأحكامها، واسمعها بصوت القارئ الذي تختاره.
• بحث سريع في نص القرآن، وتصفّح بالسورة أو الجزء أو الصفحة، وعلامات مرجعية.

🔍 تحليل الآية
• لكل آية: أحكامها، ومخارج حروفها (برسم أعضاء النطق)، وصفاتها المتضادة وغير المتضادة.
• اضغط على أي كلمة لتحليلها وحدها.

📝 الأحكام
• دروس مرتّبة كصفحات الدفتر: التعريف لغةً واصطلاحاً، ثم الحروف، ثم الأمثلة من القرآن.
• أحكام النون الساكنة والتنوين، والميم الساكنة، والمدود، والقلقلة، والتفخيم والترقيق، واللامات وغيرها.
• يمكنك إضافة دروس وتعديلها لتناسب حلقتك.

👄 مخارج الحروف وصفاتها
• رسم متحرك لمخرج كل حرف يوضح حركة اللسان والشفتين.
• بطاقة لكل حرف، وجدول الصفات، والفرق بين الحروف المتشابهة.

✅ الاختبارات والتسميع
• أسئلة متدرجة مع مراجعة ذكية للأخطاء.
• «اقرأ بصوتك»: اقرأ المقطع فيتحقق التطبيق من قراءتك ويشرح الصواب.
• «التسميع»: اقرأ سورة كاملة، فينبّهك التطبيق عند كل كلمة خاطئة أو منسية.

📓 دفتري (PDF)
• دفتر مسطّر خاص بك بتعديلاتك وملاحظاتك وفهرس بأرقام الصفحات ورسوم المخارج، تحفظه PDF.

👨‍🏫 المعلّم والطلاب
• يرسل الطالب تقدّمه لمعلّمه، ويتابع المعلّم طلابه ومواضع ضعفهم، ويسجّل الحضور بمسح باركود الطالب.

🔒 الخصوصية
لا يجمع التطبيق أي بيانات شخصية، وكل تقدّمك محفوظ على جهازك فقط.

ملاحظة: التطبيق وسيلة مساعدة، ولا يغني عن التلقي من مقرئ متقن."""
EN_NAME = "Learn Tajweed – Hafs"
EN_SHORT = "Learn Quran tajweed (Hafs): color-coded Mushaf, rules, makharij & voice quizzes"
EN_FULL = """A free app for learning the rules of Quran recitation (tajweed) according to the Hafs ʿan ʿĀṣim narration via al-Shāṭibiyya. No ads, no sign-in, works offline.

• Mushaf as real pages: the full Uthmani text (604 pages) colored by tajweed rule, with surah, juz and hizb at the top and the page number at the bottom.
• Tap any verse to see its rules and listen to it by the reciter you choose.
• Verse analysis: the tajweed rules, makharij (with articulation diagrams) and sifat of any verse or any single word.
• Rules: notebook-style lessons with linguistic and technical definitions and Quranic examples. Add and edit lessons yourself.
• Makharij and sifat: animated diagrams, a card for every letter, comparison tables.
• Quizzes: graded questions with smart review, "Read aloud" (check your recitation by microphone) and "Tasmee" (recite a whole surah; the app alerts you on every wrong or missed word).
• My Notebook: a personal ruled-notebook PDF with your own edits, notes, an index and the makharij drawings.
• Teachers: students share a progress link; teachers track results and weak points and take attendance by scanning a QR card.

Privacy: no personal data is collected; all progress stays on your device.
The app is a learning aid and does not replace learning from a qualified teacher."""
RELEASE_AR = "الإصدار الأول: المصحف بصفحاته، وتحليل الآيات، ودروس الأحكام، والمخارج والصفات، والاختبارات والتسميع، ودفتري، ولوحة المعلّم."
RELEASE_EN = "First release: page-by-page Mushaf, verse analysis, tajweed lessons, makharij and sifat, quizzes and Tasmee, My Notebook, and the teacher dashboard."

DATA_SAFETY = """نموذج «أمان البيانات» (Data safety) لتطبيق «تعلّم التجويد»
=====================================================

السؤال الأول: هل يجمع تطبيقك أو يشارك أي أنواع من بيانات المستخدم المطلوبة؟
  الجواب: لا (No).

لماذا؟
  • لا يوجد خادم للتطبيق؛ كل التقدّم والملاحظات والتعديلات محفوظة على جهاز المستخدم فقط.
  • الميكروفون: يحوّل خدمة التعرّف على الكلام في نظام أندرويد (Google) الصوت إلى نص. التطبيق نفسه
    لا يسجّل الصوت ولا يحفظه ولا يرسله إلى أي جهة.
  • الكاميرا (لمسح باركود الحضور): تُقرأ الصورة على الجهاز نفسه ولا تُحفظ ولا تُرسل.

إن سألك النموذج بالتفصيل عن الصوت: Voice or sound recordings → Collected: No، Shared: No.

الأسئلة التالية في النموذج:
  • هل البيانات مشفّرة أثناء النقل؟ لا ينطبق (لا نقل بيانات).
  • هل يمكن للمستخدم طلب حذف بياناته؟ لا ينطبق؛ يحذفها بحذف التطبيق أو من «الإعدادات ← التقدّم».
  • رابط سياسة الخصوصية: {privacy}
""".format(privacy=PRIVACY)

CONTENT_RATING = """استبيان تصنيف المحتوى (Content rating) لتطبيق «تعلّم التجويد»
==========================================================

البريد: {email}
الفئة (Category): Reference, News, or Educational  (مرجع أو أخبار أو تعليم)

أجب «لا (No)» عن كل الأسئلة التالية:
  • عنف  • محتوى جنسي أو عري  • لغة نابية  • مواد مخدّرة أو كحول أو تبغ
  • مقامرة  • محتوى مخيف  • تفاعل مباشر بين المستخدمين  • مشاركة موقع المستخدم
  • شراء سلع افتراضية عشوائية (Loot boxes)

النتيجة المتوقعة: مناسب لجميع الأعمار (Everyone / 3+).

بقية «إعداد التطبيق»:
  • الجمهور المستهدف: 13–15 و16–17 و18+ (تجنّب «أقل من 13» حتى لا تنطبق سياسة العائلات).
  • الإعلانات: لا يحتوي التطبيق على إعلانات.   • الوصول إلى التطبيق: كل الميزات متاحة بلا تسجيل.
  • تطبيق حكومي: لا.   • ميزات مالية: لا.   • ميزات صحية: لا.   • تطبيق أخبار: لا.
  • التصنيف (Category): Education.   • بريد التواصل: {email}
""".format(email=EMAIL)

LINKS = [
    ("لوحة Google Play Console", "https://play.google.com/console"),
    ("إنشاء حساب مطوّر", "https://play.google.com/console/signup"),
    ("مركز مساعدة Google Play Console (ابحث فيه بعنوان أي مشكلة)", "https://support.google.com/googleplay/android-developer"),
    ("سياسات برنامج المطوّرين", "https://play.google.com/about/developer-content-policy/"),
    ("قسم أمان البيانات (شرح Google)", "https://support.google.com/googleplay/android-developer/answer/10787469"),
    ("تصنيف المحتوى (شرح Google)", "https://support.google.com/googleplay/android-developer/answer/9859655"),
    ("أصول صفحة المتجر: مقاسات الصور (شرح Google)", "https://support.google.com/googleplay/android-developer/answer/9866151"),
    ("التوقيع في Google Play (Play App Signing)", "https://developer.android.com/studio/publish/app-signing#app-signing-google-play"),
    ("متطلبات الإصدار المستهدف من أندرويد (Target API)", "https://developer.android.com/google/play/requirements/target-sdk"),
]
APP_LINKS = [
    ("التطبيق على الويب (يعمل على كل الأجهزة)", SITE),
    ("ملف الرفع إلى Google Play (AAB)", f"{RELEASE}/tajweed-hafs.aab"),
    ("ملف التثبيت المباشر على أندرويد (APK)", f"{RELEASE}/tajweed-hafs.apk"),
    ("سياسة الخصوصية (أدخلها في Play Console)", PRIVACY),
    ("كل إصدارات التطبيق على GitHub", f"https://github.com/{REPO}/releases"),
    ("كود المشروع على GitHub", f"https://github.com/{REPO}"),
]


def esc(s):
    return html.escape(str(s), quote=False)


def link(url, label=None):
    return f'<a href="{html.escape(url)}"><span dir="ltr">{esc(label or url)}</span></a>'


# ————————————————————————— محتوى الدليل —————————————————————————
def box(kind, title, text):
    icons = {"tip": "💡", "warn": "⚠️", "note": "ℹ️"}
    return f'<div class="box {kind}"><b>{icons[kind]} {esc(title)}</b><p>{text}</p></div>'


def steps(items):
    return "<ol class='steps'>" + "".join(f"<li>{x}</li>" for x in items) + "</ol>"


def table(head, rows, cls=""):
    th = "".join(f"<th>{esc(h)}</th>" for h in head)
    tr = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f"<table class='{cls}'><tr>{th}</tr>{tr}</table>"


def checklist(items):
    return "<ul class='check'>" + "".join(f"<li>{x}</li>" for x in items) + "</ul>"


def chapters():
    c = []

    c.append(("١", "ما الذي تحتاجه قبل البدء؟", f"""
<p>رفع أي تطبيق إلى Google Play يمر بمراحل ثابتة. جهّز هذه الأشياء أولاً، فكل واحد منها سبب شائع لتأخّر النشر:</p>
{checklist([
    "<b>حساب مطوّر</b> مدفوع (٢٥ دولاراً مرة واحدة) <b>أكملتَ توثيق هويته</b> وتأكيد رقم الهاتف. حساب واحد ينشر فيه عدداً غير محدود من التطبيقات.",
    "<b>ملف AAB</b> موقّع بمفتاح رفع (وليس APK). في هذه الحزمة: <span dir='ltr'>tajweed-hafs.aab</span>.",
    "<b>معرّف التطبيق (Package name)</b> فريد وثابت لا يتغيّر أبداً بعد النشر. لتطبيقنا: <span dir='ltr'>" + APP_ID + "</span>.",
    "<b>صور المتجر:</b> أيقونة ٥١٢×٥١٢، ورسم مميّز ١٠٢٤×٥٠٠، ولقطات شاشة للهاتف (٢ إلى ٨، نسبة ٩:١٦). كلها جاهزة في المجلد <span dir='ltr'>2-images</span>.",
    "<b>نصوص المتجر:</b> الاسم (٣٠ حرفاً)، ووصف قصير (٨٠ حرفاً)، ووصف كامل (٤٠٠٠ حرف). جاهزة بالعربية والإنجليزية في <span dir='ltr'>3-texts</span>.",
    "<b>رابط سياسة خصوصية</b> يفتحه أي شخص دون تسجيل دخول: " + link(PRIVACY) + ".",
    "<b>١٢ مختبِراً أو أكثر</b> (حسابات Gmail لأشخاص عندهم هواتف أندرويد) إن كان حسابك شخصياً وجديداً، وسيبقون مشتركين ١٤ يوماً متواصلة (انظر الفصل ٧).",
])}
"""))

    c.append(("٢", "فهم الملفات: AAB وAPK والمفاتيح", f"""
{table(["الملف", "ما هو", "متى تستعمله"], [
    ["<b>AAB</b> (حزمة التطبيق)", "الملف الذي <b>ترفعه إلى Google Play</b>. تولّد Google منه ملفاً مناسباً لكل جهاز، فيصغر حجم التنزيل.", "الرفع إلى Play Console فقط."],
    ["<b>APK</b>", "ملف تثبيت يعمل مباشرة على هاتف أندرويد.", "التثبيت المباشر خارج المتجر، أو إرساله لصديق."],
])}
<h3>المفاتيح (مهم جداً)</h3>
{table(["المفتاح", "من يحتفظ به", "ماذا يفعل"], [
    ["<b>مفتاح الرفع</b> (Upload key)", "<b>أنت.</b> الملف <span dir='ltr'>upload.p12</span> مع كلمة سره.", "توقّع به كل AAB ترفعه، فتعرف Google أنه منك."],
    ["<b>مفتاح توقيع التطبيق</b> (App signing key)", "<b>Google</b> (عبر Play App Signing).", "يوقّع به التطبيق النهائي الذي يصل المستخدمين."],
])}
{box("warn", "احفظ مفتاح الرفع", "انسخ ملف مفتاح الرفع وكلمة سره إلى مكان آمن (فلاشة أو تخزين سحابي خاص). لو ضاع تستطيع طلب إعادة تعيينه من دعم Google، لكنه يؤخّر أي تحديث.")}
<h3>أرقام الإصدار</h3>
<ul>
<li><b>versionCode:</b> رقم صحيح يجب أن يكون <b>أعلى</b> في كل رفع جديد (يُرفض الرفع إن تكرّر). في مشروعنا يرتفع تلقائياً مع كل بناء على GitHub.</li>
<li><b>versionName:</b> نص يراه المستخدم (مثل 1.0.21).</li>
</ul>
{box("note", "التثبيت المباشر لا يتحدّث من المتجر", "من ثبّت ملف APK مباشرة لا يستطيع تحديث التطبيق من Google Play لأن مفتاح التوقيع مختلف؛ عليه حذف النسخة القديمة وتثبيت نسخة المتجر. حذف التطبيق يمسح تقدّمه المحفوظ.")}
"""))

    c.append(("٣", "تأكيد الحساب والهوية", f"""
<p>لا تستطيع نشر شيء قبل أن يصبح حسابك «موثَّقاً». افتح {link("https://play.google.com/console")} بحساب المطوّر ({EMAIL}) وانظر في صفحة <b>الرئيسية (Home)</b>:</p>
{table(["الحالة التي تراها", "معناها", "ماذا تفعل"], [
    ["«تعمل Google على إثبات هويتك» (أيقونة ساعة)", "وصلت المستندات والمراجعة جارية.", "انتظر (من ساعات إلى بضعة أيام). تصلك رسالة على بريد الحساب."],
    ["«الإجراء المطلوب»", "رفضت Google الصورة أو طلبت شيئاً.", "اقرأ السبب وأعد رفع مستند أوضح، واسم الحساب مطابق للهوية."],
    ["«تم التحقق»", "وافقت Google.", "أكمل خطوة رقم الهاتف أدناه ثم أنشئ التطبيق."],
])}
{steps([
    "اضغط <b>«الانتقال إلى تفاصيل الحساب»</b> (يتفعّل بعد موافقة الهوية).",
    "أمام <b>رقم الهاتف المخصّص للتواصل</b> اضغط <b>تأكيد</b>، واكتبه بالصيغة الدولية (<span dir='ltr'>+964 7XX XXX XXXX</span>).",
    "اختر استلام الرمز برسالة <b>SMS</b> أو مكالمة، واكتب الرمز الذي يصلك.",
    "إن طلبت Google تثبيت تطبيق <b>Google Play Console</b> على هاتف أندرويد وتسجيل الدخول فيه بالحساب نفسه، فافعل (هذا جزء من «التحقق من مطوّري أندرويد»).",
])}
{box("tip", "رموز التحقق لك وحدك", "رمز SMS ورمز التحقق بخطوتين لا يُعطى لأي شخص أو برنامج. اكتبه أنت بنفسك.")}
"""))

    c.append(("٤", "إنشاء التطبيق في Play Console", f"""
{steps([
    "من الرئيسية اضغط <b>Create app (إنشاء تطبيق)</b>.",
    "<b>App name:</b> الاسم الذي يراه الناس (حتى ٣٠ حرفاً). لتطبيقنا: <b>{esc(AR_NAME)}</b>.",
    "<b>Default language:</b> العربية (<span dir='ltr'>Arabic – ar</span>).",
    "<b>App or game:</b> App. و<b>Free or paid:</b> Free.",
    "ضع علامة على الإقرارين في الأسفل (سياسات المطوّرين، وقوانين التصدير الأمريكية)، ثم <b>Create app</b>.",
])}
{box("warn", "التطبيق المجاني لا يصبح مدفوعاً", "اختيار «Free» نهائي: لا يمكن تحويل تطبيق منشور مجاناً إلى مدفوع لاحقاً. لكن يمكنك دائماً إضافة <b>اشتراكات أو مشتريات داخل التطبيق</b>.")}
<p>يُنشأ معرّف الحزمة (<span dir='ltr'>Package name</span>) تلقائياً عند أول رفع ملف AAB، ويؤخذ من الملف نفسه، فتأكد أنه <span dir='ltr'>{APP_ID}</span>.</p>
"""))

    c.append(("٥", "إعداد التطبيق (Set up your app)", f"""
<p>في الرئيسية قائمة مهام باسم <b>Set up your app</b>. أكمل كل بند فيها. هذه إجابات تطبيق «تعلّم التجويد» (ويمكنك أخذها نموذجاً لتطبيقات مشابهة):</p>
{table(["البند", "الإجابة"], [
    ["Privacy policy", link(PRIVACY)],
    ["App access", "كل الوظائف متاحة بلا حساب ولا تسجيل دخول (All functionality is available without special access)."],
    ["Ads", "لا يحتوي على إعلانات (No, my app does not contain ads)."],
    ["Content rating", "الفئة <span dir='ltr'>Reference, News, or Educational</span> وكل الأسئلة «لا». النتيجة: مناسب للجميع."],
    ["Target audience", "13–15، 16–17، 18+ (لا تختر «أقل من 13» لتجنّب سياسة العائلات)."],
    ["News app", "لا."],
    ["Data safety", "لا يجمع التطبيق ولا يشارك بيانات (التفاصيل في الملف <span dir='ltr'>3-texts/data-safety.txt</span>)."],
    ["Government app", "لا."],
    ["Financial features", "لا توجد ميزات مالية."],
    ["Health", "لا توجد ميزات صحية."],
    ["App category", "Education (تعليم)."],
    ["Contact details", EMAIL],
])}
{box("note", "عن الأذونات", "التطبيق يطلب <b>الميكروفون</b> (لـ«اقرأ بصوتك» والتسميع) و<b>الكاميرا</b> (لمسح باركود الحضور) و<b>الإنترنت</b>. كلها أذونات عادية تُطلب من المستخدم وقت الاستعمال، ولا تحتاج نماذج إعلان خاصة. اشرح استعمالها في وصف المتجر وسياسة الخصوصية (فعلنا).")}
"""))

    c.append(("٦", "صفحة المتجر (Main store listing)", f"""
<p>من القائمة: <b>Grow users ← Store presence ← Main store listing</b> (أو «نمو المستخدمين ← حضور المتجر»).</p>
{table(["الحقل", "الحد", "ماذا تضع"], [
    ["App name", "٣٠ حرفاً", esc(AR_NAME)],
    ["Short description", "٨٠ حرفاً", esc(AR_SHORT)],
    ["Full description", "٤٠٠٠ حرف", "الصق النص الكامل من الملف <span dir='ltr'>3-texts/store-ar.txt</span>."],
    ["App icon", "PNG ٥١٢×٥١٢ (≤ ١ م.ب)", "<span dir='ltr'>2-images/icon-512.png</span>"],
    ["Feature graphic", "١٠٢٤×٥٠٠", "<span dir='ltr'>2-images/feature-graphic.png</span>"],
    ["Phone screenshots", "٢–٨ لقطات، ٩:١٦، كل ضلع بين ٣٢٠ و٣٨٤٠", "المجلد <span dir='ltr'>2-images/screenshots</span> (٨ لقطات ١٠٨٠×١٩٢٠)."],
])}
<h3>إضافة لغة ثانية (اختياري)</h3>
{steps([
    "اضغط <b>Add translation</b> واختر <span dir='ltr'>English – en-US</span>.",
    "الصق الاسم والوصفين من <span dir='ltr'>3-texts/store-en.txt</span> (الاسم: " + esc(EN_NAME) + ").",
])}
<h3>إعدادات المتجر (Store settings)</h3>
<p>اختر الفئة <b>Education</b>، وبريد التواصل، واترك الموقع الإلكتروني فارغاً أو 
{box("tip", "لقطات الشاشة", "أفضل اللقطات ما يُظهر الميزة الأهم أولاً. رتّبنا لقطاتنا هكذا: الرئيسية، المصحف بصفحاته، لوحة الآية، تحليل الآية، المخارج، الدروس، التسميع، الدفتر.")}
"""))

    c.append(("٧", "الاختبار المغلق (١٢ مختبِراً × ١٤ يوماً)", f"""
{box("warn", "شرط للحسابات الشخصية الجديدة", "إن كان حسابك شخصياً وأُنشئ بعد نوفمبر ٢٠٢٣، تشترط Google لإتاحة النشر للجميع <b>اختباراً مغلقاً بـ ١٢ مختبِراً على الأقل، متواصلاً ١٤ يوماً</b>. العدّاد يظهر في الرئيسية. الشرط يخص كل تطبيق جديد (وليس الحساب كله).")}
<h3>١. اجمع المختبرين</h3>
<p>اكتب قائمة بـ <b>١٢–١٥ حساب Gmail</b> لأشخاص يملكون هواتف أندرويد (الأهل، الأصدقاء، طلاب الحلقة). يجب أن يبقوا مشتركين طوال المدة، ولا يكفي أن يثبّتوا ثم يحذفوا.</p>
<h3>٢. أنشئ المسار وارفع الملف</h3>
{steps([
    "<b>Test and release ← Testing ← Closed testing</b> ثم <b>Create track</b> (أو استعمل المسار الجاهز Closed testing – Alpha).",
    "تبويب <b>Testers</b>: <b>Create email list</b>، سمِّها وألصق عناوين Gmail (واحد في كل سطر)، ثم احفظ.",
    "تبويب <b>Countries/regions</b>: اختر الدول (مثل العراق وبقية الدول العربية).",
    "اضغط <b>Create new release</b>. عند أول مرة اختر <b>Use Google-generated key</b> (تفعيل Play App Signing).",
    "في <b>App bundles</b> ارفع <span dir='ltr'>tajweed-hafs.aab</span> (اسحبه وأفلته).",
    "اكتب <b>Release notes</b> (انظر <span dir='ltr'>3-texts/release-notes.txt</span>).",
    "<b>Next ← Save ← Go to overview ← Send changes for review</b> (أو Start rollout to Closed testing). تراجع Google الإصدار، وتستغرق عادةً من ساعات إلى يومين.",
])}
<h3>٣. ادعُ المختبرين</h3>
{steps([
    "بعد القبول افتح تبويب <b>Testers</b> وانسخ <b>رابط الاشتراك</b> (Join on the web).",
    "أرسل الرابط لكل مختبِر: يفتحه من هاتفه بحسابه، ويضغط <b>Become a tester</b>، ثم يثبّت التطبيق من Google Play.",
    "تابع العدّاد في الرئيسية؛ بعد اكتمال ١٤ يوماً يظهر زر <b>Apply for production</b>.",
])}
{box("tip", "استعمل المختبرين نفسهم لكل تطبيقاتك", "إن كان عندك تطبيق ثانٍ (مثل نظام الديون) فاجمع التطبيقين في الفترة نفسها واطلب من المختبرين الاشتراك في الاثنين.")}
"""))

    c.append(("٨", "النشر للجميع (Production)", f"""
{steps([
    "في الرئيسية اضغط <b>Apply for production</b> وأجب عن أسئلة Google (كيف اختبرتم، وما الملاحظات، وهل التطبيق جاهز). تراجع Google الطلب، وقد تستغرق حتى أسبوع.",
    "بعد القبول: <b>Test and release ← Production ← Create new release</b>.",
    "اضغط <b>Add from library</b> واختر الـ AAB نفسه (أو ارفع الأحدث)، واكتب ملاحظات الإصدار.",
    "<b>Countries/regions:</b> أضف كل الدول المطلوبة.",
    "<b>Next ← Save ← Send changes for review</b>. تراجع Google التطبيق (من يوم إلى بضعة أيام، وللتطبيقات الجديدة قد يطول).",
    "عند الموافقة ينشر Play Console التطبيق، ويظهر رابطه في <b>Store presence ← Store listing ← View on Google Play</b>.",
])}
"""))

    c.append(("٩", "التحديثات بعد النشر", f"""
{table(["نوع التحديث", "كيف يصل المستخدمين", "هل تحتاج رفعاً إلى Play؟"], [
    ["محتوى وتصميم وميزات الويب (دروس، مصحف، بحث…)", "تلقائياً بلا أي تثبيت: التطبيق يفتح الموقع المنشور ويتحدّث وحده.", "<b>لا.</b>"],
    ["تغيير في ملف أندرويد نفسه (إذن جديد، إضافة أصلية)", "عبر تحديث من Google Play.", "<b>نعم:</b> ارفع AAB جديداً في Production."],
])}
<p>لرفع إصدار جديد: نزّل أحدث AAB من {link(RELEASE + "/tajweed-hafs.aab")} (يُبنى تلقائياً مع كل تعديل برقم <span dir='ltr'>versionCode</span> أعلى)، ثم <b>Production ← Create new release</b> وارفعه.</p>
{box("tip", "ملاحظات الإصدار", "اكتب في كل إصدار سطراً واضحاً بالجديد؛ يراه المستخدمون في صفحة المتجر.")}
"""))

    c.append(("١٠", "رفع أي تطبيق آخر (مثل «نظام الديون»)", f"""
<p>الحساب نفسه ينشر عدداً غير محدود من التطبيقات بلا رسوم إضافية. لكل تطبيق جديد كرّر الفصول ٤ إلى ٨، مع هذه الفروق:</p>
{checklist([
    "<b>معرّف حزمة جديد وفريد</b> (مثل <span dir='ltr'>app.debts.manager</span>) في <span dir='ltr'>capacitor.config.json</span> و<span dir='ltr'>build.gradle</span>. لا يتغيّر بعد النشر.",
    "<b>مفتاح رفع خاص بالتطبيق</b> (يُنصح بمفتاح لكل تطبيق). تولّده مرة واحدة وتحفظه مع كلمة سره.",
    "<b>ملف AAB موقّع</b> من مشروع Capacitor: <span dir='ltr'>npx cap sync android</span> ثم <span dir='ltr'>./gradlew bundleRelease</span>.",
    "<b>سياسة خصوصية</b> خاصة بالتطبيق على رابط عام.",
    "<b>أيقونة ورسم مميّز ولقطات ونصوص</b> للتطبيق الجديد.",
    "<b>اختبار مغلق جديد</b> (١٢ مختبِراً × ١٤ يوماً) إن كان حسابك شخصياً جديداً.",
])}
<h3>كيف بنينا AAB لهذا التطبيق (قالب تنسخه)</h3>
{steps([
    "<b>مفتاح الرفع:</b> أنشأناه بـ <span dir='ltr'>openssl</span> (صيغة PKCS12، الاسم المستعار <span dir='ltr'>upload</span>، صلاحية ٣٠ سنة) وحفظناه في <span dir='ltr'>signing/upload.p12</span> (غير مرفوع إلى GitHub).",
    "<b>أسرار المستودع:</b> في GitHub ← Settings ← Secrets ← Actions أضفنا <span dir='ltr'>ANDROID_UPLOAD_KEYSTORE</span> (الملف بصيغة base64) و<span dir='ltr'>ANDROID_UPLOAD_PASSWORD</span>.",
    "<b>ملف التوقيع:</b> في <span dir='ltr'>frontend/android/app/build.gradle</span> قسم <span dir='ltr'>signingConfigs.upload</span> يقرأ المفتاح وكلمة السر من متغيّرات البيئة، و<span dir='ltr'>buildTypes.release</span> يستعمله.",
    "<b>سير العمل:</b> الملف <span dir='ltr'>.github/workflows/android.yml</span> يبني الواجهة، ويحدّث <span dir='ltr'>versionCode</span> برقم التشغيل، ثم ينفّذ <span dir='ltr'>bundleRelease</span> وينشر الـ AAB والـ APK في إصدار <span dir='ltr'>app-latest</span>.",
])}
<h3>تطبيق مالي مثل «نظام الديون»: انتبه</h3>
{checklist([
    "Google صارمة مع تطبيقات القروض. صِف التطبيق بأنه <b>دفتر حسابات لتسجيل ديون الزبائن</b> ولا يقدّم قروضاً ولا يتعامل بالمال، وتجنّب كلمات «قرض» و«تمويل» و«سلفة» في الاسم والوصف.",
    "في بند <b>Financial features</b> اختر «لا توجد ميزات مالية» إن كان مجرد دفتر، وإلا فعبّئ الإقرار المناسب بصدق.",
    "إن كان يحفظ <b>أسماء الزبائن وهواتفهم على خادم أو في السحابة</b> فعليك التصريح بذلك في <b>Data safety</b> (جمع بيانات شخصية، وهل هي مشفّرة أثناء النقل) وفي سياسة الخصوصية.",
    "إن كان في التطبيق <b>حسابات مستخدمين</b> فسياسة Google توجب وسيلة لحذف الحساب داخل التطبيق ورابطاً على الويب لطلب الحذف.",
    "إن كان يبيع اشتراكاً فالدفع داخل التطبيق يجب أن يمر عبر <b>Google Play Billing</b>.",
])}
"""))

    c.append(("١١", "الأخطاء الشائعة وحلولها", f"""
{table(["الرسالة أو المشكلة", "السبب", "الحل"], [
    ["«You uploaded an APK. Use an Android App Bundle»", "رفعتَ APK.", "ارفع ملف <b>.aab</b>."],
    ["«Version code X has already been used»", "رقم الإصدار مكرّر.", "ارفع بناءً أحدث (يرتفع <span dir='ltr'>versionCode</span> تلقائياً في مشروعنا)."],
    ["«Package name already exists / already in use»", "المعرّف مستعمل في حساب آخر.", "اختر معرّفاً فريداً قبل أول رفع."],
    ["«The Android App Bundle was signed with the wrong key»", "وقّعتَ بمفتاح غير مفتاح الرفع المسجّل.", "استعمل مفتاح الرفع نفسه دائماً، أو اطلب إعادة تعيينه."],
    ["«Your app targets an old API level»", "الإصدار المستهدف قديم.", "ارفع <span dir='ltr'>targetSdkVersion</span> (تطبيقنا مستهدف ٣٦)."],
    ["رفض بسبب سياسة الخصوصية", "الرابط لا يعمل أو لا يذكر الأذونات.", "تأكد أن الرابط يفتح بلا تسجيل، ويشرح الميكروفون والكاميرا وما يُخزَّن."],
    ["رفض: «Data safety mismatch»", "إجابات النموذج لا تطابق ما يفعله التطبيق.", "أعد النموذج بصدق: ما يُرسَل إلى خادم يجب التصريح به."],
    ["الزر «Send for review» معطّل", "بند في «Set up your app» ناقص.", "افتح الرئيسية وأكمل كل البنود التي عليها علامة تحذير."],
    ["لا يظهر التطبيق في البحث بعد النشر", "الفهرسة تحتاج وقتاً.", "انتظر ٢٤–٤٨ ساعة؛ استعمل رابط المتجر المباشر في الأثناء."],
])}
"""))

    c.append(("١٢", "الروابط المباشرة", f"""
<h3>التطبيق وملفاته</h3>
{table(["", "الرابط"], [[esc(a), link(b)] for a, b in APP_LINKS], "links")}
<h3>Google Play ومراجع مفيدة</h3>
{table(["", "الرابط"], [[esc(a), link(b)] for a, b in LINKS], "links")}
{box("note", "عن روابط مركز المساعدة", "تنقل Google صفحات مساعدتها أحياناً. إن لم يفتح رابط فابحث في مركز المساعدة بعنوان الموضوع (مثل: <span dir='ltr'>Data safety section</span> أو <span dir='ltr'>Testing requirements for new personal developer accounts</span>).")}
"""))

    c.append(("١٣", "ملحق: ما تحويه هذه الحزمة", f"""
{table(["المجلد/الملف", "المحتوى"], [
    ["<span dir='ltr'>1-upload/</span>", "<span dir='ltr'>tajweed-hafs.aab</span> للرفع إلى Google Play، و<span dir='ltr'>tajweed-hafs.apk</span> للتثبيت المباشر."],
    ["<span dir='ltr'>2-images/</span>", "الأيقونة، والرسم المميّز، و٨ لقطات شاشة ١٠٨٠×١٩٢٠."],
    ["<span dir='ltr'>3-texts/</span>", "نصوص المتجر بالعربية والإنجليزية، وملاحظات الإصدار، وإجابات أمان البيانات وتصنيف المحتوى."],
    ["<span dir='ltr'>LINKS.txt</span>", "الروابط المباشرة كلها في ملف نصي."],
    ["هذا الدليل", "كيف ترفع أي تطبيق على Google Play، خطوة بخطوة."],
])}
<p>تاريخ إعداد الحزمة: {date.today().strftime('%Y-%m-%d')}. إصدار التطبيق: <span dir='ltr'>1.0.x</span> (أحدث بناء على GitHub).</p>
"""))
    return c


CSS = """
@page { size: A4; margin: 18mm 16mm; @bottom-center { content: counter(page, arabic-indic); font: 10pt 'Plex'; color: #7a8a86 } }
@page :first { margin: 0; @bottom-center { content: none } }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact }
html { font-family: 'Plex', sans-serif; color: #1d2a2c; font-size: 11pt; line-height: 1.85 }
body { margin: 0; direction: rtl }
a { color: #1f6f5c; text-decoration: none; word-break: break-all }
h1,h2,h3 { margin: 0; font-weight: 700; break-after: avoid }
.cover { height: 297mm; background: #14574a; color: #f7f1dc; position: relative; break-after: page; text-align: center }
.cover .f1 { position: absolute; inset: 9mm; border: 1.2pt solid #d9b45f; border-radius: 3mm }
.cover .f2 { position: absolute; inset: 12mm; border: .5pt solid #d9b45f88; border-radius: 2mm }
.cover .in { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8mm; padding: 0 24mm }
.cover .tag { font-size: 14pt; color: #e9cf8b }
.cover h1 { font-size: 36pt; line-height: 1.4; color: #fff8e3 }
.cover p { font-size: 14pt; color: #e9dcb4; max-width: 140mm; margin: 0 }
.cover .gold { width: 60mm; height: 1.2pt; background: linear-gradient(90deg, transparent, #d9b45f, transparent) }
.cover .foot { position: absolute; bottom: 20mm; left: 0; right: 0; font-size: 10pt; color: #cbbf94 }
.toc { break-after: page }
.toc h2 { font-size: 22pt; color: #14574a; margin-bottom: 6mm; border-bottom: 1.5pt solid #d9b45f; padding-bottom: 2mm }
.toc ol { list-style: none; padding: 0; margin: 0 }
.toc li { display: flex; gap: 4mm; padding: 1.5mm 0; border-bottom: .5pt dotted #b9c7c0; font-size: 12.5pt }
.toc li b { min-width: 9mm; color: #9b2f2f }
.toc .tip { margin-top: 8mm; font-size: 10.5pt; color: #4a4636; background: #f4efdc; border-right: 3pt solid #d9b45f; padding: 3mm 4mm; border-radius: 1.5mm }
.chapter { break-before: page }
.chapter h2 { display: flex; align-items: center; gap: 4mm; font-size: 20pt; color: #14574a; border-bottom: 1.5pt solid #d9b45f; padding-bottom: 2mm; margin-bottom: 4mm }
.chapter h2 span { display: inline-grid; place-items: center; min-width: 11mm; height: 11mm; border-radius: 6mm; background: #1f6f5c; color: #fff; font-size: 13pt; padding: 0 2mm }
h3 { font-size: 13.5pt; color: #9b2f2f; margin: 5mm 0 1.5mm }
p { margin: 0 0 2mm }
ul, ol { margin: 1mm 0 2mm; padding-right: 7mm }
li { margin-bottom: 1.2mm }
.steps { counter-reset: s; list-style: none; padding: 0 }
.steps li { counter-increment: s; position: relative; padding: 2mm 11mm 2mm 3mm; margin-bottom: 2mm; background: #f3f8f6; border-radius: 2mm; break-inside: avoid }
.steps li::before { content: counter(s, arabic-indic); position: absolute; right: 2mm; top: 2mm; width: 7mm; height: 7mm; line-height: 7mm; text-align: center; border-radius: 50%; background: #1f6f5c; color: #fff; font-weight: 700; font-size: 10pt }
.check { list-style: none; padding: 0 }
.check li { padding-right: 8mm; position: relative; break-inside: avoid }
.check li::before { content: '☐'; position: absolute; right: 0; color: #1f6f5c; font-size: 13pt }
table { width: 100%; border-collapse: collapse; margin: 2mm 0 3mm; font-size: 10.5pt }
th { background: #1f6f5c; color: #fff; padding: 1.5mm 2.5mm; text-align: right; font-weight: 700 }
td { border: .5pt solid #cfd9d3; padding: 1.5mm 2.5mm; vertical-align: top }
tr { break-inside: avoid }
tr:nth-child(even) td { background: #f6f9f7 }
.links td:first-child { width: 42% }
.box { margin: 3mm 0; padding: 2.5mm 4mm; border-radius: 2mm; break-inside: avoid; border-right: 3pt solid }
.box p { margin: .5mm 0 0 }
.box.tip { background: #eaf6ef; border-color: #2e9d6a }
.box.warn { background: #fdf0e3; border-color: #d98a2b }
.box.note { background: #eaf1fb; border-color: #3b79c9 }
"""


def font_face(family, weight, path):
    b64 = base64.b64encode(Path(path).read_bytes()).decode()
    return f"@font-face{{font-family:'{family}';font-weight:{weight};src:url(data:font/woff2;base64,{b64}) format('woff2')}}"


def guide_html():
    ch = chapters()
    faces = font_face("Plex", 400, FONTS / "ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-400-normal.woff2") + font_face(
        "Plex", 700, FONTS / "ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-700-normal.woff2"
    )
    toc = "".join(f"<li><b>{n}</b><span>{esc(t)}</span></li>" for n, t, _ in ch)
    body = "".join(f"<section class='chapter'><h2><span>{n}</span>{esc(t)}</h2>{b}</section>" for n, t, b in ch)
    return f"""<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>دليل رفع أي تطبيق على Google Play</title><style>{faces}{CSS}</style></head><body>
<section class="cover"><div class="f1"></div><div class="f2"></div><div class="in">
<div class="tag">دليل عملي بالعربية</div><div class="gold"></div>
<h1>رفع أي تطبيق<br>على Google Play</h1>
<p>خطوة بخطوة، من تأكيد حساب المطوّر إلى النشر والتحديثات، مع ملفات تطبيق «تعلّم التجويد» جاهزة للرفع وروابط مباشرة.</p>
<div class="gold"></div></div><div class="foot">{date.today().strftime('%Y-%m-%d')}</div></section>
<section class="toc"><h2>المحتويات</h2><ol>{toc}</ol>
<div class="tip"><b>كيف تستعمل هذا الدليل:</b> إن كنت ترفع «تعلّم التجويد» فاتبع الفصول بالترتيب (٣ ثم ٤ ثم ٥ ثم ٦ ثم ٧ ثم ٨) فكل ما تحتاجه جاهز في الحزمة. وإن كنت ترفع تطبيقاً آخر فالفصل ١٠ يلخّص الفروق.</div></section>
{body}</body></html>"""


# ————————————————————————— تجميع الحزمة —————————————————————————
def write_text(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("﻿" + text.strip() + "\n", encoding="utf-8")  # BOM ليفتح بالعربية في المفكرة


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "tajweed-package"})
    with urllib.request.urlopen(req) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r, f)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--no-download", action="store_true")
    a = ap.parse_args()
    out = Path(a.out).resolve()
    if out.exists():
        shutil.rmtree(out)
    (out / "1-upload").mkdir(parents=True)
    store = ROOT / "store" / "google-play"

    if not a.no_download:
        for name in ("tajweed-hafs.aab", "tajweed-hafs.apk"):
            download(f"{RELEASE}/{name}", out / "1-upload" / name)
    img = out / "2-images"
    img.mkdir()
    shutil.copy(store / "icon-512.png", img / "icon-512.png")
    shutil.copy(store / "feature-graphic.png", img / "feature-graphic.png")
    (img / "screenshots").mkdir()
    for p in sorted((store / "new-shots").glob("*.png")):
        shutil.copy(p, img / "screenshots" / p.name)

    t = out / "3-texts"
    write_text(t / "store-ar.txt", f"الاسم ({len(AR_NAME)} حرفاً من ٣٠):\n{AR_NAME}\n\nالوصف القصير ({len(AR_SHORT)} حرفاً من ٨٠):\n{AR_SHORT}\n\nالوصف الكامل ({len(AR_FULL)} حرفاً من ٤٠٠٠):\n{AR_FULL}")
    write_text(t / "store-en.txt", f"Name ({len(EN_NAME)}/30):\n{EN_NAME}\n\nShort description ({len(EN_SHORT)}/80):\n{EN_SHORT}\n\nFull description ({len(EN_FULL)}/4000):\n{EN_FULL}")
    write_text(t / "release-notes.txt", f"ملاحظات الإصدار (عربي):\n{RELEASE_AR}\n\nRelease notes (English):\n{RELEASE_EN}")
    write_text(t / "data-safety.txt", DATA_SAFETY)
    write_text(t / "content-rating.txt", CONTENT_RATING)
    assert len(AR_NAME) <= 30 and len(AR_SHORT) <= 80 and len(AR_FULL) <= 4000 and len(EN_NAME) <= 30 and len(EN_SHORT) <= 80 and len(EN_FULL) <= 4000

    links = "روابط مباشرة\n============\n\nالتطبيق وملفاته:\n" + "\n".join(f"  {x}\n    {y}" for x, y in APP_LINKS) + "\n\nGoogle Play ومراجع:\n" + "\n".join(f"  {x}\n    {y}" for x, y in LINKS)
    write_text(out / "LINKS.txt", links)

    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "guide.html"
        src.write_text(guide_html(), encoding="utf-8")
        pdf = out / "GUIDE-Google-Play.pdf"
        r = subprocess.run([find_browser(), "--headless=new", "--disable-gpu", "--no-sandbox", f"--user-data-dir={tmp}/p", "--no-pdf-header-footer", "--generate-pdf-document-outline", "--virtual-time-budget=15000", f"--print-to-pdf={pdf}", src.as_uri()], capture_output=True, text=True, timeout=180)
    if not pdf.exists() or pdf.stat().st_size < 20_000:
        sys.exit(f"فشل بناء PDF: {r.stderr[-400:]}")
    print(f"✓ {out}\n  PDF: {pdf.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
