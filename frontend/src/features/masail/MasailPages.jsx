import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { findSection, findSubsection, sectionPath, subsectionPath } from '../../data/sections'
import { arabicNumber } from '../../lib/api'
import { highlightParts } from '../../lib/filter'
import Icon from '../../components/Icon'
import NotFound from '../../pages/NotFound'
import { loadMasail, qaUrl, searchQa } from './masail'

// المسائل الشرعية: استفتاءات السيد السيستاني (دام ظله) منقولة بنصّها من موقع مكتبه الرسمي،
// مع رقم كل استفتاء ورابطه هناك. لا يُصاغ النص ولا يُختصر، لأن أي تغيير في عبارة الفتوى قد يغيّر حكمها.
export const MARJA = {
  name: 'السيد علي الحسيني السيستاني (دام ظله)',
  site: 'https://www.sistani.org/arabic/qa/',
  ask: 'https://www.sistani.org/arabic/send-question/',
}

function useMasail() {
  const [state, setState] = useState({ data: null, error: null })
  useEffect(() => {
    let live = true
    loadMasail().then(
      (data) => live && setState({ data, error: null }),
      (error) => live && setState({ data: null, error }),
    )
    return () => {
      live = false
    }
  }, [])
  return state
}

function Loading({ error }) {
  return <p className="p-8 text-center text-muted">{error ? 'تعذّر تحميل المسائل. أعد المحاولة.' : 'جارٍ تحميل المسائل…'}</p>
}

function Marked({ text, q }) {
  if (!q) return text
  return highlightParts(text, q).map((p, k) => (p.hit ? <mark key={k} className="rounded bg-gold/30 text-inherit">{p.text}</mark> : p.text))
}

function MarjaNote({ data }) {
  return (
    <aside className="mt-8 rounded-2xl border border-line bg-surface p-4 text-sm leading-7">
      <p className="font-semibold">على فتاوى {MARJA.name}</p>
      <p className="text-muted">
        الاستفتاءات منقولة بنصّها من الموقع الرسمي لمكتب سماحته{data?.source?.fetched ? ` (نُقلت في ${data.source.fetched})` : ''}، ولكل استفتاء رقمه
        ورابطه هناك. ما لا تجد جوابه هنا، أرسله إلى مكتب سماحته.
      </p>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
        <a href={MARJA.site} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
          الاستفتاءات في الموقع الرسمي <Icon name="chevron" size={16} />
        </a>
        <a href={MARJA.ask} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
          أرسل استفتاءً جديداً <Icon name="chevron" size={16} />
        </a>
      </div>
    </aside>
  )
}

function QaItem({ item, n, q }) {
  return (
    <div id={`qa-${item.ref}`} className="scroll-mt-20 rounded-2xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted">
        <span className="grid size-7 place-items-center rounded-lg bg-surface-2 font-semibold tabular-nums">{arabicNumber(n)}</span>
        <a href={qaUrl(item.ref)} target="_blank" rel="noreferrer" className="hover:text-accent hover:underline" title="الاستفتاء في الموقع الرسمي">
          استفتاء رقم {arabicNumber(item.ref)}
        </a>
      </div>
      <p className="whitespace-pre-line">
        <b className="text-accent">السؤال: </b>
        <Marked text={item.q} q={q} />
      </p>
      <p className="mt-3 whitespace-pre-line rounded-xl bg-accent-soft/60 p-3 leading-8">
        <b className="text-accent">الجواب: </b>
        <Marked text={item.a} q={q} />
      </p>
    </div>
  )
}

function SearchBox({ value, onChange, placeholder, onEnter }) {
  return (
    <>
      <label htmlFor="masail-search" className="sr-only">
        ابحث في المسائل
      </label>
      <input
        id="masail-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onChange('')
          if (e.key === 'Enter') onEnter?.()
        }}
        autoComplete="off"
        placeholder={placeholder}
        className="mb-4 w-full rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-accent"
      />
    </>
  )
}

function SearchResults({ data, q, bab }) {
  const results = useMemo(() => searchQa(data, q, { bab }), [data, q, bab])
  return (
    <section aria-live="polite">
      <p className="mb-2 text-sm text-muted">{results.length ? `${arabicNumber(results.length)}${results.length >= 60 ? '+' : ''} نتيجة` : 'لا نتائج'}</p>
      <ol className="grid gap-3">
        {results.map(({ item, topic }, i) => (
          <li key={item.ref}>
            <Link to={`/masail/${topic.bab}/${topic.id}?q=${encodeURIComponent(q)}#qa-${item.ref}`} className="mb-1 inline-block text-sm text-accent hover:underline">
              {topic.title}
            </Link>
            <QaItem item={item} n={i + 1} q={q} />
          </li>
        ))}
      </ol>
    </section>
  )
}

