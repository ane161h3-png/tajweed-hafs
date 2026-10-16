import { Link } from 'react-router'
import { findSection, subsectionPath } from '../../data/sections'
import { arabicNumber } from '../../lib/api'
import Icon from '../../components/Icon'
import SearchBar, { SEARCH_HINT, useSearch, Snippet, resultPath } from './SearchBar'
import { useState } from 'react'
import { removeBookmark, useBookmarks, useLastRead } from './reading'

function ContinueReading() {
  const raw = useLastRead()
  const last = raw ? JSON.parse(raw) : null
  if (!last) return null
  return (
    <Link
      to={`/mushaf/surah/${last.surah}?at=${last.ayah}`}
      className="flex items-center gap-4 rounded-2xl bg-accent px-5 py-4 text-accent-ink shadow-sm hover:brightness-110"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/15">
        <Icon name="resume" />
      </span>
      <span>
        <span className="block font-semibold">أكمل القراءة</span>
        <span className="block text-sm opacity-85">
          سورة {last.surahName} · الآية {arabicNumber(last.ayah)}
        </span>
      </span>
    </Link>
  )
}

/** الصفحة الرئيسية للمصحف: البحث، وأكمل القراءة، والأقسام الفرعية. */
export default function MushafHome() {
  const section = findSection('mushaf')
  return (
    <div>
      <header className="mb-5 flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Icon name="mushaf" size={30} />
        </span>
        <div>
          <h1 className="text-2xl font-bold">المصحف</h1>
          <p className="text-muted">{section.description}</p>
        </div>
      </header>
      <div className="mb-5">
        <SearchBar />
      </div>
      <div className="mb-6">
        <ContinueReading />
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {section.subsections.map((sub) => (
          <li key={sub.id}>
            <Link
              to={subsectionPath(section, sub)}
              className="flex h-full flex-col rounded-xl border border-line bg-surface px-4 py-3.5 hover:border-accent/50 hover:bg-surface-2"
            >
              <span className="font-medium">{sub.title}</span>
              <span className="text-sm text-muted">{sub.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** صفحة البحث: النتائج كاملة في الصفحة. */
export function SearchPage() {
  const [q, setQ] = useState('')
  const { results, total, loading, query } = useSearch(q)
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">البحث في المصحف</h1>
      <p className="mb-4 text-sm text-muted">{SEARCH_HINT}. تظهر النتائج أثناء الكتابة.</p>
      <label className="sr-only" htmlFor="search-page-input">
        ابحث
      </label>
      <input
        id="search-page-input"
        type="search"
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="اكتب هنا…"
        className="w-full rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-accent"
      />
      <div className="mt-4" aria-live="polite">
        {loading && <p className="text-sm text-muted">جارٍ البحث…</p>}
        {!loading && query && results.length === 0 && <p className="text-muted">لا نتائج لـ «{query}»</p>}
        {total > 0 && <p className="mb-2 text-sm text-muted">{arabicNumber(total)} آية تطابق النص</p>}
        <ul className="space-y-2">
          {results.map((r) => (
            <li key={`${r.type}-${r.surah}-${r.ayah ?? ''}-${r.juz ?? ''}`}>
              <Link to={resultPath(r)} className="block rounded-xl border border-line bg-surface px-4 py-3 hover:border-accent/50">
                {r.type === 'ayah' ? (
                  <>
                    <span className="font-quran block !text-xl">
                      <Snippet text={r.text} match={r.match} radius={140} />
                    </span>
                    <span className="text-sm text-muted">
                      {r.surah_name} {arabicNumber(r.ayah)}
                    </span>
                  </>
                ) : r.type === 'surah' ? (
                  <span className="font-medium">
                    سورة {r.name} <span className="text-sm text-muted">· {arabicNumber(r.ayah_count)} آية</span>
                  </span>
                ) : (
                  <span className="font-medium">
                    الجزء {arabicNumber(r.juz)} <span className="text-sm text-muted">· يبدأ من {r.surah_name} {arabicNumber(r.ayah)}</span>
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function BookmarksPage() {
  const bookmarks = useBookmarks()
  const sorted = [...bookmarks].sort((a, b) => a.surah - b.surah || a.ayah - b.ayah)
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">العلامات المرجعية</h1>
      <p className="mb-4 text-sm text-muted">لإضافة علامة: اضغط رقم الآية ﴿ ﴾ في المصحف ثم «إضافة علامة مرجعية».</p>
      {sorted.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-muted">لا علامات بعد.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((b) => (
            <li key={`${b.surah}:${b.ayah}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
              <Link to={`/mushaf/surah/${b.surah}?ayah=${b.ayah}`} className="flex-1 font-medium hover:text-accent">
                سورة {b.surahName} · الآية {arabicNumber(b.ayah)}
              </Link>
              <span className="text-xs text-muted">{new Date(b.at).toLocaleDateString('ar')}</span>
              <button type="button" onClick={() => removeBookmark(b.surah, b.ayah)} className="text-sm text-[var(--pen-red)] hover:underline">
                حذف
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
