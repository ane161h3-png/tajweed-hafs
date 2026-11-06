import { createContext, useContext, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { crumbsFor } from '../data/sections'
import Icon from './Icon'
import { useScrollRestoration } from '../lib/scrollRestore'

// الصفحات التي لها عنوان خاص (درس، سورة) تضيف حلقة أخيرة عبر usePageCrumb
const CrumbContext = createContext({ extra: null, setExtra: () => {} })

export function CrumbProvider({ children }) {
  const [extra, setExtra] = useState(null)
  return <CrumbContext.Provider value={{ extra, setExtra }}>{children}</CrumbContext.Provider>
}

export function usePageCrumb(title) {
  const { setExtra } = useContext(CrumbContext)
  const { pathname } = useLocation()
  useEffect(() => {
    setExtra(title ? { title, path: pathname } : null)
    return () => setExtra(null)
  }, [title, pathname, setExtra])
}

export function useCrumbs() {
  const { pathname } = useLocation()
  const { extra } = useContext(CrumbContext)
  const crumbs = crumbsFor(pathname)
  if (extra && extra.path === pathname && crumbs.at(-1)?.path !== pathname) crumbs.push(extra)
  return crumbs
}

/**
 * زر الرجوع: يعيدك إلى الصفحة التي جئت منها فعلاً (من تحليل آية إلى درس الحكم ثم رجوعاً إلى الآية)،
 * لا إلى القسم الأعلى. إن فُتحت الصفحة مباشرة (رابط مشارك) ولا شيء قبلها، يصعد إلى الصفحة الأعلى في المسار.
 */
export function BackButton({ crumbs }) {
  const navigate = useNavigate()
  const { key, pathname } = useLocation()
  const up = [...crumbs].reverse().find((c) => c.path !== pathname)?.path ?? '/'
  const back = () => (key !== 'default' ? navigate(-1) : navigate(up))
  return (
    <button
      type="button"
      onClick={back}
      className="flex h-9 shrink-0 items-center gap-1 rounded-full border border-line bg-surface pe-3.5 ps-2 text-sm font-medium text-ink/85 transition hover:border-accent hover:text-accent"
      aria-label="رجوع إلى الصفحة السابقة"
      title="رجوع"
    >
      {/* سهم نحو بداية السطر (اليمين في العربية) = رجوع */}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
      رجوع
    </button>
  )
}

export default function Breadcrumb() {
  useScrollRestoration()
  const crumbs = useCrumbs()
  const { pathname } = useLocation()
  if (pathname === '/') return null
  return (
    <div className="mb-5 flex items-center gap-3">
      <BackButton crumbs={crumbs} />
      {crumbs.length >= 2 && (
        <nav aria-label="مسار التنقل" className="min-w-0 text-sm text-muted">
          <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1
              return (
                <li key={c.path} className="flex items-center gap-1.5">
                  {last ? (
                    <span aria-current="page" className="font-medium text-ink">
                      {c.title}
                    </span>
                  ) : (
                    <>
                      <Link to={c.path} className="rounded px-0.5 hover:text-accent hover:underline underline-offset-4">
                        {c.title}
                      </Link>
                      <Icon name="chevron" size={14} className="opacity-60" />
                    </>
                  )}
                </li>
              )
            })}
          </ol>
        </nav>
      )}
    </div>
  )
}
