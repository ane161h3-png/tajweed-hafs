const SOURCES = [
  {
    title: 'نص المصحف العثماني',
    by: 'مشروع تنزيل',
    url: 'https://tanzil.net',
    license: 'CC BY 3.0',
    note: 'يُعرض النص كما هو دون أي تعديل، مع الإشارة إلى المصدر كما تشترط الرخصة.',
  },
  {
    title: 'بيانات مواضع أحكام التجويد',
    by: 'cpfair/quran-tajweed',
    url: 'https://github.com/cpfair/quran-tajweed',
    license: 'CC BY 4.0',
  },
  {
    title: 'تلاوات الآيات',
    by: 'EveryAyah',
    url: 'https://everyayah.com',
    license: 'تُشغّل من روابطها مباشرة ولا تُضمَّن في البرنامج',
  },
  {
    title: 'تلاوات السور',
    by: 'MP3Quran',
    url: 'https://mp3quran.net',
    license: 'تُشغّل من روابطها مباشرة ولا تُضمَّن في البرنامج',
  },
]

export default function About() {
  return (
    <article className="max-w-3xl">
      <h1 className="text-2xl font-bold">عن البرنامج</h1>
      <p className="mt-2 text-muted">
        برنامج تعليمي لأحكام تجويد القرآن الكريم ومخارج الحروف وصفاتها برواية حفص عن عاصم من طريق الشاطبية. المحتوى
        العلمي مأخوذ من ملف الأحكام المعتمد، وكل معلومة لم ترد فيه معلَّمة للمراجعة من المقرئ.
      </p>

      <h2 className="mb-3 mt-8 text-lg font-semibold">مصادر البيانات وتراخيصها</h2>
      <ul className="space-y-3">
        {SOURCES.map((s) => (
          <li key={s.url} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">{s.title}</span>
              <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs text-accent" dir="auto">
                {s.license}
              </span>
            </div>
            <a href={s.url} target="_blank" rel="noreferrer" className="text-sm text-accent underline-offset-4 hover:underline" dir="ltr">
              {s.by}
            </a>
            {s.note && <p className="mt-1 text-sm text-muted">{s.note}</p>}
          </li>
        ))}
      </ul>

      <h2 className="mb-3 mt-8 text-lg font-semibold">الخطوط</h2>
      <p className="text-sm text-muted">
        خط الواجهة IBM Plex Sans Arabic، وخط المصحف Amiri Quran، وكلاهما برخصة SIL Open Font License 1.1، ومضمَّنان في
        البرنامج ليعملا دون إنترنت.
      </p>

      <h2 className="mb-3 mt-8 text-lg font-semibold">الخصوصية</h2>
      <p className="text-sm text-muted">
        لا يجمع البرنامج أي بيانات شخصية، وكل تقدّمك محفوظ على جهازك فقط.{' '}
        <a href={`${import.meta.env.BASE_URL}privacy.html`} className="text-accent underline-offset-4 hover:underline">
          سياسة الخصوصية
        </a>
      </p>
    </article>
  )
}
