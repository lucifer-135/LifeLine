import { useEffect, useMemo, useSyncExternalStore } from 'react'

export type Route = 'home' | 'profile' | 'outage' | 'plan' | 'method'

// Grammar: '#/' + route + optional '?query' + optional '#anchor', for example
// '#/outage?autoplay=1' or '#/method#src-cost.dieselNgnPerLitre'. Home is '#/'.
const HOME_HASH = '#/'

// A Map, not an object: arbitrary hash text such as "constructor" must not match.
const ROUTE_BY_PATH = new Map<string, Route>([
  ['', 'home'],
  ['profile', 'profile'],
  ['outage', 'outage'],
  ['plan', 'plan'],
  ['method', 'method'],
])

interface ParsedHash {
  route: Route
  params: URLSearchParams
  anchor: string | null
  known: boolean
}

function homeResult(known: boolean): ParsedHash {
  return { route: 'home', params: new URLSearchParams(), anchor: null, known }
}

function parseHash(hash: string): ParsedHash {
  if (hash === '' || hash === '#') return homeResult(true)
  if (!hash.startsWith(HOME_HASH)) return homeResult(false)

  const afterPrefix = hash.slice(HOME_HASH.length)
  const anchorAt = afterPrefix.indexOf('#')
  const routeAndQuery = anchorAt === -1 ? afterPrefix : afterPrefix.slice(0, anchorAt)
  const anchor = anchorAt === -1 ? '' : afterPrefix.slice(anchorAt + 1)
  const queryAt = routeAndQuery.indexOf('?')
  const path = queryAt === -1 ? routeAndQuery : routeAndQuery.slice(0, queryAt)
  const query = queryAt === -1 ? '' : routeAndQuery.slice(queryAt + 1)

  const route = ROUTE_BY_PATH.get(path)
  if (!route) return homeResult(false)
  return { route, params: new URLSearchParams(query), anchor: anchor === '' ? null : anchor, known: true }
}

// The hash a link or navigate() should use. `query` may start with '?' or not.
export function routeHash(route: Route, query?: string): string {
  const path = route === 'home' ? '' : route
  const search = query?.replace(/^\?/, '')
  return `#/${path}${search ? `?${search}` : ''}`
}

function navigate(route: Route, query?: string): void {
  window.location.hash = routeHash(route, query)
}

// Ids can contain dots (src-cost.dieselNgnPerLitre), so look the element up by id
// directly; a CSS selector built from the raw id would read the dot as a class.
export function scrollToAnchor(anchor: string | null): void {
  if (anchor === null) return
  document.getElementById(anchor)?.scrollIntoView()
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

function readHash(): string {
  return window.location.hash
}

export function useHashRoute(): {
  route: Route
  params: URLSearchParams
  anchor: string | null
  navigate(r: Route, query?: string): void
} {
  const hash = useSyncExternalStore(subscribe, readHash)
  const parsed = useMemo(() => parseHash(hash), [hash])

  // An unknown route renders home. Rewrite the URL too, so the address bar matches
  // the page. replaceState adds no history entry and fires no hashchange.
  useEffect(() => {
    if (!parsed.known) window.history.replaceState(null, '', HOME_HASH)
  }, [parsed.known])

  return { route: parsed.route, params: parsed.params, anchor: parsed.anchor, navigate }
}
