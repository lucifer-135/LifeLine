import { SOURCES } from '../data/sources'
import './SourceRef.css'

// Throws on an unknown id: every default number needs a source, and a typo here
// would otherwise ship a number without one.
export function SourceRef({ id }: { id: string }) {
  const index = SOURCES.findIndex((source) => source.id === id)
  if (index === -1) {
    throw new Error(`SourceRef: no source with id "${id}". Add it to src/data/sources.ts.`)
  }

  return (
    <sup className="source-ref">
      <a href={`#/method#src-${id}`} aria-label={`Source: ${SOURCES[index].label}`}>
        {index + 1}
      </a>
    </sup>
  )
}
