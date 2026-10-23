# اختبارات شاملة (متصفح حقيقي)

تتحقق من أمرين لا تكشفهما الاختبارات العادية: **العمل دون إنترنت** و**التحديث التلقائي**.
تحتاج Chrome أو Edge، وبناء إنتاج للموقع بمسار فرعي:

```bash
cd frontend
MSYS_NO_PATHCONV=1 VITE_STATIC=1 VITE_BASE=/tajweed-hafs/ npx vite build --mode web --outDir dist-web
```

## العمل دون إنترنت
يخدم الموقع كما تفعل GitHub Pages، ويفتحه في متصفح جديد، وينتظر حفظه التلقائي، ثم **يغلق الخادم كلياً**
ويجرّب ٢٤ صفحة وميزة (مصحف، تحليل، دروس، مخارج، اختبارات، تسميع، دفتر، لوحة المعلّم، بحث…):

```bash
node tests/e2e/offline_test.mjs "<مسار chrome/msedge>" "<مجلد ملف تعريف مؤقت>" frontend/dist-web
# على الموقع المنشور فعلاً (بلا خادم محلي):
LIVE_ORIGIN=https://ane161h3-png.github.io node tests/e2e/offline_test.mjs "<متصفح>" "<ملف تعريف>" x
```

## التحديث التلقائي
يبني نسختين (A ثم B بمعرّف مختلف)، يحمّل A، ينشر B، فيتحقق أن الجهاز يحدّث نفسه بلا تدخل،
ويُعيد حفظ بياناته، ويبقى يعمل دون إنترنت:

```bash
GITHUB_SHA=aaaaaaaaaaaa1111 VITE_STATIC=1 VITE_BASE=/tajweed-hafs/ npx vite build --mode web --outDir dist-a
GITHUB_SHA=bbbbbbbbbbbb2222 VITE_STATIC=1 VITE_BASE=/tajweed-hafs/ npx vite build --mode web --outDir dist-b   # بعد تعديل أي نص
node tests/e2e/update_test.mjs "<متصفح>" "<ملف تعريف>" frontend/dist-a frontend/dist-b
```
