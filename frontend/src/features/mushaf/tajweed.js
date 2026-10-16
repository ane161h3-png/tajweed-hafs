// منطق التلوين: تقسيم نص الآية إلى مقاطع بحسب مواضع الأحكام، وألوان كل حكم وأنماطه.

/** أبواب فهرس الألوان بالترتيب المعروض. */
export const GROUP_ORDER = ['noon', 'meem', 'ghunnah', 'madd', 'qalqalah', 'silent', 'idgham']

/**
 * يقسم النص إلى مقاطع متتالية، لكل مقطع قائمة الأحكام التي تغطيه.
 * الأحكام في المقطع مرتبة من الأخص (الأقصر مدى) إلى الأعم؛ الأول هو الذي يُلوَّن به.
 * المواضع end غير شاملة. لا يتغير النص: ضمّ المقاطع يعيد النص الأصلي حرفاً بحرف.
 */
export function buildSegments(text, marks = []) {
  const valid = marks.filter((m) => m.start < m.end && m.start < text.length && m.end > 0)
  if (!valid.length) return [{ text, start: 0, rules: [] }]
  const cuts = new Set([0, text.length])
  for (const m of valid) {
    cuts.add(Math.max(0, m.start))
    cuts.add(Math.min(text.length, m.end))
  }
  const points = [...cuts].sort((a, b) => a - b)
  const segments = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const covering = valid
      .filter((m) => m.start <= a && m.end >= b)
      .sort((x, y) => x.end - x.start - (y.end - y.start))
    const rules = [...new Set(covering.map((m) => m.rule))]
    const prev = segments.at(-1)
    if (prev && prev.rules.join() === rules.join()) prev.text += text.slice(a, b)
    else segments.push({ text: text.slice(a, b), start: a, rules })
  }
  return segments
}

/** عدد مواضع كل حكم في مجموعة آيات: { ruleId: count } */
export function countRules(ayahs) {
  const counts = {}
  for (const a of ayahs) for (const m of a.tajweed ?? []) counts[m.rule] = (counts[m.rule] ?? 0) + 1
  return counts
}

// وضع عمى الألوان: لكل باب نمط خط سفلي، ولكل حكم داخل الباب لون من لوحة Okabe–Ito
// (مميّزة لأغلب أنواع عمى الألوان). أحكام «حروف لا تُنطق» تُعرض باهتة بلا خط.
const OKABE = { orange: '#E69F00', sky: '#56B4E9', green: '#009E73', blue: '#0072B2', red: '#D55E00', pink: '#CC79A7' }
export const COLOR_BLIND = {
  ikhfa: { color: OKABE.orange, line: 'solid' },
  idghaam_ghunnah: { color: OKABE.green, line: 'solid' },
  idghaam_no_ghunnah: { color: OKABE.sky, line: 'solid' },
  iqlab: { color: OKABE.pink, line: 'solid' },
  ikhfa_shafawi: { color: OKABE.red, line: 'double' },
  idghaam_shafawi: { color: OKABE.blue, line: 'double' },
  ghunnah: { color: OKABE.orange, line: 'dashed' },
  qalqalah: { color: OKABE.blue, line: 'dashed' },
  madd_2: { color: OKABE.sky, line: 'wavy' },
  madd_muttasil: { color: OKABE.red, line: 'wavy' },
  madd_munfasil: { color: OKABE.pink, line: 'wavy' },
  madd_246: { color: OKABE.green, line: 'wavy' },
  madd_6: { color: OKABE.orange, line: 'wavy' },
  idghaam_mutajanisayn: { color: OKABE.red, line: 'dotted' },
  idghaam_mutaqaribayn: { color: OKABE.blue, line: 'dotted' },
  hamzat_wasl: { color: '#8a8f96', line: 'none' },
  lam_shamsiyyah: { color: '#8a8f96', line: 'none' },
  silent: { color: '#8a8f96', line: 'none' },
}

/** لون الحكم الفعلي: تعديل المستخدم، ثم لون الوضع الليلي، ثم اللون الأصلي. */
export function ruleColor(rule, { dark = false, overrides = {} } = {}) {
  return overrides[rule.id] ?? (dark ? rule.color_dark : null) ?? rule.color
}

/** أنماط CSS لكل الأحكام: التلوين العادي، ووضع عمى الألوان، وإبراز حكم واحد. */
export function rulesCss(rules, { dark = false, overrides = {} } = {}) {
  const css = []
  for (const r of rules) {
    const id = r.id
    const color = ruleColor(r, { dark, overrides })
    const cb = COLOR_BLIND[id] ?? { color, line: 'solid' }
    const cbColor = dark ? `color-mix(in srgb, ${cb.color} 75%, white)` : cb.color
    css.push(
      `.mushaf{--tj-${id}:${color}}`,
      `.mushaf.colors-on .tjp-${id}{color:var(--tj-${id})}`,
      cb.line === 'none'
        ? `.mushaf.colors-on.cb .tjp-${id}{color:${cbColor};opacity:.7}`
        : `.mushaf.colors-on.cb .tjp-${id}{color:${cbColor};text-decoration:underline ${cb.line} ${cbColor};text-decoration-thickness:${cb.line === 'double' ? '3px' : '2px'};text-underline-offset:.5em;text-decoration-skip-ink:none}`,
      `.mushaf[data-focus="${id}"] .tj-${id}{color:var(--tj-${id})!important;background:color-mix(in srgb,var(--tj-${id}) 22%,transparent);border-radius:3px;opacity:1}`,
      `.mushaf.cb[data-focus="${id}"] .tj-${id}{color:${cbColor}!important;background:color-mix(in srgb,${cb.color} 22%,transparent)}`,
    )
  }
  return css.join('\n')
}
