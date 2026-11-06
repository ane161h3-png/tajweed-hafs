import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { highlightParts } from '../../lib/filter'
import { findSection } from '../../data/sections'
import { arabicNumber } from '../../lib/api'
import Icon from '../../components/Icon'
import NotFound from '../../pages/NotFound'
import {
  COLLECTIONS,
  FONT_SIZES,
  bookmarks,
  chapterPath,
  findCollection,
  isBookmarked,
  lastRead,
  loadCollection,
  readFontStep,
  saveFontStep,
  saveLastRead,
  searchChapters,
  toggleBookmark,
} from './collections'

function useCollection(col) {
  const [state, setState] = useState({ data: null, error: null })
  useEffect(() => {
    if (!col) return
    let live = true
    setState({ data: null, error: null })
    loadCollection(col).then(
      (data) => live && setState({ data, error: null }),
      (error) => live && setState({ data: null, error }),
    )
    return () => {
      live = false
    }
  }, [col])
  return state
}

function Loading({ error }) {
  return <p className="p-8 text-center text-muted">{error ? 'تعذّر تحميل النص. أعد المحاولة.' : 'جارٍ تحميل النص…'}</p>
}

function SectionHeader({ section, subtitle }) {
  return (
    <header className="mb-5 flex items-center gap-4">
      <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Icon name={section.icon} size={30} />
      </span>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">{section.title}</h1>
        <p className="text-muted">{subtitle ?? section.description}</p>
      </div>
    </header>
  )
}

function CardLink({ to, title, desc, icon = 'chevron' }) {
  return (
    <Link
      to={to}
      className="flex h-full items-center gap-4 rounded-2xl border border-line bg-surface px-4 py-4 transition hover:border-accent/50 hover:bg-surface-2"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold">{title}</span>
        {desc && <span className="block text-sm text-muted">{desc}</span>}
      </span>
      <Icon name={icon} size={18} className="text-muted" />
    </Link>
  )
}

