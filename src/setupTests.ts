import '@testing-library/jest-dom/vitest'

// jsdom implements none of matchMedia, IntersectionObserver or ResizeObserver.
// `motion` (useInView, reduced-motion checks) and Recharts (ResponsiveContainer)
// need them to exist. These are inert defaults; tests that care override them,
// e.g. `vi.spyOn(window, 'matchMedia').mockImplementation(...)` for reduced motion.

function createMediaQueryList(query: string): MediaQueryList {
  return {
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    // Deprecated pair, still called by older `motion` code paths.
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }
}

class IntersectionObserverStub implements IntersectionObserver {
  readonly root = null
  readonly rootMargin = ''
  readonly scrollMargin = ''
  readonly thresholds: readonly number[] = []
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

window.matchMedia = createMediaQueryList
window.IntersectionObserver = IntersectionObserverStub
window.ResizeObserver = ResizeObserverStub
