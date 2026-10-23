import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { tokens } from '../../lib/matching'
import { arabicNumber, useApi } from '../../lib/api'
import { useSettings } from '../settings/SettingsContext'

const pad3 = (n) => String(n).padStart(3, '0')
export const DEFAULT_RECITER = 'husary-murattal'

export function ayahAudioUrl(reciter, surah, ayah) {
  return reciter?.ayah_url?.replace('{sss}', pad3(surah)).replace('{aaa}', pad3(ayah)) ?? null
}

/** القارئ المختار في الإعدادات أو الحصري المرتل، من القرّاء الذين لهم تلاوة آية آية. */
export function useReciter() {
  const { settings } = useSettings()
  const { data } = useApi('/reciters')
  const withAyahs = (data ?? []).filter((r) => r.ayah_url)
  return withAyahs.find((r) => r.id === settings.reciter) ?? withAyahs.find((r) => r.id === DEFAULT_RECITER) ?? withAyahs[0]
}

function PlayButton({ url, label }) {
  const audio = useRef(null)
  const [playing, setPlaying] = useState(false)
  useEffect(() => () => audio.current?.pause(), [])
  if (!url) return null
  const toggle = () => {
    if (!audio.current || audio.current.dataset.src !== url) {
      audio.current?.pause()
      audio.current = new Audio(url)
      audio.current.dataset.src = url
      audio.current.onended = () => setPlaying(false)
      audio.current.onerror = () => setPlaying(false)
    }
    if (playing) {
      audio.current.pause()
      setPlaying(false)
    } else {
      audio.current.currentTime = 0
      audio.current.play().then(() => setPlaying(true), () => setPlaying(false))
    }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm leading-8 hover:border-accent hover:text-accent"
      aria-label={playing ? 'إيقاف' : `استمع: ${label}`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {playing ? <path d="M7 5h4v14H7zM13 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}
      </svg>
      {playing ? 'إيقاف' : 'استمع'}
    </button>
  )
}

/** مثال قرآني: الآية كما هي في المصحف وكلمة الشاهد مظلّلة. */
export default function AyahExample({ example, reciter }) {
  const { ayah_text: text, match, surah, ayah, surah_name: name, note } = example
  const ref = `${name ?? ''} ${arabicNumber(ayah)}`
  const navigate = useNavigate()
  // الضغط على الآية يفتح صفحة تحليلها (الأحكام والمخارج والصفات)، وكلمة الشاهد محدَّدة سلفاً
  const word = text && match ? tokens(text).findIndex((t) => t.end > match[0] && t.start < match[1]) : -1
  const analysis = `/ayah/${surah}/${ayah}${word >= 0 ? `?w=${word}` : ''}`
  return (
    <figure className="my-[calc(var(--rule)*0.5)] rounded-lg border border-line/70 bg-surface/80 px-4 py-[calc(var(--rule)*0.25)]">
      {text ? (
        <blockquote
          className="font-quran cursor-pointer rounded text-[1.55rem] hover:bg-accent-soft/40"
          role="link"
          tabIndex={0}
          title="اضغط لتحليل الآية: أحكامها ومخارجها وصفاتها"
          onClick={() => navigate(analysis)}
          onKeyDown={(e) => e.key === 'Enter' && navigate(analysis)}
        >
          {match ? (
            <>
              {text.slice(0, match[0])}
              <mark className="rounded bg-gold/25 px-0.5 text-ink ring-1 ring-gold/60">{text.slice(match[0], match[1])}</mark>
              {text.slice(match[1])}
            </>
          ) : (
            text
          )}
          <span className="mx-1 text-gold">﴿{arabicNumber(ayah)}﴾</span>
        </blockquote>
      ) : (
        <p className="text-muted">الآية غير موجودة</p>
      )}
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        {example.word && (
          <span>
            الشاهد: <strong className="font-quran text-lg text-ink">{example.word}</strong>
          </span>
        )}
        {note && <span>· {note}</span>}
        {!match && example.word && text && (
          <span className="font-medium text-[var(--pen-red)]">⚠ لم تُوجد الكلمة في الآية، راجع المثال</span>
        )}
        <span className="ms-auto flex items-center gap-2">
          <Link to={`/mushaf/surah/${surah}#ayah-${surah}-${ayah}`} className="underline-offset-4 hover:text-accent hover:underline">
            {ref}
          </Link>
          <PlayButton url={ayahAudioUrl(reciter, surah, ayah)} label={ref} />
          <Link to={analysis} className="no-print inline-flex items-center gap-1.5 rounded-full border border-accent bg-surface px-3 text-sm leading-8 text-accent hover:bg-accent-soft">
            🔍 تحليل الآية
          </Link>
        </span>
      </figcaption>
    </figure>
  )
}
