import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import TopBar from './TopBar.jsx'
import FindDialog from './FindDialog.jsx'

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [findOpen, setFindOpen] = useState(false)
  const { pathname } = useLocation()
  const mainRef = useRef(null)
  const firstRender = useRef(true)

  // Ctrl K / Cmd K opens Find from anywhere in the app.
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setFindOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // A new page starts at the top, and screen readers land on its content
  // rather than wherever the old page's focus was.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    document.scrollingElement?.scrollTo?.({ top: 0 })
    mainRef.current?.focus({ preventScroll: true })
  }, [pathname])

  return (
    <div className="flex min-h-screen">
      <a href="#main"
         className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-ink-900 focus:shadow-overlay">
        Skip to content
      </a>

      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setMenuOpen(true)} onFind={() => setFindOpen(true)} />

        <main id="main" ref={mainRef} tabIndex={-1}
              className="mx-auto w-full min-w-0 max-w-[1440px] flex-1 px-4 py-6 outline-none sm:px-6 print:p-0 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>

      <FindDialog open={findOpen} onClose={() => setFindOpen(false)} />
    </div>
  )
}
