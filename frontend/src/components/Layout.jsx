import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { BOTTOM_NAV, HOME, SECTIONS, findSection, sectionPath, subsectionPath } from '../data/sections'
import { useSettings } from '../features/settings/SettingsContext'
import { rememberVisit } from '../features/progress/progress'
import Breadcrumb, { CrumbProvider, useCrumbs } from './Breadcrumb'
import Icon from './Icon'
import PlayerBar from '../features/player/PlayerBar'
import { usePlayer } from '../features/player/PlayerContext'

function ThemeToggle() {
  const { dark, toggleTheme } = useSettings()
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
      aria-label={dark ? 'الوضع النهاري' : 'الوضع الليلي'}
      title={dark ? 'الوضع النهاري' : 'الوضع الليلي'}
    >
      <Icon name={dark ? 'sun' : 'moon'} />
    </button>
  )
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-lg">
      <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="size-9" />
      <span className="leading-tight">
        <span className="block font-semibold text-ink">تعلّم التجويد</span>
        <span className="block text-xs text-muted">رواية حفص عن عاصم</span>
      </span>
    </Link>
  )
}

const navItem = ({ isActive }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] transition-colors ${
    isActive ? 'bg-accent-soft font-semibold text-accent' : 'text-ink/80 hover:bg-surface-2 hover:text-ink'
  }`

function Sidebar() {
  const { pathname } = useLocation()
  const activeId = pathname.split('/')[1]
  return (
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col border-e border-line bg-surface lg:flex">
      <div className="flex items-center justify-between px-5 pb-4 pt-5">
        <Brand />
        <ThemeToggle />
      </div>
      <nav aria-label="الأقسام الرئيسية" className="flex-1 overflow-y-auto px-3 pb-6">
        <ul className="space-y-0.5">
          <li>
            <NavLink to="/" end className={navItem}>
              <Icon name={HOME.icon} /> {HOME.title}
            </NavLink>
          </li>
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <NavLink to={sectionPath(s)} className={navItem}>
                <Icon name={s.icon} /> {s.title}
              </NavLink>
              {/* القسم المفتوح يعرض أقسامه الفرعية: الوصول للقسم الفرعي بضغطة واحدة */}
              {activeId === s.id && (
                <ul className="my-1 me-2 ms-6 space-y-0.5 border-s border-line ps-3">
                  {s.subsections.map((sub) => (
                    <li key={sub.id}>
                      <NavLink
                        to={subsectionPath(s, sub)}
                        className={({ isActive }) =>
                          `block rounded-lg px-2.5 py-1.5 text-sm ${
                            isActive ? 'font-semibold text-accent' : 'text-muted hover:text-ink'
                          }`
                        }
                      >
                        {sub.title}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}

function MoreSheet({ open, onClose }) {
  const rest = SECTIONS.filter((s) => !BOTTOM_NAV.includes(s.id))
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="بقية الأقسام"
            className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-3xl border-t border-line bg-surface px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 lg:hidden"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">بقية الأقسام</h2>
              <div className="flex items-center">
                <ThemeToggle />
                <button
                  type="button"
                  onClick={onClose}
                  className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2"
                  aria-label="إغلاق"
                >
                  <Icon name="close" />
                </button>
              </div>
            </div>
            <ul className="space-y-4">
              {rest.map((s) => (
                <li key={s.id}>
                  <Link to={sectionPath(s)} onClick={onClose} className="flex items-center gap-2 py-1 font-semibold">
                    <Icon name={s.icon} className="text-accent" /> {s.title}
                  </Link>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {s.subsections.map((sub) => (
                      <Link
                        key={sub.id}
                        to={subsectionPath(s, sub)}
                        onClick={onClose}
                        className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink/85 hover:border-accent hover:text-accent"
                      >
                        {sub.title}
                      </Link>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const { pathname } = useLocation()
  const activeId = pathname.split('/')[1] || 'home'
  const inMore = !BOTTOM_NAV.includes(activeId)
  useEffect(() => setMoreOpen(false), [pathname])

  const cell = (active) =>
    `flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2 text-[0.7rem] ${active ? 'text-accent font-semibold' : 'text-muted'}`

  return (
    <>
      <nav
        aria-label="التنقل السفلي"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto flex max-w-xl">
          {BOTTOM_NAV.map((id) => {
            if (id === 'more')
              return (
                <li key={id} className="flex flex-1">
                  <button
                    type="button"
                    className={cell(inMore || moreOpen)}
                    onClick={() => setMoreOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={moreOpen}
                  >
                    <Icon name="more" />
                    المزيد
                  </button>
                </li>
              )
            const s = id === 'home' ? HOME : findSection(id)
            return (
              <li key={id} className="flex flex-1">
                <Link
                  to={id === 'home' ? '/' : sectionPath(s)}
                  className={cell(activeId === id)}
                  aria-current={activeId === id ? 'page' : undefined}
                >
                  <Icon name={s.icon} />
                  {s.short ?? s.title}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  )
}

function VisitTracker() {
  const { pathname } = useLocation()
  const crumbs = useCrumbs()
  const key = crumbs.map((c) => c.title).join('|')
  useEffect(() => {
    rememberVisit(pathname, crumbs)
    window.scrollTo?.(0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, key])
  return null
}

export default function Layout() {
  const { active } = usePlayer()
  return (
    <CrumbProvider>
      <VisitTracker />
      <a
        href="#main"
        className="fixed start-3 top-3 z-50 -translate-y-20 rounded-lg bg-accent px-4 py-2 text-accent-ink focus:translate-y-0"
      >
        تخطَّ إلى المحتوى
      </a>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
            <Brand />
            <ThemeToggle />
          </header>
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
            <Breadcrumb />
            <Outlet />
            {/* مساحة لمشغّل التلاوة حتى لا يغطي آخر الصفحة */}
            {active && <div className="h-20" aria-hidden="true" />}
          </main>
        </div>
      </div>
      <PlayerBar />
      <BottomNav />
    </CrumbProvider>
  )
}
