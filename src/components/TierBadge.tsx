import type { Tier } from '../engine/types'
import './TierBadge.css'

// The UI never shows tier codes: it says what the load means for patients.
const TIER_BADGES: Record<Tier, { label: string; modifier: string }> = {
  T1: { label: 'Life-critical', modifier: 'life-critical' },
  T2: { label: 'Essential', modifier: 'essential' },
  T3: { label: 'Can wait', modifier: 'can-wait' },
}

// Colour only repeats the text, so meaning never depends on it.
export function TierBadge({ tier }: { tier: Tier }) {
  const { label, modifier } = TIER_BADGES[tier]
  return (
    <span className={`tier-badge tier-badge--${modifier}`}>
      <span className="tier-badge__dot" aria-hidden="true" />
      {label}
    </span>
  )
}
