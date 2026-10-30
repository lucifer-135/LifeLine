import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from './App'
import { AppProvider } from './state/AppState'

const HOME_HEADING = 'No hospital should go dark.'

function renderAt(hash: string) {
  window.location.hash = hash
  return render(
    <AppProvider>
      <App />
    </AppProvider>,
  )
}

function pageHeading(name: string) {
  return screen.findByRole('heading', { level: 1, name })
}

// jsdom's window.scrollTo only logs "not implemented"; a spy keeps the output
// clean and lets tests see when the app resets the scroll position. It stays
// installed for the whole file (jsdom is per file): a page that mounted at the
// very end of a test can still run its effect while RTL cleans up.
const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

// replaceState does not fire `hashchange`, so each test starts from a clean URL.
beforeEach(() => {
  window.history.replaceState(null, '', window.location.pathname)
  document.title = ''
  scrollTo.mockClear()
})

describe('routing', () => {
  test('hash route: unknown hash falls back to home', async () => {
    renderAt('#/nope')
    expect(await pageHeading(HOME_HEADING)).toBeVisible()
    expect(window.location.hash).toBe('#/')
  })

  test('an empty hash is home', async () => {
    renderAt('')
    expect(await pageHeading(HOME_HEADING)).toBeVisible()
  })

  test.each([
    ['#/', HOME_HEADING, 'Lifeline — Hospital Power Continuity'],
    ['#/profile', 'Hospital profile', 'Hospital profile — Lifeline'],
    ['#/outage', 'Outage day', 'Outage day — Lifeline'],
    ['#/plan', 'Plan & finance', 'Plan & finance — Lifeline'],
    ['#/method', 'Method & sources', 'Method — Lifeline'],
  ])('%s shows its page and sets the document title', async (hash, heading, title) => {
    renderAt(hash)
    expect(await pageHeading(heading)).toBeVisible()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(document.title).toBe(title)
  })

  test('nav switches route', async () => {
    renderAt('#/')
    await pageHeading(HOME_HEADING)

    fireEvent.click(screen.getByRole('link', { name: 'Outage day' }))

    // jsdom applies a clicked fragment link on a later task, so wait for it.
    await waitFor(() => expect(window.location.hash).toBe('#/outage'))
    expect(await pageHeading('Outage day')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: HOME_HEADING })).not.toBeInTheDocument()
    expect(document.title).toBe('Outage day — Lifeline')
  })

  test('the Lifeline mark and name link home', async () => {
    renderAt('#/plan')
    await pageHeading('Plan & finance')

    const brand = screen.getByRole('link', { name: 'Lifeline' })
    expect(brand).toHaveAttribute('href', '#/')
    fireEvent.click(brand)

    expect(await pageHeading(HOME_HEADING)).toBeInTheDocument()
  })

  test('follows a hash change made outside the app', async () => {
    renderAt('#/')
    await pageHeading(HOME_HEADING)

    act(() => {
      window.location.hash = '#/plan'
    })

    expect(await pageHeading('Plan & finance')).toBeInTheDocument()
  })

  test('the new page fades in to full visibility', async () => {
    renderAt('#/')
    await pageHeading(HOME_HEADING)

    fireEvent.click(screen.getByRole('link', { name: 'Plan & finance' }))

    const heading = await pageHeading('Plan & finance')
    await waitFor(() => expect(heading).toBeVisible())
  })

  test('a query on the hash does not change the page', async () => {
    renderAt('#/outage?autoplay=1')
    expect(await pageHeading('Outage day')).toBeVisible()
  })
})

describe('nav', () => {
  test('lists the four pages in order, as hash links', async () => {
    renderAt('#/')
    await pageHeading(HOME_HEADING)

    const links = screen
      .getAllByRole('link')
      .filter((link) => link.closest('nav') !== null && link.textContent !== 'Lifeline')
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Hospital profile', '#/profile'],
      ['Outage day', '#/outage'],
      ['Plan & finance', '#/plan'],
      ['Method', '#/method'],
    ])
  })

  test('marks only the active page with aria-current', async () => {
    renderAt('#/plan')
    await pageHeading('Plan & finance')

    expect(screen.getByRole('link', { name: 'Plan & finance' })).toHaveAttribute('aria-current', 'page')
    for (const name of ['Hospital profile', 'Outage day', 'Method']) {
      expect(screen.getByRole('link', { name })).not.toHaveAttribute('aria-current')
    }
  })

  test('aria-current follows the route', async () => {
    renderAt('#/')
    await pageHeading(HOME_HEADING)
    expect(document.querySelector('[aria-current="page"]')).toBeNull()

    fireEvent.click(screen.getByRole('link', { name: 'Method' }))

    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Method' })).toHaveAttribute('aria-current', 'page'),
    )
  })

  test('the Menu button opens and closes the links panel', async () => {
    renderAt('#/')
    await pageHeading(HOME_HEADING)

    const menu = screen.getByRole('button', { name: 'Menu' })
    expect(menu).toHaveAttribute('aria-expanded', 'false')
    const panelId = menu.getAttribute('aria-controls')
    if (!panelId) throw new Error('Menu button needs aria-controls')
    expect(document.getElementById(panelId)).toContainElement(screen.getByRole('link', { name: 'Outage day' }))

    fireEvent.click(menu)
    expect(menu).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(menu)
    expect(menu).toHaveAttribute('aria-expanded', 'false')
  })

  test('picking a link closes the menu', async () => {
    renderAt('#/')
    await pageHeading(HOME_HEADING)

    const menu = screen.getByRole('button', { name: 'Menu' })
    fireEvent.click(menu)
    expect(menu).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(screen.getByRole('link', { name: 'Plan & finance' }))

    expect(menu).toHaveAttribute('aria-expanded', 'false')
    expect(await pageHeading('Plan & finance')).toBeInTheDocument()
    // The route changed, so focus goes to the new page, not back to the Menu button.
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus())
  })

  // No route change means nothing moves focus to <main>, and the link vanishes with the
  // panel, so focus would drop to <body>.
  test('picking the page you are on closes the menu and returns focus to the Menu button', async () => {
    renderAt('#/plan')
    await pageHeading('Plan & finance')

    const menu = screen.getByRole('button', { name: 'Menu' })
    fireEvent.click(menu)
    const current = screen.getByRole('link', { name: 'Plan & finance' })
    current.focus()
    fireEvent.click(current)

    expect(menu).toHaveAttribute('aria-expanded', 'false')
    expect(menu).toHaveFocus()
    expect(window.location.hash).toBe('#/plan')
  })
})

