import { useState } from 'react'
import { Link } from 'react-router'
import { arabicNumber, STATIC, useApi } from '../../lib/api'
import { clearProgress, completedLessons } from '../progress/progress'
import { usePlayer, RATES } from '../player/PlayerContext'
import { ruleColor, COLOR_BLIND } from '../mushaf/tajweed'
import { useRules } from '../mushaf/useRules'
import { writeJSON } from '../../lib/storage'
import { clearSrs, stats } from '../quiz/srs'
import { useBookmarks } from '../mushaf/reading'
import { useSettings } from './SettingsContext'
import { cacheAllTexts } from '../../pwa'
import { Capacitor } from '@capacitor/core'

const card = 'rounded-2xl border border-line bg-surface p-4'
const seg = (on) => `rounded-lg border px-3 py-1.5 text-sm ${on ? 'border-accent bg-accent-soft text-accent' : 'border-line'}`

export function DisplaySettings() {
  const { settings, update } = useSettings()
  const [offline, setOffline] = useState(null)
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">العرض والخط</h1>
      <section className={card}>
        <h2 className="mb-2 font-semibold">المظهر</h2>
        <div className="flex gap-2" role="radiogroup" aria-label="المظهر">
          {[
            ['system', 'حسب الجهاز'],
            ['light', 'نهاري'],
            ['dark', 'ليلي'],
          ].map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={settings.theme === v} onClick={() => update({ theme: v })} className={seg(settings.theme === v)}>
              {label}
            </button>
          ))}
        </div>
      </section>
      <section className={card}>
        <h2 className="mb-2 font-semibold">حجم خط المصحف</h2>
        <input
          type="range"
          min={0.8}
          max={2.2}
          step={0.1}
          value={settings.quranScale}
          onChange={(e) => update({ quranScale: Number(e.target.value) })}
          className="w-full accent-[var(--accent)]"
          aria-label="حجم خط المصحف"
        />
        <p className="font-quran text-center" style={{ fontSize: `calc(1.75rem * ${settings.quranScale})` }}>
          بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
        </p>
      </section>
      <LessonEditsSection />
      {STATIC && Capacitor.isNativePlatform() && window.location.hostname === 'localhost' ? (
        <section className={card}>
          <h2 className="mb-1 font-semibold">العمل دون إنترنت</h2>
          <p className="text-sm text-muted">المصحف والدروس والمخارج والأسئلة مضمّنة في التطبيق وتعمل دون اتصال. التلاوات تُنزَّل من «الاستماع».</p>
        </section>
      ) : (
      <section className={card}>
        <h2 className="mb-1 font-semibold">العمل دون إنترنت</h2>
        <p className="mb-2 text-sm text-muted">
          يحفظ نص المصحف كاملاً والدروس والمخارج والأسئلة والبحث (نحو ١١ م.ب) على هذا الجهاز لتعمل دون اتصال. التلاوات تُنزَّل من «الاستماع».
        </p>
        <button
          type="button"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-60"
          disabled={offline?.running}
          onClick={async () => {
            setOffline({ running: true, done: 0, total: 1 })
            try {
              const r = await cacheAllTexts((done, total) => setOffline({ running: true, done, total }))
              setOffline({ running: false, ok: true, total: r })
            } catch (e) {
              setOffline({ running: false, error: e.message })
            }
          }}
        >
          حفظ النصوص للعمل دون إنترنت
        </button>
        {offline?.running && (
          <p className="mt-2 text-sm text-muted" aria-live="polite">
            {arabicNumber(offline.done)} / {arabicNumber(offline.total)}
          </p>
        )}
        {offline?.ok && <p className="mt-2 text-sm text-accent">حُفظ كل شيء ({arabicNumber(offline.total)} ملفاً).</p>}
        {offline?.error && <p className="mt-2 text-sm text-[var(--pen-red)]">{offline.error}</p>}
      </section>
      )}
    </div>
  )
}

