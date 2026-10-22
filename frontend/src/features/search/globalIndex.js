// فهرس البحث الشامل: عناصر من كل أقسام البرنامج، وترتيب النتائج. دوال نقية قابلة للاختبار.
import { SECTIONS, sectionPath, subsectionPath } from '../../data/sections'
import { GUIDE } from '../guide/guideContent'
import { makeMatcher, norm } from '../../lib/filter'
import { PAGE_COUNT, parsePageQuery } from '../mushaf/pages'

export const GROUPS = [
  ['sections', 'الأقسام'],
  ['pages', 'صفحات المصحف'],
  ['surahs', 'السور والأجزاء'],
  ['lessons', 'الدروس'],
  ['makharij', 'المخارج'],
  ['letters', 'الحروف'],
  ['sifat', 'الصفات'],
  ['guide', 'دليل الاستخدام'],
  ['ayahs', 'آيات من المصحف'],
]
export const GROUP_LABEL = Object.fromEntries(GROUPS)
const ORDER = Object.fromEntries(GROUPS.map(([id], i) => [id, i]))

const join = (...xs) => xs.flat().filter(Boolean).join(' ')

/** عناصر الأقسام والأقسام الفرعية (ثابتة). */
export function sectionItems() {
  const items = []
  for (const s of SECTIONS) {
    items.push({ id: `sec-${s.id}`, group: 'sections', title: s.title, sub: s.description, body: '', to: sectionPath(s) })
    for (const sub of s.subsections) {
      items.push({ id: `sub-${s.id}-${sub.id}`, group: 'sections', title: sub.title, sub: `${s.title}${sub.description ? ` · ${sub.description}` : ''}`, body: '', to: subsectionPath(s, sub) })
    }
  }
  return items
}

export function guideItems() {
  return GUIDE.flatMap((s) =>
    s.items.map(([q, a]) => ({ id: `guide-${q}`, group: 'guide', title: q, sub: s.title, body: a, to: `/settings/guide?q=${encodeURIComponent(q)}` })),
  )
}

/** كل محتوى الدرس نصاً واحداً للبحث فيه. */
function lessonBody(l) {
  return join(
    l.lugha,
    l.istilah,
    l.letters,
    l.method,
    l.exceptions,
    l.notes,
    (l.verses ?? []).flatMap((v) => [v.source, v.first, v.second]),
    (l.examples ?? []).flatMap((e) => [e.word, e.note]),
    l.table ? [l.table.caption, ...(l.table.rows ?? []).flat()] : [],
  )
}

/**
 * يبني كل عناصر الفهرس من بيانات البرنامج.
 * data: { lessons: [درس كامل]، letters: محتوى letters.json، surahs، juz، juzNames }
 */
export function buildIndex({ lessons = [], letters = null, surahs = [], juz = [], juzNames = {} } = {}) {
  const items = [...sectionItems(), ...guideItems()]

  for (const l of lessons) {
    if (!l) continue
    items.push({ id: `lesson-${l.id}`, group: 'lessons', title: l.title, sub: l.section ? '' : '', section: l.section, body: lessonBody(l), to: `/ahkam/${l.section}/${l.id}` })
  }

  if (letters) {
    const sifa = {}
    for (const g of letters.opposite ?? []) for (const it of g.items) sifa[it.id] = it.name
    for (const it of letters.non_opposite ?? []) sifa[it.id] = it.name
    const mk = Object.fromEntries((letters.makharij ?? []).map((m) => [m.id, m]))
    for (const l of letters.letters ?? []) {
      items.push({
        id: `letter-${l.id}`,
        group: 'letters',
        title: `${l.char} ${l.name}`,
        sub: join(l.laqab, mk[l.makhraj]?.name && `المخرج: ${mk[l.makhraj].name}`),
        body: join(l.mistakes, l.pronounce, [...l.sifat, ...l.extra].map((s) => sifa[s])),
        to: `/makharij/letters/${l.id}`,
      })
    }
    for (const m of letters.makharij ?? []) {
      items.push({ id: `mk-${m.id}`, group: 'makharij', title: m.name, sub: `حروفه: ${m.letters}`, body: m.desc, to: '/makharij/specific' })
    }
    for (const g of letters.general ?? []) {
      items.push({ id: `mkg-${g.id}`, group: 'makharij', title: `مخرج ${g.name}`, sub: 'المخارج العامة', body: g.desc, to: '/makharij/general' })
    }
    for (const a of letters.alqab ?? []) {
      items.push({ id: `laqab-${a.name}`, group: 'makharij', title: `لقب: ${a.name}`, sub: `حروفه: ${[...a.letters].join(' ')}`, body: a.why, to: '/makharij/titles' })
    }
    for (const g of letters.opposite ?? []) {
      for (const it of g.items) {
        items.push({ id: `sf-${it.id}`, group: 'sifat', title: it.name, sub: it.letters ? `حروفه: ${[...it.letters].join(' ')}` : 'باقي الحروف', body: join(it.code, it.lugha, it.istilah), to: '/sifat/opposite' })
      }
    }
    for (const it of letters.non_opposite ?? []) {
      items.push({ id: `sf-${it.id}`, group: 'sifat', title: it.name, sub: it.letters ? `حروفه: ${[...it.letters].join(' ')}` : '', body: join(it.lugha, it.istilah), to: '/sifat/non-opposite' })
    }
  }

  for (const s of surahs) {
    items.push({ id: `surah-${s.number}`, group: 'surahs', title: `سورة ${s.name}`, sub: `${s.revelation} · ${s.ayah_count} آية · الجزء ${s.juz}`, body: join(s.name_en, String(s.number)), to: `/mushaf/surah/${s.number}`, key: `${s.number}` })
  }
  for (const j of juz) {
    items.push({ id: `juz-${j.juz}`, group: 'surahs', title: `الجزء ${j.juz}`, sub: `يبدأ من سورة ${j.surah_name} ${j.ayah}`, body: join(juzNames[j.juz], String(j.juz)), aliases: juzNames[j.juz] ? [juzNames[j.juz]] : [], to: `/mushaf/juz/${j.juz}`, key: `${j.juz}` })
  }
  return items
}