export function MasailHome() {
  const section = findSection('masail')
  const { data, error } = useMasail()
  const [q, setQ] = useState('')
  const dq = useDeferredValue(q.trim())
  const counts = useMemo(() => {
    const c = {}
    for (const t of data?.topics ?? []) c[t.bab] = (c[t.bab] ?? 0) + t.qa.length
    return c
  }, [data])
  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div>
      <header className="mb-5 flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Icon name={section.icon} size={30} />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{section.title}</h1>
          <p className="text-muted">
            {section.description}
            {total ? ` · ${arabicNumber(total)} استفتاءً` : ''}
          </p>
        </div>
      </header>
      {!data ? (
        <Loading error={error} />
      ) : (
        <>
          <SearchBox value={q} onChange={setQ} placeholder="ابحث في كل المسائل: الوضوء، صلاة المسافر، الربا…" />
          {dq.length >= 2 ? (
            <SearchResults data={data} q={dq} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {section.subsections.map((sub, i) => (
                <li key={sub.id}>
                  <Link
                    to={subsectionPath(section, sub)}
                    className="flex h-full items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3.5 transition hover:border-accent/50 hover:bg-surface-2"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-sm font-semibold tabular-nums text-muted">
                      {arabicNumber(i + 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{sub.title}</span>
                      <span className="block text-sm text-muted">
                        {counts[sub.id] ? `${arabicNumber(counts[sub.id])} استفتاءً` : ''}
                        {sub.description ? ` · ${sub.description}` : ''}
                      </span>
                    </span>
                    <Icon name="chevron" size={18} className="text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <MarjaNote data={data} />
    </div>
  )
}

export function MasailBab() {
  const { bab } = useParams()
  const navigate = useNavigate()
  const section = findSection('masail')
  const sub = findSubsection('masail', bab)
  const { data, error } = useMasail()
  const [q, setQ] = useState('')
  const dq = useDeferredValue(q.trim())
  if (!sub) return <NotFound />
  const topics = (data?.topics ?? []).filter((t) => t.bab === bab)

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-bold">{sub.title}</h1>
        {sub.description && <p className="text-muted">{sub.description}</p>}
      </header>
      {!data ? (
        <Loading error={error} />
      ) : (
        <>
          <SearchBox
            value={q}
            onChange={setQ}
            placeholder={`ابحث في ${sub.title}…`}
            onEnter={() => {
              const t = topics.find((x) => x.title.includes(q.trim()))
              if (t) navigate(`/masail/${bab}/${t.id}`)
            }}
          />
          {dq.length >= 2 ? (
            <SearchResults data={data} q={dq} bab={bab} />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {topics.map((t) => (
                <li key={t.id}>
                  <Link
                    to={`/masail/${bab}/${t.id}`}
                    className="flex h-full items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 transition hover:border-accent/50 hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1 font-medium">{t.title}</span>
                    <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs tabular-nums text-muted">{arabicNumber(t.qa.length)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <p className="mt-6 text-sm">
        <Link to={sectionPath(section)} className="text-accent hover:underline">
          → كل أبواب المسائل
        </Link>
      </p>
      <MarjaNote data={data} />
    </div>
  )
}

export function MasailTopic() {
  const { bab, topic: topicId } = useParams()
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''
  const sub = findSubsection('masail', bab)
  const { data, error } = useMasail()
  const topic = data?.topics.find((t) => t.id === topicId)

  useEffect(() => {
    if (!topic) return
    const id = window.location.hash.slice(1)
    if (id) document.getElementById(id)?.scrollIntoView?.({ block: 'start' })
  }, [topic])

  if (!sub) return <NotFound />
  if (!data) return <Loading error={error} />
  if (!topic || topic.bab !== bab) return <NotFound />

  return (
    <article>
      <header className="mb-4">
        <Link to={`/masail/${bab}`} className="text-sm text-accent hover:underline">
          {sub.title}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{topic.title}</h1>
        <p className="text-muted">{arabicNumber(topic.qa.length)} استفتاءً</p>
      </header>
      <ol className="grid gap-3">
        {topic.qa.map((item, i) => (
          <li key={item.ref}>
            <QaItem item={item} n={i + 1} q={q} />
          </li>
        ))}
      </ol>
      <MarjaNote data={data} />
    </article>
  )
}
