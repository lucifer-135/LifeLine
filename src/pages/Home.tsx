import { CountUp } from '../components/CountUp'
import { SourceRef } from '../components/SourceRef'
import { HOME_STATS } from '../data/stats'
import { DEMO_SEED } from '../engine/constants'
import { useApp } from '../state/AppState'
import { useHashRoute } from '../state/useHashRoute'
import { HeroScene } from './HeroScene'
import './Home.css'

// The demo always plays the same hospital on the same day, so the outage judges
// see is the one the numbers in HANDOFF.md were checked against.
const DEMO_PRESET_ID = 'kano-50'

// Copy from DESIGN §6.0. The title is the bold lead of each step.
const STEPS = [
  {
    title: 'Describe your hospital:',
    text: 'Pick a preset or list your equipment and how many hours of grid power you get.',
  },
  {
    title: 'Watch an outage day:',
    text: 'See every ward through a full day of outages, with and without Lifeline.',
  },
  {
    title: 'Get a plan and a price:',
    text: "Solar, battery and inverter sizes, a monthly fee below today's diesel bill, and a one-page proposal.",
  },
]

const formatWhole = (n: number) => String(Math.round(n))

export function Home() {
  const { dispatch } = useApp()
  const { navigate } = useHashRoute()

  // Reset to the demo hospital and day, even after the user has edited them. The season
  // is part of the day: the demo always replays the same typical one.
  const simulateOutage = () => {
    dispatch({ type: 'loadPreset', presetId: DEMO_PRESET_ID })
    dispatch({ type: 'setSeed', seed: DEMO_SEED })
    dispatch({ type: 'setSeason', season: 'typical' })
    navigate('outage', 'autoplay=1')
  }

  return (
    <>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="container home-hero__intro">
          <h1 id="home-title" className="display home-hero__title">
            No hospital should go dark.
          </h1>
          <p className="home-hero__lead">
            Lifeline sizes solar and batteries for Nigerian hospitals and shows, minute by minute, that
            life-critical care stays powered when the grid fails.
          </p>
          <div className="home-hero__actions">
            <button type="button" className="button button--primary home-hero__cta" onClick={simulateOutage}>
              Simulate an outage
            </button>
            <a className="home-hero__link" href="#/profile">
              Size my hospital
            </a>
          </div>
        </div>
        <HeroScene />
      </section>

      <section className="container home-section" aria-labelledby="home-why">
        <h2 id="home-why">Why it matters</h2>
        {/* The explicit role keeps list semantics in Safari, which drops them with list-style: none. */}
        <ul className="home-stats" role="list">
          {HOME_STATS.map((stat) => (
            <li key={stat.sourceId}>
              {stat.before}
              <span className="home-stats__number">
                <CountUp value={stat.value} format={formatWhole} startOnView />
              </span>
              {stat.after}
              <SourceRef id={stat.sourceId} />
            </li>
          ))}
        </ul>
        {/* Reports deaths, so it stays sober: no number, no amber, no animation. */}
        <p className="home-kano">
          In 2025, a prolonged outage at Aminu Kano Teaching Hospital was linked to deaths in its intensive care
          unit.
          <SourceRef id="stat.kanoIcu" />
        </p>
      </section>

      <section className="container home-section" aria-labelledby="home-how">
        <h2 id="home-how">How it works</h2>
        <ol className="home-steps" role="list">
          {STEPS.map((step, i) => (
            <li key={step.title} className="home-steps__step">
              {/* The list already numbers the steps for screen readers. */}
              <span className="home-steps__node" aria-hidden="true">
                {i + 1}
              </span>
              <p>
                <strong>{step.title}</strong> {step.text}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="container home-footer">
        <p>
          Built for the Global Energy Hackathon 2026. Open the <a href="#/method">method and sources</a>.
        </p>
      </footer>
    </>
  )
}
