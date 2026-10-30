import type { ReactNode } from 'react'
import './Card.css'

interface CardProps {
  variant?: 'panel' | 'inset'
  as?: 'section' | 'div'
  className?: string
  'aria-labelledby'?: string
  children: ReactNode
}

export function Card({
  variant = 'panel',
  as: Element = 'div',
  className,
  'aria-labelledby': labelledBy,
  children,
}: CardProps) {
  const classes = ['card', `card--${variant}`, className].filter(Boolean).join(' ')
  return (
    <Element className={classes} aria-labelledby={labelledBy}>
      {children}
    </Element>
  )
}
