import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { arabicNumber, useApi } from '../../lib/api'
import { DataState } from '../mushaf/MushafLists'
import { usePlayer } from '../player/PlayerContext'
import { itemUrl } from '../player/queue'
import { download, formatSize, listDownloads, onOfflineChange, removeDownload } from '../player/offline'

const card = 'rounded-2xl border border-line bg-surface p-4'
const btn = 'rounded-lg border border-line bg-surface px-2.5 py-1 text-sm hover:border-accent disabled:opacity-40'

/** المحفوظ دون إنترنت مع إعادة التحميل عند التغيّر. */
export function useDownloads() {
  const [list, setList] = useState([])
  const refresh = useCallback(() => listDownloads().then(setList), [])
  useEffect(() => {
    refresh()
    return onOfflineChange(refresh)
  }, [refresh])
  return list
}

function DownloadButton({ url, meta, downloaded }) {
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  if (!url) return null
  if (downloaded)
    return (
      <button type="button" className={`${btn} text-accent`} onClick={() => removeDownload(url)} title="محفوظ للاستماع دون إنترنت؛ اضغط للحذف">
        ✓ محفوظ
      </button>
    )
  if (progress !== null)
    return (
      <span className="w-20 text-xs tabular-nums text-muted" aria-live="polite">
        {Math.round(progress * 100)}٪
      </span>
    )
  return (
    <button
      type="button"
      className={btn}
      title={error ?? 'تنزيل للاستماع دون إنترنت'}
      onClick={() => {
        setError(null)
        setProgress(0)
        download(url, meta, setProgress)
          .catch((e) => setError(e.message))
          .finally(() => setProgress(null))
      }}
    >
      {error ? '⚠ أعد المحاولة' : '⬇ تنزيل'}
    </button>
  )
}

function SurahTable({ surahs, reciter, special, downloads }) {
  const player = usePlayer()
  const saved = useMemo(() => new Set(downloads.map((d) => d.url)), [downloads])
  const allowed = special?.surahs ?? reciter?.surahs
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2">
      {surahs
        .filter((s) => !allowed || allowed.includes(s.number))
        .map((s) => {
          const src = special ?? reciter
          const url = src?.surah_url ? itemUrl({ kind: 'surah', surah: s.number }, src) : null
          return (
            <li key={s.number} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-1.5">
              <span className="w-8 text-center text-xs text-muted">{arabicNumber(s.number)}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
              {url && (
                <button
                  type="button"
                  className={btn}
                  onClick={() => player.playSurah(s.number, s.name, special ?? null)}
                  aria-label={`تشغيل سورة ${s.name} كاملة`}
                >
                  ▶ السورة
                </button>
              )}
              {!special && reciter?.ayah_url && (
                <Link to={`/mushaf/surah/${s.number}`} className={btn} onClick={() => player.setReciter(reciter.id)} title="افتحها في المصحف واضغط «استمع»">
                  آية آية
                </Link>
              )}
              <DownloadButton
                url={url}
                downloaded={saved.has(url)}
                meta={{ title: `سورة ${s.name}`, reciter: src?.name, style: src?.style, surah: s.number }}
              />
            </li>
          )
        })}
    </ul>
  )
}

