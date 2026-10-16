import { useMemo } from 'react'
import { useApi } from '../../lib/api'

/** محتوى المخارج والصفات مع فهارس للبحث السريع. */
export function useLetters() {
  const { data, loading, error } = useApi('/letters')
  const index = useMemo(() => {
    if (!data?.letters) return null
    const sifat = {}
    for (const g of data.opposite) for (const s of g.items) sifat[s.id] = { ...s, group: g.id, groupName: g.name }
    for (const s of data.non_opposite) sifat[s.id] = { ...s, group: null }
    // حروف الصفات المقابلة (التي لا حروف محددة لها) تُستخرج من الحروف
    for (const s of Object.values(sifat)) {
      if (!s.letters) s.letters = data.letters.filter((l) => l.sifat.includes(s.id) && l.id !== 'alif').map((l) => l.char).join('')
    }
    return {
      ...data,
      sifat,
      letterById: Object.fromEntries(data.letters.map((l) => [l.id, l])),
      letterByChar: Object.fromEntries(data.letters.map((l) => [l.char, l])),
      makhrajById: Object.fromEntries(data.makharij.map((m) => [m.id, m])),
      generalById: Object.fromEntries(data.general.map((g) => [g.id, g])),
    }
  }, [data])
  return { data: index, loading, error }
}

/** كل صفات الحرف (المتضادة ثم غير المتضادة) بأسمائها. */
export function letterSifat(letter, sifat) {
  return [...letter.sifat, ...letter.extra].map((id) => sifat[id]).filter(Boolean)
}

export const LEVEL_COLORS = {
  أقوى: 'bg-[#1f6f5c] text-white',
  قوي: 'bg-[#3a9a7f] text-white',
  متوسط: 'bg-[#d8b45a] text-[#2b2410]',
  ضعيف: 'bg-[#e79a6b] text-[#2b1a10]',
  أضعف: 'bg-[#c2554f] text-white',
}
