import { MotionConfig } from 'motion/react'
import { useEffect, useRef } from 'react'
import type { ComponentType, MouseEvent, RefObject } from 'react'
import { Nav } from './components/Nav'
import { PageTransition } from './components/PageTransition'
import { Home } from './pages/Home'
import { Method } from './pages/Method'
import { OutageDay } from './pages/OutageDay'
import { Plan } from './pages/Plan'
import { Profile } from './pages/Profile'
import { scrollToAnchor, useHashRoute } from './state/useHashRoute'
import type { Route } from './state/useHashRoute'

const PAGES: Record<Route, ComponentType> = {
  home: Home,
  profile: Profile,
  outage: OutageDay,
  plan: Plan,
  method: Method,
}

const PAGE_TITLES: Record<Route, string> = {
  home: 'Lifeline — Hospital Power Continuity',
  profile: 'Hospital profile — Lifeline',
  outage: 'Outage day — Lifeline',
  plan: 'Plan & finance — Lifeline',
  method: 'Method — Lifeline',
}

// Mounts together with its page, so the anchor element exists when we scroll.
// The route change is animated: the page mounts only after the old one has left,
// so scrolling from the hook itself would run too early.
//
// A page that replaces another starts at the top: a route hash such as #/plan
// matches no element id, so the browser would otherwise keep the old scroll
// position. An anchor wins over that reset. Nothing is reset on first load, so the
// browser can still restore the scroll position after a reload.
function RoutedPage({
  route,
  anchor,
  hasNavigated,
}: {
  route: Route
  anchor: string | null
  hasNavigated: RefObject<boolean>
}) {
  useEffect(() => {
    if (anchor !== null) scrollToAnchor(anchor)
    else if (hasNavigated.current) window.scrollTo(0, 0)
  }, [anchor, hasNavigated])
  const Page = PAGES[route]
  return <Page />
}

function App() {
  const { route, anchor } = useHashRoute()
  const mainRef = useRef<HTMLElement>(null)
  const previousRoute = useRef(route)
  // Set on the first route change. The next page mounts only after the old one has
  // faded out, which is after this flag is set.
  const hasNavigated = useRef(false)

  useEffect(() => {
    document.title = PAGE_TITLES[route]
  }, [route])

  // Move focus to <main> on a route change, not on first load. Comparing with the
  // previous route (rather than a "first run" flag) keeps StrictMode's repeated
  // effect run from stealing focus at startup.
  useEffect(() => {
    if (previousRoute.current === route) return
    previousRoute.current = route
    hasNavigated.current = true
    mainRef.current?.focus()
  }, [route])

  // The skip link must not touch the hash, because the hash is the route.
  const skipToContent = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    mainRef.current?.focus()
  }

  return (
    <MotionConfig reducedMotion="user">
      <a className="skip-link" href="#main" onClick={skipToContent}>
        Skip to content
      </a>
      <Nav />
      <main id="main" ref={mainRef} tabIndex={-1}>
        <PageTransition routeKey={route}>
          <RoutedPage route={route} anchor={anchor} hasNavigated={hasNavigated} />
        </PageTransition>
      </main>
    </MotionConfig>
  )
}

export default App
