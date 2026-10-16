# رسوم مخارج الحروف

ثلاثة ملفات SVG يُدرجها البرنامج كما هي، ثم يحرّك أجزاءها ويظلّلها بمعرّفاتها (`id`).
يمكن لمصمم أن يستبدلها برسوم أدق **بشرط الحفاظ على المعرّفات أدناه**.

الرسوم الحالية مولّدة من `scripts/make_makharij_svg.py`. إن عدّلتها يدوياً فلا تشغّل السكربت بعد ذلك،
أو عدّل السكربت نفسه ثم شغّله:

```bash
python scripts/make_makharij_svg.py
```

## head-sagittal.svg: المقطع الجانبي

### الأعضاء (تُظلَّل بإضافة الصنف `on`)

| المعرّف | العضو |
|---|---|
| `head` | حدود الرأس |
| `nasal` | تجويف الأنف |
| `khayshum` | الخيشوم |
| `hard-palate` / `soft-palate` / `uvula` | الحنك الصلب، الحنك اللين، اللهاة |
| `upper-lip` / `lower-lip` | الشفتان (تتحركان) |
| `upper-teeth` / `lower-teeth` | الثنايا العليا والسفلى |
| `gum` / `lower-gum` | لثة الأسنان العليا والسفلى |
| `molars` | الأضراس العليا (منقّطة لأنها جانبية) |
| `tongue` | اللسان (يتحرك) |
| `jawf` | منطقة الجوف (تُملأ عند التظليل) |
| `halq-aqsa` / `halq-wasat` / `halq-adna` | أقصى الحلق ووسطه وأدناه |
| `larynx` / `vocal-folds` / `trachea` / `epiglottis` | الحنجرة والوتران والقصبة ولسان المزمار |
| `cavity` | تجويف الفم والحلق (خلفية) |

أجزاء اللسان (`tongue-tip`, `tongue-middle`, `tongue-back`, `tongue-edge`) لا تُرسم مسارات منفصلة،
بل تُحسب مواضعها من مسار اللسان الحالي وتُرسم عليه نقاطاً مضيئة.

### أوضاع الحركة (داخل `<defs>`، لا تُعرض)

- اللسان: `tongue--rest`, `tongue--qaf`, `tongue--kaf`, `tongue--wasat`, `tongue--dad`, `tongue--lam`, `tongue--noon`,
  `tongue--ra`, `tongue--nit`, `tongue--nit-itbaq`, `tongue--asal`, `tongue--asal-itbaq`, `tongue--lithah`,
  `tongue--lithah-itbaq`, `tongue--istila`.
- الشفتان: `upper-lip--rest|closed|round`، `lower-lip--rest|closed|fa|round`.

**شرط مهم للحركة السلسة:** كل أوضاع العضو الواحد يجب أن تكون بالأوامر نفسها وبالعدد نفسه من النقاط
(مثلاً: `M` ثم سبعة `C` ثم `Z` للسان). البرنامج ينقل كل رقم إلى نظيره. إن اختلفت البنية ينتقل الشكل فجأة دون حركة.
ولأجزاء اللسان: نهاية الأمر الأول هي الطرف، والثاني الذلق، والثالث الوسط، والرابع الأقصى.

### المواضع والهواء والتسميات

- `spot--{المخرج}`: دائرة لكل مخرج من السبعة عشر (`jawf`, `aqsa-halq`, `qaf`, `nit`, …)، تنبض عند التظليل وتصير
  قابلة للضغط في أسئلة «حدّد المخرج على الرسم».
- `air--oral` و`air--nasal`: مسارا الهواء من الحنجرة إلى الفم ومن الحلق إلى الأنف. في الحروف الشديدة يُرسم السهم حتى أقرب
  نقطة من المسار إلى موضع المخرج ثم يتوقف.
- `label--{العضو}`: مجموعة فيها خط إرشادي ونقطة ونص عربي. ضع `direction="rtl"` على جذر الرسم.

### الألوان

الألوان متغيرات CSS في `frontend/src/index.css` (`--mk-skin-1`, `--mk-muscle-1`, `--mk-hl` …) لها قيم للوضعين الفاتح والداكن.
استعمل في الرسم الأصناف `t-skin`, `t-muscle`, `t-mucosa`, `t-lip`, `t-bone`, `t-tooth`, `t-cavity` بدل الألوان الثابتة
ليبقى واضحاً في الوضعين.

## lips-front.svg: الشفتان من الأمام

`lips-upper` و`lips-lower` تتحركان بين `lips-upper--{rest|closed|fa|round}` و`lips-lower--{…}` بالشرط نفسه.

## teeth.svg: الأسنان

كل سنّ `rect` بالصنف `tooth` والسمة `data-kind` = `thanaya | rubaiyat | anyab | dawahik | tawahin | nawajidh`،
ومعرّف مثل `tooth-upper-r1` (الفك، والجهة، والترتيب من الثنية).

## تسجيلات نطق الحروف

ضع تسجيل المقرئ لكل حرف ساكناً مسبوقاً بهمزة (أَبْ، أَتْ …) في `frontend/public/audio/letters/{id}.mp3`،
حيث `id` معرّف الحرف في `data/content/letters.json` (`ba`, `ta`, `qaf` …). يُشغَّل مع لحظة الاعتماد في الحركة.
