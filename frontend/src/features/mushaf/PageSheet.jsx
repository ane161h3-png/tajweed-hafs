import { arabicNumber } from '../../lib/api'

/**
 * صفحة من المصحف على هيئتها: في أعلى اليمين اسم السورة وتفاصيلها، وفي أعلى اليسار الجزء والحزب،
 * وفي أسفل المنتصف رقم الصفحة. children: نص الآيات (كتل السور).
 * groups: [{ surah, ayahs }] السور التي تقع في هذه الصفحة.
 */
export default function PageSheet({ page, groups, juz, hizb, quarterStart, children }) {
  const names = groups.map((g) => g.surah.name)
  const first = groups[0]
  const range = (g) => {
    const a = g.ayahs[0].ayah
    const b = g.ayahs.at(-1).ayah
    return a === b ? `الآية ${arabicNumber(a)}` : `الآيات ${arabicNumber(a)}–${arabicNumber(b)}`
  }
  return (
    <section
      id={`page-${page}`}
      data-page={page}
      aria-label={`الصفحة ${page}`}
      className="mushaf-page relative mx-auto mb-6 max-w-3xl scroll-mt-28 overflow-hidden rounded-2xl border border-gold/50 bg-[var(--paper)] shadow-sm"
    >
      <header className="flex items-start justify-between gap-3 border-b border-gold/40 bg-gold/5 px-4 py-2 sm:px-6">
        <div className="min-w-0">
          <p className="truncate font-semibold">{names.map((n) => `سورة ${n}`).join(' · ')}</p>
          <p className="truncate text-xs text-muted">
            {groups.length === 1 ? `${range(first)} · ${first.surah.revelation} · ${arabicNumber(first.surah.ayah_count)} آية` : groups.map((g) => `${g.surah.name}: ${range(g)}`).join(' · ')}
          </p>
        </div>
        <div className="shrink-0 text-end">
          <p className="font-semibold">الجزء {arabicNumber(juz)}</p>
          {hizb && (
            <p className="text-xs text-muted">
              {quarterStart ? '۞ ' : ''}الحزب {arabicNumber(hizb.hizb)} · الربع {arabicNumber(hizb.quarter)}
            </p>
          )}
        </div>
      </header>
      <div className="px-4 py-4 sm:px-8 sm:py-6">{children}</div>
      <footer className="flex items-center justify-center pb-3 pt-1" aria-hidden="true">
        <span className="grid min-w-10 place-items-center rounded-full border border-gold/60 bg-gold/10 px-3 py-0.5 text-sm font-bold tabular-nums">{arabicNumber(page)}</span>
      </footer>
    </section>
  )
}