/** تعديلات الدروس المحفوظة على هذا الجهاز (نسخة الموقع والتطبيق): تصدير واستيراد. */
function LessonEditsSection() {
  const { settings, update } = useSettings()
  const [msg, setMsg] = useState(null)
  const KEY = 'tajweed.lessons.local'
  const edits = (() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || 'null') ?? { lessons: {}, deleted: [] }
    } catch {
      return { lessons: {}, deleted: [] }
    }
  })()
  const count = Object.keys(edits.lessons).length + edits.deleted.length
  const exportEdits = () => {
    const blob = new Blob([JSON.stringify(edits, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `tajweed-lesson-edits-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const importEdits = async (file) => {
    try {
      const data = JSON.parse(await file.text())
      if (!data.lessons || !Array.isArray(data.deleted)) throw new Error('ملف غير صالح')
      localStorage.setItem(KEY, JSON.stringify(data))
      setMsg(`استُورد ${arabicNumber(Object.keys(data.lessons).length)} درساً معدّلاً.`)
    } catch (e) {
      setMsg(`تعذّر الاستيراد: ${e.message}`)
    }
  }
  return (
    <section className={card}>
      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="block font-semibold">وضع تحرير الدروس</span>
          <span className="block text-sm text-muted">يُظهر زر «تعديل» و«درس جديد» في قسم الأحكام.</span>
        </span>
        <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={settings.editMode} onChange={(e) => update({ editMode: e.target.checked })} />
      </label>
      {STATIC && (
        <div className="mt-3 border-t border-line pt-3 text-sm">
          <p className="text-muted">
            التعديلات تُحفظ على هذا الجهاز فقط ({arabicNumber(count)} تعديلاً). صدّرها ملفاً لنقلها إلى جهاز آخر أو لاعتمادها في نسخة البرنامج للجميع.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={!count} onClick={exportEdits} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40">
              تصدير التعديلات
            </button>
            <label className="cursor-pointer rounded-lg border border-line px-3 py-1.5">
              استيراد ملف تعديلات
              <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files[0] && importEdits(e.target.files[0])} />
            </label>
          </div>
          {msg && <p className="mt-2 text-accent">{msg}</p>}
        </div>
      )}
    </section>
  )
}

export function ColorSettings() {
  const { settings, update, dark } = useSettings()
  const { groups } = useRules()
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">ألوان الأحكام</h1>
      <section className={card}>
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-semibold">تلوين الأحكام في المصحف</span>
          </span>
          <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={settings.tajweedColors} onChange={(e) => update({ tajweedColors: e.target.checked })} />
        </label>
        <label className="mt-3 flex items-center justify-between gap-3">
          <span>
            <span className="block font-semibold">وضع عمى الألوان</span>
            <span className="block text-sm text-muted">لكل باب خط سفلي بنمط مختلف، وألوان مميّزة لأغلب أنواع عمى الألوان.</span>
          </span>
          <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={settings.colorBlind} onChange={(e) => update({ colorBlind: e.target.checked })} />
        </label>
      </section>
      {groups.map((g) => (
        <section key={g.id} className={card}>
          <h2 className="mb-2 font-semibold">{g.name}</h2>
          <ul className="space-y-1.5">
            {g.rules.map((r) => {
              const color = ruleColor(r, { dark, overrides: settings.ruleColors })
              const cb = COLOR_BLIND[r.id]
              return (
                <li key={r.id} className="flex items-center gap-3">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => update({ ruleColors: { ...settings.ruleColors, [r.id]: e.target.value } })}
                    className="size-8 cursor-pointer rounded border border-line bg-transparent"
                    aria-label={`لون ${r.name}`}
                  />
                  <span className="flex-1">{r.name}</span>
                  <span
                    className="font-quran text-2xl"
                    style={
                      settings.colorBlind && cb
                        ? { color: cb.color, textDecoration: cb.line === 'none' ? 'none' : `underline ${cb.line} ${cb.color}`, textUnderlineOffset: '0.45em' }
                        : { color }
                    }
                    aria-hidden="true"
                  >
                    نْ
                  </span>
                  {settings.ruleColors?.[r.id] && (
                    <button
                      type="button"
                      className="text-xs text-muted hover:underline"
                      onClick={() => {
                        const { [r.id]: _, ...rest } = settings.ruleColors
                        update({ ruleColors: rest })
                      }}
                    >
                      الأصلي
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      <button type="button" onClick={() => update({ ruleColors: {} })} className="rounded-lg border border-line px-4 py-2 text-sm">
        استعادة كل الألوان الأصلية
      </button>
    </div>
  )
}

export function AudioSettings() {
  const player = usePlayer()
  const { data: reciters } = useApi('/reciters')
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">القارئ الافتراضي</h1>
      <section className={card}>
        <ul className="space-y-1.5" role="radiogroup" aria-label="القارئ">
          {(reciters ?? []).map((r) => (
            <li key={r.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                <input type="radio" name="reciter" className="accent-[var(--accent)]" checked={player.reciter?.id === r.id} onChange={() => player.setReciter(r.id)} />
                <span className="flex-1">
                  {r.name} <span className="text-sm text-muted">· {r.style}</span>
                </span>
                <span className="text-xs text-muted">{[r.ayah_url && 'آية آية', r.surah_url && 'سور كاملة'].filter(Boolean).join(' · ')}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>
      <section className={card}>
        <h2 className="mb-2 font-semibold">سرعة التلاوة</h2>
        <div className="flex flex-wrap gap-2">
          {RATES.map((r) => (
            <button key={r} type="button" onClick={() => player.setRate(r)} className={seg(player.rate === r)} dir="ltr">
              {r}×
            </button>
          ))}
        </div>
      </section>
      <p className="text-sm text-muted">
        لإضافة قارئ: أضف سطراً واحداً في <code dir="ltr">source-data/reciters.json</code> (انظر README).
      </p>
    </div>
  )
}

export function ProgressSettings() {
  const [, force] = useState(0)
  const done = Object.keys(completedLessons()).length
  const bookmarks = useBookmarks()
  const quiz = stats()
  const clearAll = () => {
    if (!window.confirm('سيُمسح تقدّمك: الدروس المقروءة، وآخر موضع، ونتائج الاختبارات. العلامات المرجعية تبقى. متابعة؟')) return
    clearProgress()
    clearSrs()
    writeJSON('tajweed.lastRead', null)
    force((n) => n + 1)
  }
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">التقدّم</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['دروس مقروءة', done],
          ['علامات مرجعية', bookmarks.length],
          ['أسئلة جرّبتها', quiz.seen],
          ['أتقنتها', quiz.mastered],
        ].map(([label, n]) => (
          <div key={label} className={`${card} text-center`}>
            <p className="text-2xl font-bold text-accent">{arabicNumber(n)}</p>
            <p className="text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>
      <section className={card}>
        <h2 className="mb-1 font-semibold">مسح التقدّم</h2>
        <p className="mb-3 text-sm text-muted">يُحفظ التقدّم في هذا المتصفح فقط.</p>
        <button type="button" onClick={clearAll} className="rounded-lg border border-[var(--pen-red)] px-4 py-2 text-sm text-[var(--pen-red)]">
          مسح التقدّم
        </button>
      </section>
      <Link to="/settings/about" className="inline-block text-accent underline-offset-4 hover:underline">
        عن البرنامج والمصادر والتراخيص ←
      </Link>
    </div>
  )
}
