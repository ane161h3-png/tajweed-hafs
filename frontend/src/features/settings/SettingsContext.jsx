import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { readJSON, writeJSON } from '../../lib/storage'
import { STATIC } from '../../lib/api'

const KEY = 'tajweed.settings'
export const DEFAULT_SETTINGS = {
  theme: 'system', // system | light | dark
  quranScale: 1, // مضاعِف حجم خط المصحف
  reciter: null, // يُضبط من reciters.json في المرحلة الثانية
  tajweedColors: true,
  colorBlind: false,
  ruleColors: {}, // تعديلات المستخدم على ألوان الأحكام: { ruleId: '#hex' }
  playbackRate: 1,
  // تعديل الدروس: مفعّل في نسخة الخادم (للمعلّم)، ومخفي افتراضياً عن زوار الموقع والتطبيق
  editMode: !STATIC,
}

const SettingsContext = createContext(null)

function systemDark() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, ...readJSON(KEY, {}) }))

  useEffect(() => writeJSON(KEY, settings), [settings])

  const dark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark())
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.setProperty('--quran-scale', String(settings.quranScale))
  }, [dark, settings.quranScale])

  const update = useCallback((patch) => setSettings((s) => ({ ...s, ...patch })), [])
  const toggleTheme = useCallback(() => update({ theme: dark ? 'light' : 'dark' }), [dark, update])
  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), [])

  const value = useMemo(() => ({ settings, dark, update, toggleTheme, reset }), [settings, dark, update, toggleTheme, reset])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings خارج SettingsProvider')
  return ctx
}
