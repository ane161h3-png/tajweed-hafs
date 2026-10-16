// تطبيع النص العربي للبحث داخل التطبيق: نسخة مطابقة لـ backend/app/arabic.py.
// للبحث فقط؛ النص المعروض يبقى كما هو في المصدر.

const MARKS = /[ً-ٟۖ-ۭ࣓-ࣿـ]/g
const DAGGER = 'ٰ'
const ALEFS = /[أإآٱٲٳٵ]/g
const DIGITS = '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹'
const NON_WORD = /[^\p{L}\p{N}_\s:]/gu

export function toAsciiDigits(s) {
  return s.replace(/[٠-٩۰-۹]/g, (d) => String(DIGITS.indexOf(d) % 10))
}

export function normalize(s, { spellDagger = false } = {}) {
  s = toAsciiDigits(s.normalize('NFC'))
  if (spellDagger) {
    s = s.replace(/[ۦۧ]/g, 'ي').replace(MARKS, '')
    s = s.replaceAll('و' + DAGGER + 'ة', 'اة')
    s = s.replace(new RegExp('ى' + DAGGER + '(?=[\\p{L}\\p{N}_])', 'gu'), 'ا')
    s = s.replaceAll('ى' + DAGGER, 'ى').replaceAll(DAGGER, 'ا')
  } else {
    s = s.replace(MARKS, '').replaceAll(DAGGER, '')
  }
  s = s.replace(ALEFS, 'ا').replaceAll('ى', 'ي').replaceAll('ة', 'ه')
  return s.replace(NON_WORD, ' ').replace(/\s+/g, ' ').trim()
}

const UNITS = ['', 'الاول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع']
const COMPOUND = ['', 'الحادي', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع']

export const ORDINALS = (() => {
  const t = {}
  for (let n = 1; n < 10; n++) t[UNITS[n]] = n
  t['العاشر'] = 10
  for (let n = 1; n < 10; n++) t[`${COMPOUND[n]} عشر`] = 10 + n
  t['العشرون'] = t['العشرين'] = 20
  for (let n = 1; n < 10; n++) t[`${COMPOUND[n]} والعشرون`] = t[`${COMPOUND[n]} والعشرين`] = 20 + n
  t['الثلاثون'] = t['الثلاثين'] = 30
  for (const [k, v] of Object.entries({ ...t })) if (k.startsWith('ال') && !(k.slice(2) in t)) t[k.slice(2)] = v
  return t
})()

export const JUZ_NICKNAMES = { عم: 30, تبارك: 29, 'قد سمع': 28 }

export function parseOrdinal(word) {
  const w = normalize(word)
  if (/^\d+$/.test(w)) return Number(w)
  return ORDINALS[w] ?? null
}
