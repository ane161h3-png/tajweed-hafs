import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { GROUP_ORDER } from './tajweed'

// الأحكام لا تتغير أثناء الجلسة؛ تُجلب مرة واحدة وتُشارك بين المكونات.
let cache = null
let pending = null

function loadRules() {
  if (cache) return Promise.resolve(cache)
  pending ??= api('/rules').then(
    (data) => (cache = data),
    (e) => {
      pending = null
      throw e
    },
  )
  return pending
}

export function useRules() {
  const [rules, setRules] = useState(cache)
  const [error, setError] = useState(null)
  useEffect(() => {
    if (cache) return
    let alive = true
    loadRules().then(
      (r) => alive && setRules(r),
      (e) => alive && setError(e),
    )
    return () => {
      alive = false
    }
  }, [])
  const byId = useMemo(() => Object.fromEntries((rules ?? []).map((r) => [r.id, r])), [rules])
  const groups = useMemo(() => {
    const map = new Map(GROUP_ORDER.map((g) => [g, []]))
    for (const r of rules ?? []) {
      if (!map.has(r.group)) map.set(r.group, [])
      map.get(r.group).push(r)
    }
    return [...map.entries()].filter(([, list]) => list.length).map(([id, list]) => ({ id, name: list[0].group_name, rules: list }))
  }, [rules])
  return { rules, byId, groups, error }
}

/** للاختبارات فقط */
export function resetRulesCache() {
  cache = null
  pending = null
}
