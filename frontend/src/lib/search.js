// البحث الذكي داخل التطبيق دون خادم: نسخة مطابقة لـ backend/app/search.py.
// يعمل على search-index.json (نص كل آية مع صيغتيه المطبّعتين).
import { JUZ_NICKNAMES, normalize, parseOrdinal, toAsciiDigits } from './arabic'
import { findWord } from './matching'

const REF = /^(?:(\d{1,3})\s*[:：/.\-]\s*(\d{1,3})|(\d{1,3})\s+(\d{1,3}))$/
const JUZ = /^(?:ال)?جزء?\s*(.*)$/
const NAME_AYAH = /^(.+?)\s+(\d{1,3})$/

export function parse(q) {
  const raw = toAsciiDigits(q).trim()
  const qn = normalize(raw)
  let m = raw.match(REF)
  if (m) {
    const [s, a] = m[1] ? [m[1], m[2]] : [m[3], m[4]]
    return { kind: 'ref', text: qn, surah: Number(s), ayah: Number(a) }
  }
  if (/^\d+$/.test(raw)) return { kind: 'surah_num', text: qn, surah: Number(raw) }
  m = qn.match(JUZ)
  if (m) {
    const rest = m[1].trim()
    const n = (rest ? parseOrdinal(rest) : null) || JUZ_NICKNAMES[rest]
    if (n) return { kind: 'juz', text: qn, juz: n }
  }
  m = qn.match(NAME_AYAH)
  if (m) return { kind: 'name_ayah', text: stripSurahWord(m[1]), ayah: Number(m[2]) }
  return { kind: 'text', text: qn }
}

export const stripSurahWord = (name) => name.replace(/^سوره\s+/, '').trim()
const bare = (name) => (name.startsWith('ال') && name.length > 3 ? name.slice(2) : name)

/** فهرس البحث مع كلمات كل آية مقسّمة مسبقاً. */
export function prepareIndex(raw) {
  const ayahs = raw.ayahs.map(([surah, ayah, juz, text, a, b], id) => ({
    id: id + 1, surah, ayah, juz, text, wa: a.split(' '), wb: b.split(' '),
  }))
  const surahs = raw.surahs.map(([number, name, name_norm, ayah_count, revelation]) => ({ number, name, name_norm, ayah_count, revelation }))
  return {
    ayahs,
    surahs,
    juz: raw.juz.map(([number, surah, ayah]) => ({ number, surah, ayah })),
    byRef: new Map(ayahs.map((a) => [`${a.surah}:${a.ayah}`, a])),
    surahName: Object.fromEntries(surahs.map((s) => [s.number, s.name])),
  }
}

export function matchSurahs(index, name, limit = 5) {
  name = stripSurahWord(normalize(name))
  if (!name) return []
  const scored = []
  for (const row of index.surahs) {
    const cands = [row.name_norm, bare(row.name_norm)]
    let score
    if (cands.includes(name)) score = 0
    else if (cands.some((c) => c.startsWith(name) || c.startsWith(bare(name)))) score = 1
    else if (name.length >= 3 && cands.some((c) => c.includes(name) || c.includes(bare(name)))) score = 2
    else continue
    scored.push([score, row.number, row])
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, limit).map((x) => x[2])
}

export function textTokens(text) {
  const t = text.replace(/[^\p{L}\p{N}_\s]/gu, ' ').split(/\s+/).filter(Boolean)
  return t.join('').length < 2 ? [] : t
}

function phraseIn(words, t) {
  const n = t.length
  for (let i = 0; i + n <= words.length; i++) {
    let ok = true
    for (let j = 0; j < n - 1 && ok; j++) ok = words[i + j] === t[j]
    if (ok && words[i + n - 1].startsWith(t[n - 1])) return true
  }
  return false
}

const hasWord = (a, w, prefix) => (prefix ? a.wa.some((x) => x.startsWith(w)) || a.wb.some((x) => x.startsWith(w)) : a.wa.includes(w) || a.wb.includes(w))

/** العبارة المتصلة أولاً، ثم كل الكلمات بأي ترتيب؛ الآيات الأقصر أولاً (كترتيب FTS5). */
export function searchText(index, text, limit) {
  const t = textTokens(text)
  if (!t.length) return [[], 0]
  const order = (x, y) => x.wa.length - y.wa.length || x.id - y.id
  const phrase = index.ayahs.filter((a) => phraseIn(a.wa, t) || phraseIn(a.wb, t)).sort(order)
  const all = t.length > 1 && phrase.length < limit ? index.ayahs.filter((a) => t.every((w, i) => hasWord(a, w, i === t.length - 1))).sort(order) : []
  // كالخادم: يُحسب العدد من كل مرحلة حتى تمتلئ النتائج
  const seen = new Set()
  const out = []
  let total = 0
  for (const list of t.length > 1 ? [phrase, all] : [phrase]) {
    total = Math.max(total, list.length)
    for (const a of list) {
      if (out.length >= limit) break
      if (!seen.has(a.id)) {
        seen.add(a.id)
        out.push(a)
      }
    }
    if (out.length >= limit) break
  }
  return [out, Math.max(total, seen.size)]
}

const ayahResult = (index, a) => ({ type: 'ayah', surah: a.surah, ayah: a.ayah, juz: a.juz, text: a.text, surah_name: index.surahName[a.surah] })
const surahResult = (r) => ({ type: 'surah', surah: r.number, name: r.name, ayah_count: r.ayah_count, revelation: r.revelation })

export function search(index, q, limit = 20) {
  const p = parse(q)
  let results = []
  let totalText = 0
  if (p.kind === 'ref') {
    const a = index.byRef.get(`${p.surah}:${p.ayah}`)
    if (a) results.push(ayahResult(index, a))
  } else if (p.kind === 'surah_num') {
    const s = index.surahs[p.surah - 1]
    if (s) results.push(surahResult(s))
  } else if (p.kind === 'juz') {
    const j = index.juz[p.juz - 1]
    if (j) results.push({ type: 'juz', juz: j.number, surah: j.surah, ayah: j.ayah, surah_name: index.surahName[j.surah] ?? null })
  } else if (p.kind === 'name_ayah') {
    for (const s of matchSurahs(index, p.text, 3)) {
      const a = index.byRef.get(`${s.number}:${p.ayah}`)
      if (a) results.push(ayahResult(index, a))
    }
  }
  if ((p.kind === 'text' || p.kind === 'name_ayah') && !results.length) {
    results = matchSurahs(index, p.text).map(surahResult)
    const [found, total] = searchText(index, p.text, Math.max(0, limit - results.length))
    totalText = total
    results.push(...found.map((a) => ayahResult(index, a)))
  }
  for (const r of results) if (r.type === 'ayah' && p.kind === 'text') r.match = findWord(r.text, p.text)
  return { query: q, kind: p.kind, results: results.slice(0, limit), total_text: totalText }
}
