// شجرة الأقسام: مصدر واحد للتنقل الجانبي والسفلي ومسار التنقل والصفحة الرئيسية.
// الوصول لأي درس: القسم ← القسم الفرعي ← الدرس (ثلاث ضغطات كحد أقصى).

export const SECTIONS = [
  {
    id: 'mushaf',
    title: 'المصحف',
    icon: 'mushaf',
    description: 'المصحف ملوّناً بأحكام التجويد مع البحث والاستماع',
    phase: 2,
    subsections: [
      { id: 'surahs', title: 'السور', description: 'فهرس السور المئة والأربع عشرة' },
      { id: 'juz', title: 'الأجزاء', description: 'الأجزاء الثلاثون وبداية كل جزء' },
      { id: 'search', title: 'البحث', description: 'باسم السورة أو رقمها أو الجزء أو نص الآية' },
      { id: 'bookmarks', title: 'العلامات المرجعية', description: 'المواضع التي حفظتها' },
    ],
  },
  {
    id: 'ahkam',
    title: 'أحكام التجويد',
    short: 'الأحكام',
    icon: 'ahkam',
    description: 'دروس الأحكام بالتعريف والأمثلة والتمارين',
    phase: 3,
    subsections: [
      { id: 'noon-sakinah', title: 'أحكام النون الساكنة والتنوين' },
      { id: 'meem-sakinah', title: 'أحكام الميم الساكنة' },
      { id: 'ghunnah', title: 'النون والميم المشددتان ومراتب الغنة' },
      { id: 'idgham', title: 'الإدغام العام' },
      { id: 'mudood', title: 'المدود' },
      { id: 'qalqalah', title: 'القلقلة' },
      { id: 'lamat', title: 'اللامات' },
      { id: 'tafkheem', title: 'التفخيم والترقيق' },
      { id: 'ra', title: 'أحكام الراء' },
      { id: 'hamzah', title: 'همزة الوصل والقطع' },
      { id: 'ha-kinayah', title: 'هاء الكناية' },
      { id: 'waqf', title: 'الوقف والابتداء' },
      { id: 'sakt', title: 'السكت' },
      { id: 'hafs-special', title: 'المواضع الخاصة برواية حفص' },
    ],
  },
  {
    id: 'makharij',
    title: 'مخارج الحروف',
    short: 'المخارج',
    icon: 'makharij',
    description: 'رسوم متحركة لمخرج كل حرف ومسار الهواء',
    phase: 4,
    subsections: [
      { id: 'general', title: 'المخارج العامة الخمسة' },
      { id: 'specific', title: 'المخارج الخاصة السبعة عشر' },
      { id: 'letters', title: 'الحروف واحداً واحداً' },
      { id: 'titles', title: 'ألقاب الحروف' },
      { id: 'teeth', title: 'أسماء الأسنان' },
      { id: 'finding', title: 'طريقة معرفة المخرج' },
      { id: 'mistakes', title: 'الأخطاء الشائعة' },
    ],
  },
  {
    id: 'sifat',
    title: 'صفات الحروف',
    short: 'الصفات',
    icon: 'sifat',
    description: 'الصفات المتضادة وغير المتضادة وقوة الحروف',
    phase: 5,
    subsections: [
      { id: 'opposite', title: 'الصفات المتضادة' },
      { id: 'non-opposite', title: 'الصفات غير المتضادة' },
      { id: 'cards', title: 'بطاقة كل حرف' },
      { id: 'matrix', title: 'مصفوفة الصفات التفاعلية' },
      { id: 'strength', title: 'قوة الحروف' },
      { id: 'similar', title: 'الفرق بين الحروف المتشابهة' },
    ],
  },
  {
    id: 'listen',
    title: 'الاستماع',
    icon: 'listen',
    description: 'مكتبة القرّاء والتلاوة آية آية أو سورة كاملة',
    phase: 6,
    subsections: [
      { id: 'reciters', title: 'مكتبة القرّاء' },
      { id: 'offline', title: 'الاستماع دون إنترنت' },
    ],
  },
  {
    id: 'quiz',
    title: 'الاختبارات',
    icon: 'quiz',
    description: 'ثلاثة مستويات ومراجعة الأخطاء بالتكرار المتباعد',
    phase: 6,
    subsections: [
      { id: 'level-1', title: 'المستوى الأول' },
      { id: 'level-2', title: 'المستوى الثاني' },
      { id: 'level-3', title: 'المستوى الثالث' },
      { id: 'recite', title: 'اقرأ بصوتك (الميكروفون)', description: 'اقرأ المثال فيتحقق البرنامج من قراءتك' },
      { id: 'tasmee', title: 'التسميع: اقرأ سورة كاملة', description: 'يتابع قراءتك وينبّهك عند كل خطأ ويصحّحه' },
      { id: 'review', title: 'مراجعة الأخطاء' },
    ],
  },
  {
    id: 'teacher',
    title: 'المعلّم والطلاب',
    short: 'المعلّم',
    icon: 'teacher',
    description: 'أرسل تقدّمك لمعلّمك، وتابع طلابك في لوحة المعلّم',
    phase: 6,
    subsections: [
      { id: 'share', title: 'أرسل تقدّمي للمعلّم', description: 'للطالب: رابط بتقدّمك ترسله لمعلّمك' },
      { id: 'card', title: 'بطاقة الحضور (باركود)', description: 'للطالب: باركود يمسحه المعلّم لتسجيل حضورك' },
      { id: 'students', title: 'لوحة المعلّم', description: 'تابع تقدّم طلابك ومواضع ضعفهم' },
      { id: 'attendance', title: 'تسجيل الحضور', description: 'بمسح باركود الطالب أو يدوياً' },
      { id: 'cards', title: 'طباعة بطاقات الباركود', description: 'بطاقة حضور مطبوعة لكل طالب' },
      { id: 'subscription', title: 'الاشتراك', description: 'طلاب بلا حدود وتصدير التقدّم والحضور إلى Excel' },
    ],
  },
  {
    id: 'settings',
    title: 'الإعدادات',
    icon: 'settings',
    description: 'القارئ والخط والألوان والوضع الليلي',
    phase: 6,
    subsections: [
      { id: 'display', title: 'العرض والخط' },
      { id: 'colors', title: 'ألوان الأحكام' },
      { id: 'audio', title: 'القارئ الافتراضي' },
      { id: 'progress', title: 'التقدّم' },
      { id: 'notebook', title: 'دفتري (PDF)', description: 'دفتر مسطّر خاص بك بتعديلاتك ورسوم المخارج والفهرس' },
      { id: 'about', title: 'عن البرنامج والمصادر', phase: 1 },
    ],
  },
]

export const HOME = { id: 'home', title: 'الرئيسية', icon: 'home', path: '/' }

// الأزرار الخمسة في شريط الموبايل السفلي؛ «المزيد» يفتح بقية الأقسام
export const BOTTOM_NAV = ['home', 'mushaf', 'ahkam', 'makharij', 'more']

export const sectionPath = (s) => `/${s.id}`
export const subsectionPath = (s, sub) => `/${s.id}/${sub.id}`

export function findSection(id) {
  return SECTIONS.find((s) => s.id === id)
}

export function findSubsection(sectionId, subId) {
  return findSection(sectionId)?.subsections.find((x) => x.id === subId)
}

/** مسار التنقل من عنوان الصفحة: [الرئيسية، القسم، القسم الفرعي] */
export function crumbsFor(pathname) {
  const [sectionId, subId] = pathname.split('/').filter(Boolean)
  const crumbs = [{ title: HOME.title, path: '/' }]
  const section = sectionId && findSection(sectionId)
  if (!section) return crumbs
  crumbs.push({ title: section.title, path: sectionPath(section) })
  const sub = subId && findSubsection(sectionId, subId)
  if (sub) crumbs.push({ title: sub.title, path: subsectionPath(section, sub) })
  return crumbs
}
