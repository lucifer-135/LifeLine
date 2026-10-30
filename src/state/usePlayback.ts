import { useCallback, useEffect, useReducer } from 'react'

export type PlaybackSpeed = 1 | 4 | 16

// Milliseconds of wall time per 15-minute step. 1× lets a viewer follow the story;
// 16× scrubs through the whole day in about 2.4 seconds.
const STEP_MS: Record<PlaybackSpeed, number> = { 1: 400, 4: 100, 16: 25 }

export interface Playback {
  step: number
  playing: boolean
  speed: PlaybackSpeed
  play(): void
  pause(): void
  toggle(): void
  setSpeed(speed: PlaybackSpeed): void
  seek(step: number): void
}

interface PlaybackState {
  step: number
  playing: boolean
  speed: PlaybackSpeed
  resetKey: string
}

// Every action that depends on the length of the day carries `lastStep`, which keeps
// the reducer pure and the callbacks below independent of the current state.
type PlaybackAction =
  | { type: 'tick'; lastStep: number }
  | { type: 'play'; lastStep: number }
  | { type: 'pause' }
  | { type: 'toggle'; lastStep: number }
  | { type: 'speed'; speed: PlaybackSpeed }
  | { type: 'seek'; step: number; lastStep: number }
  | { type: 'reset'; resetKey: string; autoplay: boolean }

// Playing from the end replays the day, so the play button never does nothing.
function startPlaying(state: PlaybackState, lastStep: number): PlaybackState {
  return { ...state, step: state.step >= lastStep ? 0 : state.step, playing: true }
}

function reducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  switch (action.type) {
    case 'tick': {
      if (!state.playing) return state
      const step = Math.min(state.step + 1, action.lastStep)
      return { ...state, step, playing: step < action.lastStep }
    }
    case 'play':
      return startPlaying(state, action.lastStep)
    case 'pause':
      return state.playing ? { ...state, playing: false } : state
    case 'toggle':
      return state.playing ? { ...state, playing: false } : startPlaying(state, action.lastStep)
    case 'speed':
      return { ...state, speed: action.speed }
    case 'seek': {
      const step = Math.min(Math.max(Math.round(action.step), 0), action.lastStep)
      return step === state.step ? state : { ...state, step }
    }
    case 'reset':
      return { ...state, step: 0, playing: action.autoplay, resetKey: action.resetKey }
  }
}

// Steps through a day of `totalSteps` steps on a timer. A new `resetKey` (for example
// a new seed or hospital) goes back to step 0, and plays again only if `autoplay` is on.
export function usePlayback(opts: {
  totalSteps: number
  resetKey: string
  autoplay: boolean
}): Playback {
  const { totalSteps, resetKey, autoplay } = opts
  const lastStep = Math.max(0, totalSteps - 1)

  const [state, dispatch] = useReducer(reducer, undefined, (): PlaybackState => ({
    step: 0,
    playing: autoplay,
    speed: 1,
    resetKey,
  }))

  // Reset while rendering rather than in an effect, so no frame shows the old day's
  // step against the new day's data. React re-renders at once with the updated state.
  if (state.resetKey !== resetKey) dispatch({ type: 'reset', resetKey, autoplay })

  const { playing, speed } = state
  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => dispatch({ type: 'tick', lastStep }), STEP_MS[speed])
    return () => clearInterval(timer)
  }, [playing, speed, lastStep])

  const play = useCallback(() => dispatch({ type: 'play', lastStep }), [lastStep])
  const pause = useCallback(() => dispatch({ type: 'pause' }), [])
  const toggle = useCallback(() => dispatch({ type: 'toggle', lastStep }), [lastStep])
  const setSpeed = useCallback(
    (next: PlaybackSpeed) => dispatch({ type: 'speed', speed: next }),
    [],
  )
  const seek = useCallback(
    (step: number) => {
      // A NaN step would reach the charts as NaN, so it is ignored.
      if (!Number.isNaN(step)) dispatch({ type: 'seek', step, lastStep })
    },
    [lastStep],
  )

  return { step: state.step, playing, speed, play, pause, toggle, setSpeed, seek }
}
