import { Pause, Play } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { SegmentedControl } from '../../components/SegmentedControl'
import { Slider } from '../../components/Slider'
import { stepToClock } from '../../engine/events'
import type { Playback, PlaybackSpeed } from '../../state/usePlayback'
import './PlaybackBar.css'

const SPEED_OPTIONS: { value: PlaybackSpeed; label: string }[] = [
  { value: 1, label: '1×' },
  { value: 4, label: '4×' },
  { value: 16, label: '16×' },
]

// Controls that already act on Space. The bar must not toggle play on top of them.
const HANDLES_SPACE = 'button, input, select, textarea, a[href], [role="radio"], [role="button"]'

interface PlaybackBarProps {
  playback: Playback
  lastStep: number
}

export function PlaybackBar({ playback, lastStep }: PlaybackBarProps) {
  const { step, playing, speed, toggle, setSpeed, seek } = playback

  // Space toggles play while the bar has focus (DESIGN §6.2). Arrow keys move the
  // scrubber natively.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== ' ') return
    const target = event.target
    if (target !== event.currentTarget && target instanceof Element && target.closest(HANDLES_SPACE)) return
    event.preventDefault()
    toggle()
  }

  return (
    <div className="playback" role="group" aria-label="Playback" tabIndex={0} onKeyDown={handleKeyDown}>
      <button type="button" className="button button--primary playback__toggle" onClick={toggle}>
        {playing ? <Pause size={20} /> : <Play size={20} />}
        {playing ? 'Pause' : 'Play'}
      </button>
      <SegmentedControl label="Speed" options={SPEED_OPTIONS} value={speed} onChange={setSpeed} />
      <div className="playback__scrubber">
        <Slider label="Time of day" min={0} max={lastStep} step={1} value={step} onChange={seek} format={stepToClock} />
      </div>
    </div>
  )
}