export function ReciterLibrary() {
  const { data: reciters, loading, error } = useApi('/reciters')
  const { data: surahs } = useApi('/surahs')
  const { data: minshawi } = useApi('/minshawi')
  const player = usePlayer()
  const downloads = useDownloads()
  const [selected, setSelected] = useState(null)
  const [q, setQ] = useState('')

  const groups = useMemo(() => {
    const map = new Map()
    for (const r of reciters ?? []) {
      if (!map.has(r.name)) map.set(r.name, [])
      map.get(r.name).push(r)
    }
    return [...map.entries()]
  }, [reciters])
  if (!reciters) return <DataState loading={loading} error={error} />

  const minshawiItems = (minshawi?.items ?? []).map((it, i) => ({
    id: `minshawi-lib-${i}`,
    name: minshawi.reciter,
    style: it.style,
    surah_url: it.surah_url,
    ayah_url: it.ayah_url,
    surahs: it.surahs,
    special: true,
  }))
  const current = selected?.special ? selected : reciters.find((r) => r.id === (selected?.id ?? player.reciter?.id)) ?? reciters[0]
  const filtered = (surahs ?? []).filter((s) => !q || s.name.includes(q) || String(s.number) === q)

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">مكتبة القرّاء</h1>
      <p className="mb-4 text-sm text-muted">رواية حفص عن عاصم. تُشغّل التلاوات من everyayah.com وmp3quran.net، ويمكن تنزيل أي سورة للاستماع دون إنترنت.</p>
      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="space-y-3">
          {groups.map(([name, list]) => (
            <section key={name} className={card}>
              <h2 className="mb-2 font-semibold">{name}</h2>
              <div className="flex flex-wrap gap-1.5">
                {list.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelected(r)}
                    aria-pressed={current?.id === r.id}
                    className={`rounded-full border px-3 py-1 text-sm ${current?.id === r.id ? 'border-accent bg-accent-soft text-accent' : 'border-line'}`}
                  >
                    {r.style}
                  </button>
                ))}
              </div>
            </section>
          ))}
          {minshawiItems.length > 0 && (
            <section className={`${card} border-gold/50`}>
              <h2 className="mb-1 font-semibold">مكتبة المنشاوي</h2>
              <p className="mb-2 text-xs text-muted">المرتل والمجوّد والمعلّم، وتسجيل عام ١٣٨٧هـ.</p>
              <div className="flex flex-wrap gap-1.5">
                {minshawiItems.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelected(r)}
                    aria-pressed={current?.id === r.id}
                    className={`rounded-full border px-3 py-1 text-sm ${current?.id === r.id ? 'border-accent bg-accent-soft text-accent' : 'border-line'}`}
                  >
                    {r.style}
                  </button>
                ))}
              </div>
            </section>
          )}
        </aside>
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">
              {current.name} · {current.style}
            </h2>
            {!current.special && current.id !== player.reciter?.id && (
              <button type="button" className={btn} onClick={() => player.setReciter(current.id)}>
                اجعله القارئ الافتراضي
              </button>
            )}
            {!current.special && current.id === player.reciter?.id && <span className="text-sm text-accent">القارئ الافتراضي</span>}
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث عن سورة…"
              aria-label="ابحث عن سورة"
              className="ms-auto w-44 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm"
            />
          </div>
          {!current.surah_url && <p className="mb-2 text-sm text-muted">هذا القارئ متاح آية آية فقط؛ افتح السورة في المصحف واضغط «استمع».</p>}
          <SurahTable surahs={filtered} reciter={current.special ? null : current} special={current.special ? current : null} downloads={downloads} />
        </div>
      </div>
    </div>
  )
}

export function OfflineAudio() {
  const downloads = useDownloads()
  const player = usePlayer()
  const { data: reciters } = useApi('/reciters')
  const [estimate, setEstimate] = useState(null)
  useEffect(() => {
    navigator.storage?.estimate?.().then(setEstimate).catch(() => {})
  }, [downloads])
  const total = downloads.reduce((n, d) => n + d.size, 0)
  const playSaved = (d) => {
    const src = (reciters ?? []).find((r) => d.url.startsWith(r.surah_url?.split('{sss}')[0] ?? '\u0000'))
    const special = { name: d.reciter, style: d.style, surah_url: d.url.replace(/\d{3}\.mp3$/, '{sss}.mp3') }
    player.playSurah(d.surah, d.title.replace('سورة ', ''), src ? null : special)
    if (src) player.setReciter(src.id)
  }
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">الاستماع دون إنترنت</h1>
      <p className="mb-4 text-sm text-muted">
        نزّل السور من <Link to="/listen/reciters" className="text-accent underline-offset-4 hover:underline">مكتبة القرّاء</Link>، فتُحفظ في
        هذا المتصفح وتعمل دون اتصال.
      </p>
      <p className="mb-3 text-sm">
        المحفوظ: {arabicNumber(downloads.length)} ملفاً · {formatSize(total)}
        {estimate?.quota ? ` · المساحة المتاحة للمتصفح نحو ${formatSize(estimate.quota - estimate.usage)}` : ''}
      </p>
      {downloads.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-muted">لا تلاوات محفوظة بعد.</p>
      ) : (
        <ul className="space-y-1.5">
          {[...downloads]
            .sort((a, b) => a.surah - b.surah)
            .map((d) => (
              <li key={d.url} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{d.title}</span>
                  <span className="block text-xs text-muted">
                    {d.reciter} · {d.style} · {formatSize(d.size)}
                  </span>
                </span>
                <button type="button" className={btn} onClick={() => playSaved(d)}>
                  ▶ تشغيل
                </button>
                <button type="button" className={`${btn} text-[var(--pen-red)]`} onClick={() => removeDownload(d.url)}>
                  حذف
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