const bare = (w) => w.replace(/^ال/, '')

/** هل كل كلمات الاستعلام كلمات كاملة في العنوان (مع إهمال «ال» التعريف)؟ */
function wholeWords(title, nq) {
  const have = new Set(norm(title).split(' ').filter(Boolean).flatMap((w) => [w, bare(w)]))
  return nq.split(' ').filter(Boolean).every((w) => have.has(w) || have.has(bare(w)))
}

/** مقتطف من النص حول أول كلمة مطابقة (بطول ثابت تقريباً). */
export function snippetAround(body, query, radius = 55) {
  const text = String(body ?? '')
  if (!text) return ''
  const words = norm(query).split(' ').filter(Boolean)
  // أقرب كلمة مطابقة: نبحث في النص المطبَّع حرفاً بحرف ونرجع إلى موضعه الأصلي
  const map = []
  let plain = ''
  for (let i = 0; i < text.length; i++) {
    const c = text[i] === ' ' ? ' ' : norm(text[i])
    if (c.length === 1) {
      plain += c
      map.push(i)
    }
  }
  let at = -1
  for (const w of words) {
    const k = plain.indexOf(w)
    if (k >= 0 && (at < 0 || k < at)) at = k
  }
  if (at < 0) return text.length > radius * 2 ? `${text.slice(0, radius * 2).replace(/\s+\S*$/, '')} …` : text
  const pos = map[at]
  let a = Math.max(0, pos - radius)
  let b = Math.min(text.length, pos + radius)
  if (a > 0) a = text.indexOf(' ', a) + 1 || a
  if (b < text.length) b = text.lastIndexOf(' ', b) > pos ? text.lastIndexOf(' ', b) : b
  return `${a > 0 ? '… ' : ''}${text.slice(a, b)}${b < text.length ? ' …' : ''}`
}

/**
 * يبحث في الفهرس: كل كلمات الاستعلام يجب أن توجد. العنوان أقوى من المحتوى، وبداية العنوان أقوى من وسطه.
 * يرجع [{...item, score, snippet}] مرتبة: الأقوى أولاً ثم ترتيب المجموعة.
 */
export function searchIndex(items, query, { perGroup = 6 } = {}) {
  const q = String(query ?? '').trim()
  if (!q) return []
  const match = makeMatcher(q)
  const nq = norm(q)
  const out = []
  for (const it of items) {
    const head = join(it.title, it.sub)
    let score = 0
    if (it.key && it.key === nq) score = 6 // رقم سورة أو جزء مطابق
    else if (it.aliases?.some((a) => norm(a) === nq)) score = 5.5 // لقب الجزء (عم، تبارك…)
    else if (norm(it.title) === nq) score = 5
    else if (norm(it.title).startsWith(nq)) score = 4
    else if (wholeWords(it.title, nq)) score = 3.5
    else if (match(head)) score = 3
    else if (it.body && match(head, it.body)) score = 1
    if (!score) continue
    out.push({ ...it, score, snippet: score <= 1 ? snippetAround(it.body, q) : '' })
  }
  out.sort((a, b) => ORDER[a.group] - ORDER[b.group] || b.score - a.score)
  // حدّ لكل مجموعة، مع إبقاء الأقوى
  const counts = {}
  const limited = out.filter((r) => (counts[r.group] = (counts[r.group] ?? 0) + 1) <= perGroup)
  // المجموعة الأقوى نتيجةً تُعرض أولاً (لا الترتيب الثابت فقط)
  const best = {}
  for (const r of limited) best[r.group] = Math.max(best[r.group] ?? 0, r.score)
  limited.sort((a, b) => best[b.group] - best[a.group] || ORDER[a.group] - ORDER[b.group] || b.score - a.score)
  return limited
}

/** نتيجة «صفحة N» إن كُتب رقم صفحة. */
export function pageResult(query) {
  const n = parsePageQuery(query)
  return n ? { id: `page-${n}`, group: 'pages', title: `الصفحة ${n}`, sub: `من ${PAGE_COUNT} صفحة في مصحف المدينة`, body: '', to: `/mushaf/page/${n}`, score: 9, snippet: '' } : null
}
