import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../../frontend/src/App'
import { SettingsProvider } from '../../frontend/src/features/settings/SettingsContext'
import { PlayerProvider } from '../../frontend/src/features/player/PlayerContext'

const LESSON = {
  id: 'noon-sakinah-2',
  section: 'noon-sakinah',
  order: 2,
  title: 'الإظهار الحلقي',
  status: 'draft',
  lugha: 'البيان والإيضاح.',
  istilah: 'إخراج كل حرف من مخرجه من غير غنة.',
  letters: '',
  method: '',
  examples: [
    { surah: 112, ayah: 4, word: 'يَكُن', note: 'مثال', ayah_text: 'وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ', surah_name: 'الإخلاص', match: [7, 12] },
  ],
  exceptions: '',
  notes: '',
  verses: [{ source: 'تحفة الأطفال', first: 'فَالأَوَّلُ الإِظْهَارُ قَبْلَ أَحْرُفِ', second: 'لِلْحَلْقِ سِتٌّ رُتِّبَتْ فَلْتَعْرِفِ' }],
  table: null,
  rules: [],
}

function mockServer() {
  const calls = []
  const fetchMock = vi.fn(async (url, opts = {}) => {
    calls.push({ url, method: opts.method ?? 'GET', body: opts.body && JSON.parse(opts.body) })
    const path = url.replace(/^.*\/api/, '')
    if (opts.method === 'PUT') return new Response(JSON.stringify({ ...LESSON, ...JSON.parse(opts.body) }))
    if (path.startsWith('/lessons/')) return new Response(JSON.stringify(LESSON))
    if (path === '/lessons') return new Response(JSON.stringify({ lessons: [{ ...LESSON, examples: 1 }] }))
    if (path.startsWith('/ayah/'))
      return new Response(JSON.stringify({ surah: 112, ayah: 4, text: 'وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ', words: [{ start: 0, end: 6, text: 'وَلَمْ' }, { start: 7, end: 12, text: 'يَكُن' }] }))
    if (path === '/reciters') return new Response(JSON.stringify([{ id: 'husary-murattal', ayah_url: 'https://x/{sss}{aaa}.mp3' }]))
    return new Response('[]')
  })
  vi.stubGlobal('fetch', fetchMock)
  return calls
}

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

afterEach(() => vi.unstubAllGlobals())

describe('ورقة الدرس', () => {
  it('تعرض التعريف لغةً واصطلاحاً والمثال مظلّلاً والأبيات', async () => {
    mockServer()
    renderAt('/ahkam/noon-sakinah/noon-sakinah-2')
    expect(await screen.findByRole('heading', { level: 1, name: 'الإظهار الحلقي' })).toBeInTheDocument()
    expect(screen.getByText('لغةً:')).toBeInTheDocument()
    expect(screen.getByText('البيان والإيضاح.')).toBeInTheDocument()
    expect(screen.getByText('اصطلاحاً:')).toBeInTheDocument()
    const mark = document.querySelector('mark')
    expect(mark).toHaveTextContent('يَكُن')
    expect(screen.getByRole('link', { name: /الإخلاص ٤/ })).toHaveAttribute('href', '/mushaf/surah/112#ayah-112-4')
    expect(screen.getByText('فَالأَوَّلُ الإِظْهَارُ قَبْلَ أَحْرُفِ')).toBeInTheDocument()
    expect(screen.getByText(/مسودة/)).toBeInTheDocument()
    // مسار التنقل: الرئيسية ← الأحكام ← الباب ← الدرس
    const crumbs = screen.getByRole('navigation', { name: 'مسار التنقل' })
    expect(await within(crumbs).findByText('الإظهار الحلقي')).toHaveAttribute('aria-current', 'page')
  })

  it('التعديل ثم الحفظ يرسل المحتوى الجديد إلى الخادم', async () => {
    const user = userEvent.setup()
    const calls = mockServer()
    renderAt('/ahkam/noon-sakinah/noon-sakinah-2')
    await user.click(await screen.findByRole('button', { name: /تعديل/ }))

    const lugha = screen.getByPlaceholderText('معنى الكلمة في اللغة')
    await user.clear(lugha)
    await user.type(lugha, 'الإيضاح')
    expect(screen.getByText(/تعديلات لم تُحفظ/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'حفظ' }))

    const put = calls.find((c) => c.method === 'PUT')
    expect(put.url).toMatch(/\/api\/lessons\/noon-sakinah-2$/)
    expect(put.body.lugha).toBe('الإيضاح')
    expect(put.body.examples).toEqual([{ surah: 112, ayah: 4, word: 'يَكُن', note: 'مثال' }]) // بلا حقول العرض
    expect(await screen.findByRole('status')).toHaveTextContent('حُفظ الدرس')
    expect(screen.getByText('الإيضاح')).toBeInTheDocument()
  })

  it('تمرين آخر الدرس: «أين الشاهد؟» يُصحَّح من موضع الكلمة', async () => {
    const user = userEvent.setup()
    mockServer()
    renderAt('/ahkam/noon-sakinah/noon-sakinah-2')
    const exercise = await screen.findByRole('region', { name: 'تمرين' })
    await user.click(within(exercise).getByRole('button', { name: 'يَكُن' }))
    expect(within(exercise).getByRole('status')).toHaveTextContent('صحيح')
    expect(within(exercise).getByText(/النتيجة/)).toHaveTextContent('١ من ١')
  })

  it('فهرس الباب يعرض الدروس وزر درس جديد', async () => {
    mockServer()
    renderAt('/ahkam/noon-sakinah')
    expect(await screen.findByRole('link', { name: /الإظهار الحلقي/ })).toHaveAttribute('href', '/ahkam/noon-sakinah/noon-sakinah-2')
    expect(screen.getByRole('button', { name: /درس جديد/ })).toBeInTheDocument()
  })
})
