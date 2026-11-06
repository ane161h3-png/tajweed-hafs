import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AppRoutes } from '../../frontend/src/App'
import { SettingsProvider } from '../../frontend/src/features/settings/SettingsContext'
import { PlayerProvider } from '../../frontend/src/features/player/PlayerContext'
import { COLLECTIONS, findCollection, searchChapters, shapeCollection, toggleBookmark, isBookmarked } from '../../frontend/src/features/library/collections'

const DATA = join(import.meta.dirname, '../../frontend/src/features/library/data')
const book = (name) => JSON.parse(readFileSync(join(DATA, `${name}.json`), 'utf-8'))

function renderAt(path) {
  return render(
    <SettingsProvider>
      <PlayerProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </PlayerProvider>
    </SettingsProvider>,
  )
}

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('نصوص الأدعية والمكتبة', () => {
  it('الصحيفة السجادية: المقدمة والأدعية الأربعة والخمسون بالترتيب', () => {
    const chapters = book('sahifa').groups[0].chapters
    expect(chapters.map((c) => c.id)).toEqual(Array.from({ length: 55 }, (_, i) => i))
    expect(chapters[1].paras.join(' ')).toContain('الحمد لله الأول بلا أول كان قبله')
    expect(chapters[20].title).toBe('دعاؤه في مكارم الأخلاق')
  })

  it('نهج البلاغة: الخطب والكتب والحكم كاملة، دون بقايا أرقام الطبعة', () => {
    const groups = Object.fromEntries(book('nahj').groups.map((g) => [g.id, g.chapters]))
    expect(groups.khutab.length).toBeGreaterThanOrEqual(239)
    expect(groups.kutub).toHaveLength(79)
    expect(groups.hikam.length).toBeGreaterThanOrEqual(470)
    expect(groups.khutab[0].paras[0]).toMatch(/^الحمد لله الذي لا يبلغ مدحته القائلون/)
    const text = JSON.stringify(book('nahj').groups.map((g) => g.chapters.map((c) => c.paras)))
    expect(text).not.toMatch(/[0-9]|PageV|ms\d/)
  })

  it('الأدعية المشهورة: كل دعاء يبدأ بمطلعه المعروف، والمناجيات خمس عشرة', () => {
    const [mashhura, munajat] = book('adiya').groups
    const start = Object.fromEntries(mashhura.chapters.map((c) => [c.slug, c.paras[0]]))
    expect(start.kumayl).toMatch(/^اللهم اني أسألك برحمتك التي وسعت كل شيء/)
    expect(start.sabah).toMatch(/^اللهم يا من دلع لسان الصباح/)
    expect(start.iftitah).toMatch(/^اللهم اني افتتح الثناء بحمدك/)
    expect(start['abu-hamza']).toMatch(/^الهي لا تؤدبني بعقوبتك/)
    expect(mashhura.chapters.find((c) => c.slug === 'jawshan-kabir').paras).toHaveLength(100)
    expect(munajat.chapters).toHaveLength(15)
  })

  it('لكل كتاب مصدر وترخيص مذكوران', () => {
    for (const name of ['sahifa', 'nahj', 'adiya']) {
      const s = book(name).source
      expect(s.url).toMatch(/^https:\/\/github\.com\/OpenITI\/RELEASE\/blob\/[0-9a-f]{40}\//)
      expect(s.license).toBe('CC BY-NC-SA 4.0')
    }
  })
})

describe('المجموعات والبحث والعلامات', () => {
  it('مفتاح الفصل يحمل الباب حين تتعدد الأبواب', () => {
    const nahj = shapeCollection(findCollection('nahj'), book('nahj'))
    expect(nahj.chapters.find((c) => c.group === 'kutub').key).toBe('kutub-1')
    const munajat = shapeCollection(findCollection('munajat'), book('adiya'))
    expect(munajat.chapters[0].key).toBe('1')
    expect(munajat.groups).toHaveLength(1)
  })

  it('البحث يجد الكلمة في النص بلا تشكيل ولا همزات', () => {
    const sahifa = shapeCollection(findCollection('sahifa'), book('sahifa'))
    const hits = searchChapters(sahifa.chapters, 'مكارم الاخلاق')
    expect(hits[0].ch.id).toBe(20)
  })

  it('العلامة تُحفظ وتُزال', () => {
    const e = { path: '/adiya/sahifa/1', title: 'التحميد', collection: 'الصحيفة', section: 'adiya' }
    expect(toggleBookmark(e)).toBe(true)
    expect(isBookmarked(e.path)).toBe(true)
    expect(toggleBookmark(e)).toBe(false)
    expect(isBookmarked(e.path)).toBe(false)
  })

  it('كل مجموعة مسجلة في قسمها', () => {
    for (const c of COLLECTIONS) expect(['adiya', 'library']).toContain(c.section)
  })
})

describe('الصفحات', () => {
  it('قسم الأدعية يعرض مجموعاته', async () => {
    renderAt('/adiya')
    expect(await screen.findByRole('heading', { level: 1, name: 'الأدعية' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /الصحيفة السجادية/ }).map((a) => a.getAttribute('href'))).toContain('/adiya/sahifa')
  })

  it('قارئ الدعاء: النص والمصدر وتكبير الخط والعلامة', async () => {
    const user = userEvent.setup()
    renderAt('/adiya/sahifa/20')
    expect(await screen.findByRole('heading', { level: 1, name: 'دعاؤه في مكارم الأخلاق' }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getAllByText('المصدر').length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'تكبير الخط' }))
    expect(localStorage.getItem('tajweed.library.font')).toBe('3')
    await user.click(screen.getByRole('button', { name: /علامة/ }))
    expect(isBookmarked('/adiya/sahifa/20')).toBe(true)
  })

  it('المسائل الشرعية: الأبواب واسم المرجع', async () => {
    renderAt('/masail/salat')
    expect(await screen.findByRole('heading', { level: 1, name: 'الصلاة' })).toBeInTheDocument()
    expect(screen.getAllByText(/السيستاني/).length).toBeGreaterThan(0)
  })
})
