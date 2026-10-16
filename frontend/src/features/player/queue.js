// منطق قائمة التشغيل والتكرار، بلا صوت ولا واجهة (يُختبر وحده).

export const NO_BISMILLAH = new Set([1, 9])
const pad3 = (n) => String(n).padStart(3, '0')

/**
 * يبني قائمة آيات للتشغيل آية آية من كتل [{surah, ayahs:[{ayah}]}].
 * قبل الآية الأولى من كل سورة (عدا الفاتحة والتوبة) تُضاف البسملة، وتُشغَّل من ملف الفاتحة ١.
 */
export function buildAyahQueue(blocks) {
  const items = []
  for (const b of blocks) {
    for (const a of b.ayahs) {
      if (a.ayah === 1 && !NO_BISMILLAH.has(b.surah)) items.push({ kind: 'bismillah', surah: b.surah, ayah: 0 })
      items.push({ kind: 'ayah', surah: b.surah, ayah: a.ayah })
    }
  }
  return items
}

export function itemUrl(item, reciter) {
  if (!reciter) return null
  if (item.kind === 'surah') return reciter.surah_url?.replace('{sss}', pad3(item.surah)) ?? null
  const [s, a] = item.kind === 'bismillah' ? [1, 1] : [item.surah, item.ayah]
  return reciter.ayah_url?.replace('{sss}', pad3(s)).replace('{aaa}', pad3(a)) ?? null
}

/** فهرس العنصر في القائمة لآية معيّنة؛ إن كانت الأولى في سورتها يبدأ من البسملة. */
export function indexOf(items, surah, ayah, { withBismillah = true } = {}) {
  const i = items.findIndex((x) => x.kind !== 'bismillah' && x.surah === surah && (x.ayah === ayah || x.kind === 'surah'))
  if (i > 0 && withBismillah && items[i - 1].kind === 'bismillah') return i - 1
  return i
}

export const initialState = {
  items: [],
  index: -1,
  from: 0,
  to: -1,
  repeatAyah: 1, // عدد مرات كل آية (Infinity = بلا نهاية)
  repeatRange: 1, // عدد مرات المقطع كاملاً
  ayahPass: 0,
  rangePass: 0,
  status: 'idle', // idle | playing | paused | error
  error: null,
  token: 0, // يزيد كلما بدأ تشغيل عنصر (أو إعادته)؛ الإيقاف المؤقت والاستئناف لا يغيّرانه
}

/**
 * الانتقال بعد انتهاء العنصر الحالي.
 * البسملة لا تُكرَّر. الآية تُكرَّر repeatAyah مرة، ثم التالية، وعند آخر المقطع يُعاد المقطع repeatRange مرة.
 */
export function onEnded(state) {
  const item = state.items[state.index]
  if (!item) return { ...state, status: 'idle' }
  if (item.kind !== 'bismillah' && state.ayahPass + 1 < state.repeatAyah) {
    return { ...state, ayahPass: state.ayahPass + 1 }
  }
  if (state.index < state.to) return { ...state, index: state.index + 1, ayahPass: 0 }
  if (state.rangePass + 1 < state.repeatRange) {
    return { ...state, index: state.from, ayahPass: 0, rangePass: state.rangePass + 1 }
  }
  return { ...state, status: 'idle', index: state.from, ayahPass: 0, rangePass: 0 }
}

function start(state, patch) {
  return { ...state, ...patch, status: 'playing', error: null, token: state.token + 1 }
}

export function reducer(state, action) {
  switch (action.type) {
    case 'load': {
      const items = action.items
      const from = Math.max(0, action.from ?? 0)
      const to = Math.min(items.length - 1, action.to ?? items.length - 1)
      return start(state, { items, from, to, index: action.start ?? from, ayahPass: 0, rangePass: 0 })
    }
    case 'ended': {
      const next = onEnded(state)
      return next.status === 'playing' ? { ...next, token: state.token + 1 } : next
    }
    case 'jump':
      return start(state, { index: Math.min(Math.max(action.index, 0), state.items.length - 1), ayahPass: 0 })
    case 'next':
      return state.index < state.items.length - 1 ? start(state, { index: state.index + 1, ayahPass: 0 }) : state
    case 'prev': {
      let i = state.index - 1
      if (state.items[i]?.kind === 'bismillah' && i > 0) i -= 1
      return i >= 0 ? start(state, { index: i, ayahPass: 0 }) : state
    }
    case 'repeat':
      return { ...state, repeatAyah: action.repeatAyah ?? state.repeatAyah, repeatRange: action.repeatRange ?? state.repeatRange }
    case 'range':
      return { ...state, from: action.from, to: action.to, rangePass: 0, ayahPass: 0 }
    case 'status':
      return { ...state, status: action.status, error: action.error ?? null }
    case 'stop':
      return { ...initialState, repeatAyah: state.repeatAyah, repeatRange: state.repeatRange, token: state.token }
    default:
      return state
  }
}