function BookmarkList({ section }) {
  const list = bookmarks().filter((b) => b.section === section)
  if (!list.length) return null
  return (
    <section className="mt-7" aria-labelledby="bm-h">
      <h2 id="bm-h" className="mb-2 flex items-center gap-1.5 text-lg font-bold">
        <Icon name="star" size={18} className="text-gold" /> علاماتك
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {list.map((b) => (
          <li key={b.path}>
            <Link to={b.path} className="block rounded-xl border border-line bg-surface px-4 py-2.5 hover:border-accent/50">
              <span className="block font-medium">{b.title}</span>
              <span className="block text-sm text-muted">{b.collection}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** صفحة القسم: الأدعية أو المكتبة */
export function CollectionsHub({ sectionId }) {
  const section = findSection(sectionId)
  const own = COLLECTIONS.filter((c) => c.section === sectionId)
  const others = sectionId === 'library' ? COLLECTIONS.filter((c) => c.id === 'sahifa') : []
  return (
    <div>
      <SectionHeader section={section} />
      <ul className="grid gap-3 sm:grid-cols-2">
        {[...own, ...others].map((c) => {
          const last = lastRead(c.id)
          return (
            <li key={c.id}>
              <CardLink to={`/${c.section}/${c.id}`} title={c.title} desc={last ? `آخر قراءة: ${last.title}` : c.desc} />
            </li>
          )
        })}
      </ul>
      {sectionId === 'library' && (
        <p className="mt-4 rounded-xl border border-dashed border-line bg-surface p-4 text-sm text-muted">
          تُضاف كتب أخرى تباعاً بعد التحقق من نصوصها من مصادر موثوقة مفتوحة.
        </p>
      )}
      <BookmarkList section={sectionId} />
    </div>
  )
}

function SourceNote({ book }) {
  const s = book.source
  if (!s) return null
  return (
    <footer className="mt-8 rounded-xl border border-line bg-surface-2/60 p-4 text-sm text-muted">
      <p className="font-semibold text-ink">المصدر</p>
      <p>{s.edition}</p>
      <p>
        النسخة الرقمية:{' '}
        <a href={s.url} target="_blank" rel="noreferrer" className="text-accent underline" dir="ltr">
          {s.digital}
        </a>{' '}
        · الترخيص {s.license}
      </p>
      <p className="mt-1">{s.note}</p>
    </footer>
  )
}

/** فهرس المجموعة: البحث، والأبواب، وقائمة الفصول */
export function CollectionIndex({ sectionId }) {
  const { col: colId } = useParams()
  const col = findCollection(colId)
  const navigate = useNavigate()
  const { data, error } = useCollection(col)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState(null)
  const results = useMemo(() => (data ? searchChapters(data.chapters, q) : []), [data, q])

  if (!col) return <NotFound />
  if (col.section !== sectionId) return <Navigate to={`/${col.section}/${col.id}`} replace />
  if (!data) return <Loading error={error} />

  // الباب الافتراضي: أول باب فيه أكثر من فصل (فلا يفتح نهج البلاغة على المقدمة وحدها)
  const group = data.groups.find((g) => g.id === tab) ?? data.groups.find((g) => g.chapters.length > 1) ?? data.groups[0]
  const last = lastRead(col.id)
  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-bold">{col.title}</h1>
        <p className="text-muted">{data.book.author}</p>
        {data.book.about && <p className="mt-1 text-sm text-muted">{data.book.about}</p>}
      </header>

      {last && (
        <Link to={last.path} className="mb-4 flex items-center gap-3 rounded-xl bg-accent-soft px-4 py-3 text-accent-ink hover:brightness-95">
          <Icon name="resume" size={18} />
          <span className="min-w-0 flex-1 truncate">
            <b>أكمل القراءة:</b> {last.title}
          </span>
        </Link>
      )}

      <label htmlFor="lib-search" className="sr-only">
        ابحث في {col.title}
      </label>
      <input
        id="lib-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setQ('')
          if (e.key === 'Enter' && results[0]) navigate(chapterPath(col, results[0].ch))
        }}
        autoComplete="off"
        placeholder={`ابحث في ${col.title}: عنوان أو كلمة من النص…`}
        className="mb-4 w-full rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-accent"
      />

      {q.trim() ? (
        <section aria-live="polite">
          <p className="mb-2 text-sm text-muted">{results.length ? `${arabicNumber(results.length)} نتيجة` : 'لا نتائج'}</p>
          <ul className="grid gap-2">
            {results.map(({ ch, snippet }) => (
              <li key={ch.key}>
                <Link to={`${chapterPath(col, ch)}?q=${encodeURIComponent(q.trim())}`} className="block rounded-xl border border-line bg-surface px-4 py-3 hover:border-accent/50">
                  <span className="block font-medium">{chapterLabel(data, ch)}</span>
                  <span className="line-clamp-2 block text-sm text-muted">{snippet}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
          {data.groups.length > 1 && (
            <div role="tablist" aria-label="الأبواب" className="mb-4 flex gap-2 overflow-x-auto pb-1">
              {data.groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  role="tab"
                  aria-selected={g.id === group.id}
                  onClick={() => setTab(g.id)}
                  className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium ${
                    g.id === group.id ? 'border-accent bg-accent text-white' : 'border-line bg-surface hover:border-accent/50'
                  }`}
                >
                  {g.title} <span className="opacity-70">({arabicNumber(g.chapters.length)})</span>
                </button>
              ))}
            </div>
          )}
          <ol className="grid gap-2 sm:grid-cols-2">
            {group.chapters.map((ch) => (
              <li key={ch.key}>
                <Link
                  to={chapterPath(col, ch)}
                  className="flex h-full items-center gap-3 rounded-xl border border-line bg-surface px-3 py-3 transition hover:border-accent/50 hover:bg-surface-2"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-sm font-semibold tabular-nums text-muted">
                    {arabicNumber(ch.id)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block font-medium">{ch.title || ch.paras[0]?.slice(0, 60)}</span>
                    {ch.desc && <span className="line-clamp-1 block text-sm text-muted">{ch.desc}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
      <SourceNote book={data.book} />
    </div>
  )
}

function chapterLabel(data, ch) {
  const g = data.groups.length > 1 ? data.groups.find((x) => x.id === ch.group) : null
  const title = ch.title || ch.paras[0]?.slice(0, 60)
  return g && !title.includes(g.title) ? `${g.title} · ${arabicNumber(ch.id)}: ${title}` : title
}

/** قارئ الفصل: الدعاء أو الخطبة بخط كبير، مع حجم الخط والعلامة والتنقل */
export function ChapterReader({ sectionId }) {
  const { col: colId, ch: chKey } = useParams()
  const col = findCollection(colId)
  const { data, error } = useCollection(col)
  const [step, setStep] = useState(readFontStep)
  const [, bump] = useState(0)
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''

  const index = data ? data.chapters.findIndex((c) => c.key === chKey) : -1
  const ch = index >= 0 ? data.chapters[index] : null
  const path = ch ? chapterPath(col, ch) : ''
  const label = ch ? chapterLabel(data, ch) : ''

  useEffect(() => {
    if (ch) saveLastRead(col.id, { path, title: label })
  }, [col, ch, path, label])

  useEffect(() => {
    window.scrollTo?.(0, 0)
  }, [chKey])

  if (!col) return <NotFound />
  if (col.section !== sectionId) return <Navigate to={`/${col.section}/${col.id}/${chKey}`} replace />
  if (!data) return <Loading error={error} />
  if (!ch) return <NotFound />

  const prev = data.chapters[index - 1]
  const next = data.chapters[index + 1]
  const marked = isBookmarked(path)
  const setFont = (n) => {
    const v = Math.min(FONT_SIZES.length - 1, Math.max(0, n))
    setStep(v)
    saveFontStep(v)
  }

  return (
    <article>
      <header className="mb-4">
        <Link to={`/${col.section}/${col.id}`} className="text-sm text-accent hover:underline">
          {col.title}
        </Link>
        <h1 className="mt-1 text-2xl font-bold leading-snug">{label}</h1>
        {ch.desc && <p className="text-muted">{ch.desc}</p>}
      </header>

      <div className="sticky top-0 z-10 -mx-1 mb-4 flex items-center gap-2 bg-bg/90 px-1 py-2 backdrop-blur">
        <div className="flex items-center rounded-full border border-line bg-surface" role="group" aria-label="حجم الخط">
          <button type="button" onClick={() => setFont(step - 1)} disabled={step === 0} className="px-3.5 py-1.5 text-sm disabled:opacity-40" aria-label="تصغير الخط">
            أ-
          </button>
          <span className="h-5 w-px bg-line" aria-hidden="true" />
          <button type="button" onClick={() => setFont(step + 1)} disabled={step === FONT_SIZES.length - 1} className="px-3.5 py-1.5 text-lg disabled:opacity-40" aria-label="تكبير الخط">
            أ+
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            toggleBookmark({ path, title: label, collection: col.title, section: col.section })
            bump((n) => n + 1)
          }}
          aria-pressed={marked}
          className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm ${marked ? 'border-gold bg-gold/15 text-ink' : 'border-line bg-surface'}`}
        >
          <Icon name="star" size={16} className={marked ? 'fill-current text-gold' : ''} />
          {marked ? 'محفوظة' : 'علامة'}
        </button>
      </div>

      {ch.intro?.length > 0 && (
        <div className="mb-4 rounded-xl bg-surface-2/70 p-4 text-sm leading-7 text-muted">
          {ch.intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}

      <div className="font-dua space-y-4" style={{ fontSize: `${FONT_SIZES[step]}rem` }}>
        {ch.paras.map((p, i) =>
          /^⟨.*⟩$/.test(p) ? (
            <h2 key={i} className="pt-2 text-[0.8em] font-bold text-accent">
              {p.slice(1, -1)}
            </h2>
          ) : (
            <p key={i}>
              {q
                ? highlightParts(p, q).map((part, k) => (part.hit ? <mark key={k} className="rounded bg-gold/30 text-inherit">{part.text}</mark> : part.text))
                : p}
            </p>
          ),
        )}
      </div>

      <nav aria-label="التنقل بين الفصول" className="mt-8 flex justify-between gap-3 text-sm">
        {prev ? (
          <Link to={chapterPath(col, prev)} className="max-w-[48%] truncate rounded-lg border border-line bg-surface px-4 py-2 hover:border-accent">
            → {prev.title || 'السابق'}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link to={chapterPath(col, next)} className="max-w-[48%] truncate rounded-lg border border-line bg-surface px-4 py-2 hover:border-accent">
            {next.title || 'التالي'} ←
          </Link>
        )}
      </nav>
      <SourceNote book={data.book} />
    </article>
  )
}
