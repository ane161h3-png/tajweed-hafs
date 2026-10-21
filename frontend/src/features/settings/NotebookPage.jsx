import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { arabicNumber } from '../../lib/api'

const card = 'rounded-2xl border border-line bg-surface p-4'

/** رابط ملف PDF: في تطبيق أندرويد من الموقع الحي (فيُفتح في المتصفح ويُحفظ)، وفي الموقع من المسار نفسه. */
export function notebookUrl() {
  const live = import.meta.env.VITE_LIVE_URL
  const base = Capacitor.isNativePlatform() && live ? live : `${window.location.origin}${import.meta.env.BASE_URL}`
  return `${base.replace(/\/?$/, '/')}notebook.pdf`
}

const PARTS = [
  ['الأحكام', 'كل أحكام التجويد (٤٢ درساً): التعريف لغةً واصطلاحاً، وطريقة الأداء، وأكثر من ١٩٠ مثالاً من القرآن بالكلمة ملوّنة، وأبيات تحفة الأطفال.'],
  ['المخارج', 'المخارج العامة والسبعة عشر، وبطاقة لكل حرف بمخرجه وطريقة نطقه وأخطائه الشائعة، وألقاب الحروف وأسماء الأسنان، وأبيات الجزرية.'],
  ['الصفات', 'الصفات المتضادة وغير المتضادة، وجدول صفات كل حرف، والفرق بين الحروف المتشابهة.'],
]

export default function NotebookPage() {
  const [size, setSize] = useState(null)
  const url = notebookUrl()
  useEffect(() => {
    // الحجم من ترويسة الملف إن توفّرت (لا يُنزَّل الملف هنا)
    fetch(url, { method: 'HEAD' })
      .then((r) => (r.ok ? Number(r.headers.get('content-length')) : null))
      .then((n) => n && setSize(n))
      .catch(() => {})
  }, [url])

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">دفتر أحكام التجويد وتلاوته (PDF)</h1>
      <p className="text-muted">
        دفتر منسّق بتصميم الدفاتر، تحمله معك أو تطبعه، يجمع ما تعلّمته في ثلاثة أبواب. مناسب لما بعد إتمام التعلّم على أستاذك للمراجعة والحفظ.
      </p>

      <a
        href={url}
        download="دفتر-أحكام-التجويد.pdf"
        target={Capacitor.isNativePlatform() ? '_system' : undefined}
        rel="noreferrer"
        className="flex items-center justify-center gap-3 rounded-2xl bg-accent px-6 py-4 text-lg font-semibold text-accent-ink shadow-sm hover:brightness-110"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14" />
        </svg>
        تحميل الدفتر PDF{size ? ` (${arabicNumber(Math.round(size / 1048576 * 10) / 10)} م.ب)` : ''}
      </a>

      <ul className="space-y-3">
        {PARTS.map(([title, text], i) => (
          <li key={title} className={`${card} flex gap-4`}>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft font-bold text-accent">{arabicNumber(i + 1)}</span>
            <div>
              <h2 className="font-semibold">الباب {['الأول', 'الثاني', 'الثالث'][i]}: {title}</h2>
              <p className="text-sm text-muted">{text}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className={`${card} text-sm text-muted`}>
        يحتوي الدفتر غلافاً وفهرساً، وفي نهاية كل باب صفحة مسطّرة لتدوين ملاحظاتك، وعلى الغلاف خانات لاسمك واسم معلّمك. نصوص الآيات منقولة كما هي من المصحف دون تعديل. المحتوى
        مسودة يراجعها مقرئ متخصص قبل الاعتماد.
      </p>
      <p className="text-xs text-muted">الدفتر يُبنى من محتوى البرنامج عند كل تحديث، فيكون دائماً بآخر نسخة.</p>
    </div>
  )
}
