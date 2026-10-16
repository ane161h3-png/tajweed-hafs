import { useEffect, useState } from 'react'
import { staticApi } from './staticApi'

// VITE_STATIC=1 (نسخة أندرويد): البيانات من ملفات التطبيق نفسه، بلا خادم ولا إنترنت.
export const STATIC = import.meta.env.VITE_STATIC === '1'
// أو خادم على عنوان آخر (VITE_API_BASE)
const BASE = import.meta.env.VITE_API_BASE ?? ''

export async function api(path, { signal } = {}) {
  if (STATIC) {
    const data = await staticApi(path)
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
    return data
  }
  const res = await fetch(`${BASE}/api${path}`, { signal })
  if (!res.ok) {
    let detail = `خطأ ${res.status}`
    try {
      detail = (await res.json()).detail ?? detail
    } catch {
      /* ليس JSON */
    }
    throw new Error(detail)
  }
  return res.json()
}

/** جلب بسيط مع حالة التحميل والخطأ. */
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  useEffect(() => {
    if (!path) return
    const ctrl = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    api(path, { signal: ctrl.signal })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ data: null, error, loading: false })
      })
    return () => ctrl.abort()
  }, [path])
  return state
}

const AR_DIGITS = new Intl.NumberFormat('ar-EG', { useGrouping: false })
export const arabicNumber = (n) => AR_DIGITS.format(n)
