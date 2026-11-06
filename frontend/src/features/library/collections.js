// قسما «الأدعية» و«المكتبة»: سجل المجموعات، وتحميل نصوصها عند الطلب، والعلامات وآخر قراءة.
// النصوص في ./data (يبنيها scripts/build_library.py من مصادر مفتوحة) وتُحمَّل ملفاً ملفاً عند فتحها،
// فتُحفظ مع البرنامج وتعمل دون إنترنت دون أن تثقل الصفحة الأولى.
import { readJSON, writeJSON } from '../../lib/storage'
import { makeMatcher } from '../../lib/filter'

const LOADERS = {
  sahifa: () => import('./data/sahifa.json'),
  adiya: () => import('./data/adiya.json'),
  nahj: () => import('./data/nahj.json'),
}

/**
 * كل مجموعة تُعرض بفهرس وقارئ. file: ملف النص، groups: الأبواب المعروضة منه (null = كلها).
 * section: القسم الذي تظهر فيه (الأدعية أو المكتبة).
 */
export const COLLECTIONS = [
  {
    id: 'sahifa',
    section: 'adiya',
    file: 'sahifa',
    groups: null,
    title: 'الصحيفة السجادية',
    desc: 'أدعية الإمام زين العابدين (عليه السلام) الأربعة والخمسون',
  },
  {
    id: 'mashhura',
    section: 'adiya',
    file: 'adiya',
    groups: ['mashhura'],
    title: 'الأدعية المشهورة',
    desc: 'كميل، الصباح، السمات، التوسل، الافتتاح، أبو حمزة الثمالي، الجوشن…',
  },
  {
    id: 'munajat',
    section: 'adiya',
    file: 'adiya',
    groups: ['munajat'],
    title: 'المناجيات الخمس عشرة',
    desc: 'مناجيات الإمام زين العابدين (عليه السلام): التائبين، الشاكين، المحبين…',
  },
  {
    id: 'nahj',
    section: 'library',
    file: 'nahj',
    groups: null,
    title: 'نهج البلاغة',
    desc: 'خطب أمير المؤمنين علي (عليه السلام) وكتبه وحكمه، جمع الشريف الرضي',
  },
]

export const findCollection = (id) => COLLECTIONS.find((c) => c.id === id)

const cache = new Map()

/** يحمّل نص المجموعة: { book, groups: [{id, title, chapters}] } مع مفتاح لكل فصل. */
export function loadCollection(col) {
  if (!cache.has(col.id)) {
    const p = LOADERS[col.file]().then((m) => shapeCollection(col, m.default ?? m))
    p.catch(() => cache.delete(col.id))
    cache.set(col.id, p)
  }
  return cache.get(col.id)
}

/** يختار أبواب المجموعة من الكتاب ويعطي كل فصل مفتاحاً للرابط: «12» أو «khutab-12» حين تتعدد الأبواب. */
export function shapeCollection(col, book) {
  const groups = book.groups.filter((g) => !col.groups || col.groups.includes(g.id))
  const multi = groups.length > 1
  const shaped = groups.map((g) => ({
    ...g,
    chapters: g.chapters.map((c) => ({ ...c, key: multi ? `${g.id}-${c.id}` : String(c.id), group: g.id })),
  }))
  return { book, groups: shaped, chapters: shaped.flatMap((g) => g.chapters) }
}

export const chapterPath = (col, ch) => `/${col.section}/${col.id}/${ch.key}`

/** يبحث في عناوين الفصول ونصوصها؛ يرجع الفصول المطابقة مع مقتطف حول أول موضع. */
export function searchChapters(chapters, query, limit = 40) {
  if (!query.trim()) return []
  const match = makeMatcher(query)
  // ما طابق عنوانه أولاً، ثم ما وُجدت الكلمة في نصه
  const byTitle = chapters.filter((ch) => match(ch.title)).map((ch) => ({ ch, snippet: ch.desc ?? ch.paras[0]?.slice(0, 120) ?? '' }))
  const out = byTitle.slice(0, limit)
  const seen = new Set(out.map((r) => r.ch.key ?? r.ch.id))
  for (const ch of chapters) {
    if (out.length >= limit) break
    if (seen.has(ch.key ?? ch.id)) continue
    const para = ch.paras.find((p) => match(p))
    if (para) out.push({ ch, snippet: snippetAround(para, query) })
  }
  return out
}

function snippetAround(text, query) {
  const word = query.trim().split(/\s+/)[0]
  const at = text.indexOf(word)
  if (at < 0) return text.slice(0, 120)
  const start = Math.max(0, at - 50)
  return (start ? '…' : '') + text.slice(start, at + 90) + (at + 90 < text.length ? '…' : '')
}

// ---------- العلامات وآخر قراءة وحجم الخط (على الجهاز) ----------

const BOOKMARKS = 'tajweed.library.bookmarks'
const LAST = 'tajweed.library.last'
const FONT = 'tajweed.library.font'

export const FONT_SIZES = [1.15, 1.35, 1.6, 1.9, 2.25] // rem
export const readFontStep = () => Math.min(FONT_SIZES.length - 1, Math.max(0, readJSON(FONT, 2)))
export const saveFontStep = (n) => writeJSON(FONT, n)

export const bookmarks = () => readJSON(BOOKMARKS, [])
export const isBookmarked = (path) => bookmarks().some((b) => b.path === path)

/** يضيف العلامة أو يزيلها؛ يرجع الحالة الجديدة. */
export function toggleBookmark(entry) {
  const list = bookmarks()
  const has = list.some((b) => b.path === entry.path)
  writeJSON(BOOKMARKS, has ? list.filter((b) => b.path !== entry.path) : [{ ...entry, at: Date.now() }, ...list])
  return !has
}

export const lastRead = (colId) => readJSON(LAST, {})[colId] ?? null
export function saveLastRead(colId, entry) {
  writeJSON(LAST, { ...readJSON(LAST, {}), [colId]: entry })
}
