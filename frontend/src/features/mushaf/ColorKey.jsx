import { useState } from 'react'
import { arabicNumber } from '../../lib/api'
import { useSettings } from '../settings/SettingsContext'
import { COLOR_BLIND, ruleColor } from './tajweed'

function Switch({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-sm">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-line'}`}
      >
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${checked ? 'start-[1.375rem]' : 'start-0.5'}`} />
      </button>
    </label>
  )
}

/** عيّنة الحكم في الفهرس: حرف بلونه (وبخطه في وضع عمى الألوان). */
function Sample({ rule, color, cb }) {
  const style = cb ? COLOR_BLIND[rule.id] : null
  return (
    <span
      aria-hidden="true"
      className="font-quran inline-block w-7 text-center !text-xl !leading-none"
      style={
        style
          ? {
              color: style.color,
              opacity: style.line === 'none' ? 0.7 : 1,
              textDecoration: style.line === 'none' ? 'none' : `underline ${style.line} ${style.color}`,
              textDecorationThickness: style.line === 'double' ? 3 : 2,
              textUnderlineOffset: '0.45em',
            }
          : { color }
      }
    >
      نْ
    </span>
  )
}

/**
 * فهرس الألوان مجمّعاً حسب الأبواب. الضغط على حكم يُبرز مواضعه ويخفّت الباقي،
 * والضغط مرة ثانية يرجع الكل. counts: عدد مواضع كل حكم في الصفحة الحالية.
 */
export default function ColorKey({ groups, counts, focus, onFocus, occurrence, onStep, nextSurah }) {
  const { settings, update, dark } = useSettings()
  const [customize, setCustomize] = useState(false)
  const colorsOn = settings.tajweedColors
  const setColor = (id, value) => update({ ruleColors: { ...settings.ruleColors, [id]: value } })

  return (
    <div className="text-sm">
      <h2 className="mb-1 font-semibold">فهرس الألوان</h2>
      <Switch label="تلوين الأحكام" checked={colorsOn} onChange={(v) => update({ tajweedColors: v })} />
      <Switch label="وضع عمى الألوان (خطوط مميّزة)" checked={settings.colorBlind} onChange={(v) => update({ colorBlind: v })} />

      {focus && (
        <div className="my-2 rounded-lg bg-accent-soft p-2.5 text-accent" role="status">
          <p className="font-medium">
            {counts[focus] ? `${arabicNumber(counts[focus])} موضعاً في هذه الصفحة` : 'لا مواضع لهذا الحكم في هذه الصفحة'}
          </p>
          {counts[focus] > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <button type="button" onClick={() => onStep(-1)} className="rounded-md border border-accent/40 px-2 py-0.5">
                → السابق
              </button>
              <span className="tabular-nums">
                {arabicNumber(occurrence + 1)} / {arabicNumber(counts[focus])}
              </span>
              <button type="button" onClick={() => onStep(1)} className="rounded-md border border-accent/40 px-2 py-0.5">
                التالي ←
              </button>
            </div>
          )}
          {nextSurah}
          <button type="button" onClick={() => onFocus(null)} className="mt-1.5 underline underline-offset-4">
            إظهار كل الأحكام
          </button>
        </div>
      )}

      <div className="mt-2 space-y-3">
        {groups.map((g) => (
          <section key={g.id} aria-label={g.name}>
            <h3 className="mb-0.5 text-xs font-semibold text-muted">{g.name}</h3>
            <ul>
              {g.rules.map((r) => {
                const color = ruleColor(r, { dark, overrides: settings.ruleColors })
                return (
                  <li key={r.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-pressed={focus === r.id}
                      onClick={() => onFocus(focus === r.id ? null : r.id)}
                      className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1.5 py-1 text-start ${
                        focus === r.id ? 'bg-accent-soft font-semibold' : focus ? 'opacity-50 hover:opacity-100' : 'hover:bg-surface-2'
                      }`}
                    >
                      <Sample rule={r} color={color} cb={settings.colorBlind} />
                      <span className="min-w-0 flex-1 truncate">{r.name}</span>
                      {counts[r.id] > 0 && <span className="text-xs tabular-nums text-muted">{arabicNumber(counts[r.id])}</span>}
                    </button>
                    {customize && (
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(r.id, e.target.value)}
                        className="size-7 shrink-0 cursor-pointer rounded border border-line bg-transparent"
                        aria-label={`لون ${r.name}`}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-2">
        <button type="button" onClick={() => setCustomize((c) => !c)} className="text-accent underline-offset-4 hover:underline">
          {customize ? 'تمّ' : 'تخصيص الألوان'}
        </button>
        {Object.keys(settings.ruleColors ?? {}).length > 0 && (
          <button type="button" onClick={() => update({ ruleColors: {} })} className="text-muted underline-offset-4 hover:underline">
            استعادة الألوان الأصلية
          </button>
        )}
      </div>
    </div>
  )
}
