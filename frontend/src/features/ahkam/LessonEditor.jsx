import { useState } from 'react'
import { arabicNumber, useApi } from '../../lib/api'

/** حقل نصي على سطور الدفتر. */
export function Field({ label, value, onChange, placeholder, rows = 2, id }) {
  return (
    <label className="block" htmlFor={id}>
      <span className="notebook-label">{label}</span>
      <textarea
        id={id}
        className="notebook-field mt-0 block"
        rows={rows}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

const smallBtn =
  'rounded-md border border-line bg-surface px-2.5 text-sm leading-8 hover:border-accent hover:text-accent disabled:opacity-40'

function move(list, i, d) {
  const next = [...list]
  const j = i + d
  if (j < 0 || j >= next.length) return list
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

/** كلمات الآية أزراراً: اضغط كلمة لاختيارها، واضغط أخرى مع Shift لاختيار ما بينهما. */
function WordPicker({ surah, ayah, word, onPick }) {
  const { data, error, loading } = useApi(surah && ayah ? `/ayah/${surah}/${ayah}` : null)
  const [anchor, setAnchor] = useState(null)
  if (loading && !data) return <p className="text-sm text-muted">جارٍ جلب الآية…</p>
  if (error) return <p className="text-sm text-[var(--pen-red)]">{error.message}</p>
  if (!data) return null
  const selected = (w) => word && data.text.slice(w.start, w.end) && word.includes(data.text.slice(w.start, w.end))
  const pick = (i, extend) => {
    const a = extend && anchor !== null ? Math.min(anchor, i) : i
    const b = extend && anchor !== null ? Math.max(anchor, i) : i
    if (!extend) setAnchor(i)
    onPick(data.text.slice(data.words[a].start, data.words[b].end))
  }
  return (
    <div>
      <p className="text-xs text-muted">اضغط كلمة الشاهد في الآية (مع Shift لاختيار أكثر من كلمة):</p>
      <div className="font-quran flex flex-wrap gap-x-1 text-[1.45rem]" role="group" aria-label="كلمات الآية">
        {data.words.map((w, i) => (
          <button
            key={w.start}
            type="button"
            onClick={(e) => pick(i, e.shiftKey)}
            aria-pressed={!!selected(w)}
            className={`rounded px-1 ${selected(w) ? 'bg-gold/30 ring-1 ring-gold' : 'hover:bg-surface-2'}`}
          >
            {w.text}
          </button>
        ))}
        <span className="text-gold">﴿{arabicNumber(ayah)}﴾</span>
      </div>
    </div>
  )
}

function ExampleRow({ ex, index, count, surahs, onChange, onRemove, onMove }) {
  const surah = surahs?.find((s) => s.number === Number(ex.surah))
  return (
    <li className="my-[calc(var(--rule)*0.5)] rounded-lg border border-dashed border-line bg-surface/70 p-3 leading-normal">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="block text-muted">السورة</span>
          <select
            className="rounded-md border border-line bg-surface px-2 py-1.5"
            value={ex.surah}
            onChange={(e) => onChange({ ...ex, surah: Number(e.target.value), word: '' })}
          >
            {(surahs ?? []).map((s) => (
              <option key={s.number} value={s.number}>
                {arabicNumber(s.number)} - {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-muted">الآية</span>
          <input
            type="number"
            min={1}
            max={surah?.ayah_count ?? 286}
            className="w-20 rounded-md border border-line bg-surface px-2 py-1.5"
            value={ex.ayah}
            onChange={(e) => onChange({ ...ex, ayah: Number(e.target.value) || 1, word: '' })}
          />
        </label>
        <span className="ms-auto flex gap-1">
          <button type="button" className={smallBtn} onClick={() => onMove(-1)} disabled={index === 0} aria-label="تقديم المثال">
            ↑
          </button>
          <button type="button" className={smallBtn} onClick={() => onMove(1)} disabled={index === count - 1} aria-label="تأخير المثال">
            ↓
          </button>
          <button type="button" className={`${smallBtn} text-[var(--pen-red)]`} onClick={onRemove}>
            حذف
          </button>
        </span>
      </div>
      <div className="mt-2">
        <WordPicker surah={ex.surah} ayah={ex.ayah} word={ex.word} onPick={(word) => onChange({ ...ex, word })} />
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-sm">
          <span className="block text-muted">كلمة الشاهد (تُملأ بالضغط على الآية، ويمكن كتابتها)</span>
          <input className="w-full rounded-md border border-line bg-surface px-2 py-1.5" value={ex.word ?? ''} onChange={(e) => onChange({ ...ex, word: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="block text-muted">سبب الحكم</span>
          <input
            className="w-full rounded-md border border-line bg-surface px-2 py-1.5"
            placeholder="مثل: نون ساكنة بعدها تاء"
            value={ex.note ?? ''}
            onChange={(e) => onChange({ ...ex, note: e.target.value })}
          />
        </label>
      </div>
    </li>
  )
}

export function ExamplesEditor({ examples, onChange }) {
  const { data: surahs } = useApi('/surahs')
  const set = (i, ex) => onChange(examples.map((x, j) => (j === i ? ex : x)))
  return (
    <div>
      <ol className="list-none">
        {examples.map((ex, i) => (
          <ExampleRow
            key={i}
            ex={ex}
            index={i}
            count={examples.length}
            surahs={surahs}
            onChange={(next) => set(i, next)}
            onRemove={() => onChange(examples.filter((_, j) => j !== i))}
            onMove={(d) => onChange(move(examples, i, d))}
          />
        ))}
      </ol>
      <button type="button" className={smallBtn} onClick={() => onChange([...examples, { surah: 1, ayah: 1, word: '', note: '' }])}>
        + إضافة مثال من القرآن
      </button>
    </div>
  )
}

const VERSE_SOURCES = ['تحفة الأطفال', 'المقدمة الجزرية']

export function VersesEditor({ verses, onChange }) {
  const set = (i, patch) => onChange(verses.map((v, j) => (j === i ? { ...v, ...patch } : v)))
  return (
    <div>
      <datalist id="verse-sources">
        {VERSE_SOURCES.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {verses.map((v, i) => (
        <div key={i} className="my-[calc(var(--rule)*0.25)] grid gap-2 rounded-lg border border-dashed border-line bg-surface/70 p-3 leading-normal sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <input list="verse-sources" className="min-w-0 rounded-md border border-line bg-surface px-2 py-1.5 text-sm" placeholder="المصدر" value={v.source} onChange={(e) => set(i, { source: e.target.value })} />
          <input className="min-w-0 rounded-md border border-line bg-surface px-2 py-1.5" placeholder="الشطر الأول" value={v.first} onChange={(e) => set(i, { first: e.target.value })} />
          <input className="min-w-0 rounded-md border border-line bg-surface px-2 py-1.5" placeholder="الشطر الثاني" value={v.second} onChange={(e) => set(i, { second: e.target.value })} />
          <span className="flex gap-1">
            <button type="button" className={smallBtn} onClick={() => onChange(move(verses, i, -1))} disabled={i === 0} aria-label="تقديم البيت">
              ↑
            </button>
            <button type="button" className={`${smallBtn} text-[var(--pen-red)]`} onClick={() => onChange(verses.filter((_, j) => j !== i))}>
              حذف
            </button>
          </span>
        </div>
      ))}
      <button type="button" className={smallBtn} onClick={() => onChange([...verses, { source: verses.at(-1)?.source ?? '', first: '', second: '' }])}>
        + إضافة بيت
      </button>
    </div>
  )
}

export function TableEditor({ table, onChange }) {
  if (!table)
    return (
      <button type="button" className={smallBtn} onClick={() => onChange({ caption: '', headers: ['', ''], rows: [['', '']] })}>
        + إضافة جدول
      </button>
    )
  const cols = table.headers.length
  const setCell = (r, c, v) => onChange({ ...table, rows: table.rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)) })
  const cell = 'w-full min-w-24 rounded border border-line bg-surface px-2 py-1'
  return (
    <div className="leading-normal">
      <input className={`${cell} mb-2`} placeholder="عنوان الجدول" value={table.caption} onChange={(e) => onChange({ ...table, caption: e.target.value })} />
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1">
          <thead>
            <tr>
              {table.headers.map((h, c) => (
                <th key={c}>
                  <input className={`${cell} font-semibold`} placeholder={`عمود ${arabicNumber(c + 1)}`} value={h} onChange={(e) => onChange({ ...table, headers: table.headers.map((x, j) => (j === c ? e.target.value : x)) })} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r}>
                {row.map((v, c) => (
                  <td key={c}>
                    <input className={cell} value={v} onChange={(e) => setCell(r, c, e.target.value)} />
                  </td>
                ))}
                <td>
                  <button type="button" className={`${smallBtn} text-[var(--pen-red)]`} onClick={() => onChange({ ...table, rows: table.rows.filter((_, i) => i !== r) })} aria-label="حذف الصف">
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={smallBtn} onClick={() => onChange({ ...table, rows: [...table.rows, Array(cols).fill('')] })}>
          + صف
        </button>
        <button type="button" className={smallBtn} onClick={() => onChange({ ...table, headers: [...table.headers, ''], rows: table.rows.map((r) => [...r, '']) })}>
          + عمود
        </button>
        {cols > 1 && (
          <button type="button" className={smallBtn} onClick={() => onChange({ ...table, headers: table.headers.slice(0, -1), rows: table.rows.map((r) => r.slice(0, -1)) })}>
            − عمود
          </button>
        )}
        <button type="button" className={`${smallBtn} text-[var(--pen-red)]`} onClick={() => onChange(null)}>
          حذف الجدول
        </button>
      </div>
    </div>
  )
}

export function RulesPicker({ value, onChange }) {
  const { data } = useApi('/rules')
  if (!data) return null
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  return (
    <div className="flex flex-wrap gap-2 py-1 leading-normal">
      {data.map((r) => (
        <button
          key={r.id}
          type="button"
          aria-pressed={value.includes(r.id)}
          onClick={() => toggle(r.id)}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${value.includes(r.id) ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface'}`}
        >
          <span className="size-2.5 rounded-full" style={{ background: r.color }} aria-hidden="true" />
          {r.name}
        </button>
      ))}
    </div>
  )
}
