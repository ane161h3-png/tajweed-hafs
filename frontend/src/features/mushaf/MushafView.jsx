import { memo, useMemo } from 'react'
import { arabicNumber } from '../../lib/api'
import { buildSegments } from './tajweed'

/** آية واحدة: مقاطع ملوّنة بحسب الأحكام ثم رقمها داخل ﴿ ﴾ (زرّ يفتح خيارات الآية). */
export const AyahText = memo(function AyahText({ surah, ayah, playing, highlighted, bookmarked }) {
  const segments = useMemo(() => buildSegments(ayah.text, ayah.tajweed), [ayah.text, ayah.tajweed])
  const state = playing ? 'bg-accent-soft' : highlighted ? 'bg-gold/20' : ''
  return (
    <span
      id={`ayah-${surah}-${ayah.ayah}`}
      data-surah={surah}
      data-ayah={ayah.ayah}
      className={`ayah rounded-md transition-colors duration-300 ${state}`}
      aria-current={playing ? 'true' : undefined}
    >
      <span className="ayah-body">
        {segments.map((seg) =>
          seg.rules.length ? (
            <span
              key={seg.start}
              className={`tj tjp-${seg.rules[0]} ${seg.rules.map((r) => `tj-${r}`).join(' ')}`}
              data-rules={seg.rules.join(' ')}
            >
              {seg.text}
            </span>
          ) : (
            seg.text
          ),
        )}
      </span>
      <button
        type="button"
        className="ayah-num mx-1 whitespace-nowrap rounded text-gold hover:bg-gold/15"
        data-ayah-menu=""
        aria-label={`الآية ${arabicNumber(ayah.ayah)}: خيارات التشغيل والعلامة المرجعية`}
      >
        ﴿{arabicNumber(ayah.ayah)}﴾{bookmarked && <span className="align-super text-[0.5em] text-accent">●</span>}
      </button>{' '}
    </span>
  )
})

/** سورة (أو جزء منها في عرض الجزء) بعنوانها وبسملتها. */
export function SurahBlock({ surah, ayahs, bismillah, playing, highlight, bookmarks, pageMode = false }) {
  const startsAtOne = ayahs[0]?.ayah === 1
  return (
    <section aria-label={`سورة ${surah.name}`} className={pageMode ? 'mb-3' : 'mb-10'}>
      {(!pageMode || startsAtOne) && (
      <header className="relative mb-5 overflow-hidden rounded-2xl border-2 border-double border-gold/50 bg-surface px-4 py-3 text-center">
        <div className="absolute inset-y-0 start-0 hidden w-24 bg-[radial-gradient(circle,var(--gold)_1px,transparent_1.5px)] bg-[size:10px_10px] opacity-20 sm:block" />
        <div className="absolute inset-y-0 end-0 hidden w-24 bg-[radial-gradient(circle,var(--gold)_1px,transparent_1.5px)] bg-[size:10px_10px] opacity-20 sm:block" />
        <h2 className="font-quran !text-[1.7rem] !leading-[1.8]">
          {startsAtOne ? '' : 'تابع '}سورة {surah.name}
        </h2>
        <p className="text-xs text-muted">
          {surah.revelation} · آياتها {arabicNumber(surah.ayah_count)} · ترتيبها {arabicNumber(surah.number)}
        </p>
      </header>
      )}
      {surah.bismillah && bismillah && startsAtOne && (
        <p className="font-quran mb-1 text-center" aria-label="البسملة">
          {bismillah}
        </p>
      )}
      <p className="font-quran text-justify" lang="ar">
        {ayahs.map((a) => (
          <AyahText
            key={a.ayah}
            surah={surah.number}
            ayah={a}
            playing={playing?.surah === surah.number && playing.ayah === a.ayah}
            highlighted={highlight?.surah === surah.number && highlight.ayah === a.ayah}
            bookmarked={bookmarks.has(`${surah.number}:${a.ayah}`)}
          />
        ))}
      </p>
    </section>
  )
}
