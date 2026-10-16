import { useSyncExternalStore } from 'react'
import { readJSON, writeJSON } from '../../lib/storage'

const LAST_KEY = 'tajweed.lastRead'
const MARKS_KEY = 'tajweed.bookmarks'
const EVENT = 'tajweed:reading'

function emit() {
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(cb) {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb) // تبويب آخر
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

// ---------- آخر موضع قراءة ----------

export function getLastRead() {
  return readJSON(LAST_KEY, null)
}

export function setLastRead(pos) {
  const prev = getLastRead()
  if (prev && prev.surah === pos.surah && prev.ayah === pos.ayah) return
  writeJSON(LAST_KEY, { ...pos, at: Date.now() })
  emit()
}

// ---------- العلامات المرجعية ----------

let snapshot = null
let raw = null

function bookmarksSnapshot() {
  const now = JSON.stringify(readJSON(MARKS_KEY, []))
  if (now !== raw) {
    raw = now
    snapshot = JSON.parse(now)
  }
  return snapshot
}

export function getBookmarks() {
  return bookmarksSnapshot()
}

export const bookmarkKey = (surah, ayah) => `${surah}:${ayah}`

export function toggleBookmark({ surah, ayah, surahName }) {
  const list = getBookmarks()
  const exists = list.some((b) => b.surah === surah && b.ayah === ayah)
  const next = exists
    ? list.filter((b) => !(b.surah === surah && b.ayah === ayah))
    : [...list, { surah, ayah, surahName, at: Date.now() }]
  writeJSON(MARKS_KEY, next)
  emit()
  return !exists
}

export function removeBookmark(surah, ayah) {
  writeJSON(MARKS_KEY, getBookmarks().filter((b) => !(b.surah === surah && b.ayah === ayah)))
  emit()
}

/** العلامات المرجعية مع إعادة الرسم عند تغيّرها. */
export function useBookmarks() {
  return useSyncExternalStore(subscribe, bookmarksSnapshot, () => [])
}

export function useLastRead() {
  return useSyncExternalStore(subscribe, () => localStorageRaw(LAST_KEY), () => null)
}

function localStorageRaw(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
