import { createContext, useContext, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { crumbsFor } from '../data/sections'
import Icon from './Icon'

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

export default function Breadcrumb() {
  const crumbs = useCrumbs()
  if (crumbs.length < 2) return null
  return (
    <nav aria-label="مسار التنقل" className="mb-5 text-sm text-muted">
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
  )
}
