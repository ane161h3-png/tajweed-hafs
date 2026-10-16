// التخزين المحلي قد يكون محجوباً (تصفح خاص)؛ نتعامل معه بأمان دائماً.
export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* التخزين غير متاح */
  }
}
