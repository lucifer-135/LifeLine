export interface Stat {
  before: string
  value: number
  after: string
  sourceId: string
}

// Rendered as `before` + CountUp(`value`) + `after`. Wording is DESIGN.md §6.0.
export const HOME_STATS: Stat[] = [
  {
    before: 'Nigerian hospitals lose grid power for 8 to ',
    value: 20,
    after: ' hours a day.',
    sourceId: 'stat.outageHours',
  },
  {
    before: 'About ',
    value: 40,
    after: '% of primary health centres have no electricity at all.',
    sourceId: 'stat.phcNoPower',
  },
  {
    before: 'Solar at two Nigerian health centres cut service interruptions by over ',
    value: 80,
    after: '%.',
    sourceId: 'stat.whoSolar',
  },
]