describe('focus and the skip link', () => {
  test('the skip link is the first focusable element', async () => {
    renderAt('#/profile')
    await pageHeading('Hospital profile')

    const firstFocusable = document.querySelector<HTMLElement>(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    expect(firstFocusable).toBe(screen.getByRole('link', { name: 'Skip to content' }))
  })

  test('the skip link moves focus to main without changing the hash', async () => {
    renderAt('#/profile')
    await pageHeading('Hospital profile')

    fireEvent.click(screen.getByRole('link', { name: 'Skip to content' }))

    expect(screen.getByRole('main')).toHaveFocus()
    expect(window.location.hash).toBe('#/profile')
    expect(await pageHeading('Hospital profile')).toBeVisible()
  })

  test('focus stays put on first load', async () => {
    renderAt('#/profile')
    await pageHeading('Hospital profile')
    expect(screen.getByRole('main')).not.toHaveFocus()
  })

  test('focus moves to main when the route changes', async () => {
    renderAt('#/profile')
    await pageHeading('Hospital profile')

    fireEvent.click(screen.getByRole('link', { name: 'Method' }))

    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus())
    expect(await pageHeading('Method & sources')).toBeInTheDocument()
  })
})

describe('anchors', () => {
  const scrollIntoView = vi.fn()
  const target = document.createElement('div')
  target.id = 'src-cost.dieselNgnPerLitre'

  // jsdom does not implement scrollIntoView.
  beforeEach(() => {
    scrollIntoView.mockClear()
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoView,
    })
    document.body.append(target)
  })

  afterEach(() => {
    target.remove()
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  })

  test('scrolls to the anchor after the page has rendered', async () => {
    renderAt('#/method#src-cost.dieselNgnPerLitre')
    await pageHeading('Method & sources')

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1))
    expect(scrollIntoView.mock.contexts[0]).toBe(target)
  })

  test('scrolls after a route change that carries an anchor', async () => {
    renderAt('#/plan')
    await pageHeading('Plan & finance')
    expect(scrollIntoView).not.toHaveBeenCalled()

    act(() => {
      window.location.hash = '#/method#src-cost.dieselNgnPerLitre'
    })
    await pageHeading('Method & sources')

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1))
    expect(scrollIntoView.mock.contexts[0]).toBe(target)
    // The anchor decides the position; the page is not also sent to the top.
    expect(scrollTo).not.toHaveBeenCalled()
  })

  test('does not scroll when there is no anchor', async () => {
    renderAt('#/method')
    await pageHeading('Method & sources')
    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})

describe('scroll position', () => {
  test('first load does not touch the scroll position', async () => {
    renderAt('#/plan')
    await pageHeading('Plan & finance')
    expect(scrollTo).not.toHaveBeenCalled()
  })

  test('a route change without an anchor scrolls to the top', async () => {
    renderAt('#/plan')
    await pageHeading('Plan & finance')

    fireEvent.click(screen.getByRole('link', { name: 'Method' }))
    await pageHeading('Method & sources')

    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(0, 0))
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  test('a hash change made outside the app also scrolls to the top', async () => {
    renderAt('#/outage')
    await pageHeading('Outage day')

    act(() => {
      window.location.hash = '#/method'
    })
    await pageHeading('Method & sources')

    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(0, 0))
  })

  test('each route change resets again, including a return to the first page', async () => {
    renderAt('#/plan')
    await pageHeading('Plan & finance')

    fireEvent.click(screen.getByRole('link', { name: 'Method' }))
    await pageHeading('Method & sources')
    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('link', { name: 'Plan & finance' }))
    await pageHeading('Plan & finance')
    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(2))
  })

  test('a query change on the same page leaves the scroll position alone', async () => {
    renderAt('#/outage')
    await pageHeading('Outage day')

    act(() => {
      window.location.hash = '#/outage?autoplay=1'
    })
    // Hash changes are handled in order, so once the next route has rendered the
    // query change has been processed too.
    act(() => {
      window.location.hash = '#/plan'
    })
    await pageHeading('Plan & finance')

    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1))
  })
})
