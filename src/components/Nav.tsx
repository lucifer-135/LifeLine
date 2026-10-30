import { Menu } from 'lucide-react'
import { useId, useState } from 'react'
import { routeHash, useHashRoute } from '../state/useHashRoute'
import type { Route } from '../state/useHashRoute'
import './Nav.css'

const LINKS: { route: Route; label: string }[] = [
  { route: 'profile', label: 'Hospital profile' },
  { route: 'outage', label: 'Outage day' },
  { route: 'plan', label: 'Plan & finance' },
  { route: 'method', label: 'Method' },
]

// A lit window: four panes. Colour comes from Nav.css so it follows the tokens.
function LampMark() {
  return (
    <svg className="nav__mark" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="7" height="7" rx="1" />
      <rect x="11" y="2" width="7" height="7" rx="1" />
      <rect x="2" y="11" width="7" height="7" rx="1" />
      <rect x="11" y="11" width="7" height="7" rx="1" />
    </svg>
  )
}

export function Nav() {
  const { route } = useHashRoute()
  const [menuOpen, setMenuOpen] = useState(false)
  const panelId = useId()
  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="nav">
      <nav className="nav__bar container" aria-label="Main">
        <a className="nav__brand" href={routeHash('home')} onClick={closeMenu}>
          <LampMark />
          <span>Lifeline</span>
        </a>
        <button
          type="button"
          className="button button--secondary nav__menu-button"
          aria-expanded={menuOpen}
          aria-controls={panelId}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Menu size={20} />
          Menu
        </button>
        <ul id={panelId} className="nav__links" data-open={menuOpen}>
          {LINKS.map((link) => (
            <li key={link.route}>
              <a
                className="nav__link"
                href={routeHash(link.route)}
                aria-current={route === link.route ? 'page' : undefined}
                onClick={closeMenu}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
