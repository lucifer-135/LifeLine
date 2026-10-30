import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

// Matches --dur-fast, --ease-out and the 6px rise. Motion takes
// seconds and a number array, so the CSS tokens cannot be read here.
const FADE_SECONDS = 0.18
const RISE_PX = 6
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1]

// Crossfades between routes. mode="wait" lets the old page leave before the new
// one mounts, so only one page is ever in the DOM at rest. initial={false} skips
// the entrance on first load: the home hero plays its own sequence.
export function PageTransition({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  const reduceMotion = useReducedMotion()
  const transition = { duration: reduceMotion ? 0 : FADE_SECONDS, ease: EASE_OUT }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={routeKey}
        initial={{ opacity: 0, y: reduceMotion ? 0 : RISE_PX }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={transition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
