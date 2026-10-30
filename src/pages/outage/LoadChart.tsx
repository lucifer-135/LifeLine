import { useId, useMemo } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DotItemDotProps, TooltipContentProps } from 'recharts'
import { STEPS_PER_DAY } from '../../engine/constants'
import { stepToClock } from '../../engine/events'
import type { TwinResult } from '../../engine/types'
import {
  chartPoints,
  chartSummary,
  gridDownRuns,
  gridUpRuns,
  hiddenPoints,
  hourlyRows,
  kwAxisTicks,
  revealUpTo,
} from './chartData'
import type { ChartPoint } from './chartData'
import './LoadChart.css'

// Hour labels every 4 hours: "00:00" to "20:00".
const X_TICKS = [0, 16, 32, 48, 64, 80]
// Both y axes get a fixed width, so the grid strip above the plot can line up with the
// plot area using the same numbers (LoadChart.css reads them as --axis-left/--axis-right).
const AXIS_WIDTH = 44
const CHART_MARGIN = { top: 8, right: 0, bottom: 0, left: 0 }
// --text-faint is only 4.4:1 on the --night-800 panel, under the 4.5:1 minimum for text,
// so the ticks use --text-muted (7.4:1).
const TICK_STYLE = { fill: 'var(--text-muted)', fontSize: 12 }

const formatKw = (value: number) => `${value.toFixed(1)} kW`
const formatPercent = (value: number) => `${value.toFixed(1)}%`

interface LegendItem {
  label: string
  swatch: 'fill' | 'hatch' | 'line'
  color: string
  dash?: string
  storageOnly?: boolean
}

// Every series, in the order the chart stacks or draws them (DESIGN §9).
const LEGEND: LegendItem[] = [
  { label: 'Life-critical served', swatch: 'fill', color: 'var(--t1)' },
  { label: 'Essential served', swatch: 'fill', color: 'var(--t2)' },
  { label: 'Can wait served', swatch: 'hatch', color: 'var(--t3)' },
  { label: 'Solar output', swatch: 'line', color: 'var(--solar)', dash: '6 4', storageOnly: true },
  { label: 'Battery %', swatch: 'line', color: 'var(--battery)', storageOnly: true },
  { label: 'Generator', swatch: 'line', color: 'var(--diesel)', dash: '2 3' },
]

function LegendSwatch({ item, hatchId }: { item: LegendItem; hatchId: string }) {
  return (
    <svg className="chart-legend__swatch" width={24} height={12} viewBox="0 0 24 12" aria-hidden="true">
      {item.swatch === 'line' ? (
        <line x1={0} y1={6} x2={24} y2={6} stroke={item.color} strokeWidth={2} strokeDasharray={item.dash} />
      ) : (
        <rect
          x={0}
          y={1}
          width={24}
          height={10}
          rx={2}
          fill={item.swatch === 'hatch' ? `url(#${hatchId})` : item.color}
        />
      )}
    </svg>
  )
}

// Can-wait load is the dimmest lamp colour plus a diagonal hatch, so it is told apart
// without relying on colour.
function HatchPattern({ id }: { id: string }) {
  return (
    <pattern id={id} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width={6} height={6} fill="var(--t3)" fillOpacity={0.45} />
      <line x1={0} y1={0} x2={0} y2={6} stroke="var(--t3)" strokeWidth={3} />
    </pattern>
  )
}

interface ChartTooltipProps {
  active: boolean
  label: TooltipContentProps['label']
  points: ChartPoint[]
  showStorage: boolean
}

function ChartTooltip({ active, label, points, showStorage }: ChartTooltipProps) {
  if (!active || typeof label !== 'number') return null
  const step = Math.floor(label)
  const point = points[step]
  // Steps still to come have no values yet.
  if (!point || point.lifeCritical === null) return null

  const rows = [
    { name: 'Life-critical', value: point.lifeCritical, format: formatKw },
    { name: 'Essential', value: point.essential, format: formatKw },
    { name: 'Can wait', value: point.canWait, format: formatKw },
    { name: 'Solar', value: point.solar, format: formatKw, storageOnly: true },
    { name: 'Battery', value: point.battery, format: formatPercent, storageOnly: true },
    { name: 'Generator', value: point.generator, format: formatKw },
  ].filter((row) => showStorage || !row.storageOnly)

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__time">{stepToClock(step)}</p>
      <dl className="chart-tooltip__rows">
        {rows.map(({ name, value, format }) => (
          <div key={name} className="chart-tooltip__row">
            <dt>{name}</dt>
            <dd>{value === null ? '—' : format(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// The 10px band above the plot: blue where the grid is up. It shares the chart's x
// scale (0 to 96) and is inset by the axis widths, so its segments sit over the plot.
function GridStrip({ runs }: { runs: { start: number; end: number }[] }) {
  return (
    <div className="load-chart__strip">
      <span className="load-chart__strip-label">Grid</span>
      <svg className="load-chart__strip-bar" viewBox={`0 0 ${STEPS_PER_DAY} 10`} preserveAspectRatio="none">
        <rect className="load-chart__strip-off" x={0} y={0} width={STEPS_PER_DAY} height={10} />
        {runs.map((run) => (
          <rect
            key={run.start}
            className="load-chart__strip-on"
            x={run.start}
            y={0}
            width={run.end - run.start}
            height={10}
          />
        ))}
      </svg>
    </div>
  )
}

interface LoadChartProps {
  result: TwinResult
  step: number
}

// Served load by tier, solar, battery and generator through the day, revealed up to the
// current step. Everything that does not depend on the step is computed once per day.
export function LoadChart({ result, step }: LoadChartProps) {
  const titleId = useId()
  const hatchId = useId()
  const showStorage = result.scenario === 'lifeline'

  const points = useMemo(() => chartPoints(result), [result])
  const hidden = useMemo(() => hiddenPoints(points), [points])
  const data = useMemo(() => revealUpTo(points, hidden, step), [points, hidden, step])
  const upRuns = useMemo(() => gridUpRuns(result.steps), [result])
  const downRuns = useMemo(() => gridDownRuns(result.steps), [result])
  const kwTicks = useMemo(() => kwAxisTicks(result), [result])
  const summary = useMemo(() => chartSummary(result), [result])
  const rows = useMemo(() => hourlyRows(result), [result])
  const legend = showStorage ? LEGEND : LEGEND.filter((item) => !item.storageOnly)

  // A dot on the battery line marks where the day has got to.
  const batteryDot = (props: DotItemDotProps) =>
    props.index === step && props.cx !== undefined && props.cy !== undefined ? (
      <circle key="current" className="load-chart__battery-dot" cx={props.cx} cy={props.cy} r={4} />
    ) : null

  return (
    <section className="load-chart" aria-labelledby={titleId} data-storage={showStorage}>
      <h2 id={titleId}>Load through the day</h2>
      <svg className="load-chart__defs" width={0} height={0} aria-hidden="true">
        <defs>
          <HatchPattern id={hatchId} />
        </defs>
      </svg>
      <ul className="chart-legend">
        {legend.map((item) => (
          <li key={item.label} className="chart-legend__item">
            <LegendSwatch item={item} hatchId={hatchId} />
            {item.label}
          </li>
        ))}
      </ul>

      <div className="load-chart__figure" role="img" aria-label={summary}>
        <div className="load-chart__axis-titles" aria-hidden="true">
          <span>kW</span>
          {showStorage && <span>Battery %</span>}
        </div>
        <GridStrip runs={upRuns} />
        <div className="load-chart__plot">
          <ComposedChart
            responsive
            data={data}
            margin={CHART_MARGIN}
            accessibilityLayer={false}
            style={{ width: '100%', height: '100%' }}
          >
            <CartesianGrid yAxisId="kw" vertical={false} stroke="var(--line)" strokeOpacity={0.5} />
            <XAxis
              dataKey="x"
              type="number"
              domain={[0, STEPS_PER_DAY]}
              ticks={X_TICKS}
              tickFormatter={stepToClock}
              tick={TICK_STYLE}
              tickLine={false}
              axisLine={{ stroke: 'var(--line)' }}
              allowDataOverflow
            />
            <YAxis
              yAxisId="kw"
              domain={[0, kwTicks[kwTicks.length - 1]]}
              ticks={kwTicks}
              width={AXIS_WIDTH}
              tick={TICK_STYLE}
              tickLine={false}
              axisLine={false}
            />
            {showStorage && (
              <YAxis
                yAxisId="battery"
                orientation="right"
                domain={[0, 100]}
                ticks={[0, 50, 100]}
                width={AXIS_WIDTH}
                tick={TICK_STYLE}
                tickLine={false}
                axisLine={false}
              />
            )}
            {downRuns.map((run) => (
              <ReferenceArea
                key={run.start}
                yAxisId="kw"
                x1={run.start}
                x2={run.end}
                fill="var(--night-950)"
                fillOpacity={0.08}
                stroke="none"
                ifOverflow="hidden"
              />
            ))}
            <Area
              yAxisId="kw"
              dataKey="lifeCritical"
              stackId="served"
              type="linear"
              stroke="none"
              fill="var(--t1)"
              fillOpacity={0.85}
              isAnimationActive={false}
              activeDot={false}
            />
            <Area
              yAxisId="kw"
              dataKey="essential"
              stackId="served"
              type="linear"
              stroke="none"
              fill="var(--t2)"
              fillOpacity={0.8}
              isAnimationActive={false}
              activeDot={false}
            />
            <Area
              yAxisId="kw"
              dataKey="canWait"
              stackId="served"
              type="linear"
              stroke="none"
              fill={`url(#${hatchId})`}
              fillOpacity={1}
              isAnimationActive={false}
              activeDot={false}
            />
            {showStorage && (
              <Line
                yAxisId="kw"
                dataKey="solar"
                type="linear"
                stroke="var(--solar)"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            )}
            {showStorage && (
              <Line
                yAxisId="battery"
                dataKey="battery"
                type="linear"
                stroke="var(--battery)"
                strokeWidth={2}
                dot={batteryDot}
                activeDot={false}
                isAnimationActive={false}
              />
            )}
            <Line
              yAxisId="kw"
              dataKey="generator"
              type="linear"
              stroke="var(--diesel)"
              strokeWidth={2}
              strokeDasharray="2 3"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <ReferenceLine yAxisId="kw" x={step + 0.5} stroke="var(--text)" strokeWidth={1} ifOverflow="hidden" />
            <Tooltip
              isAnimationActive={false}
              cursor={{ stroke: 'var(--line-strong)' }}
              content={(props) => (
                <ChartTooltip active={props.active} label={props.label} points={data} showStorage={showStorage} />
              )}
            />
          </ComposedChart>
        </div>
      </div>

      {/* A table box ignores the 1px width, so the wrapper does the hiding. */}
      <div className="visually-hidden">
        <table>
          <caption>Hourly averages</caption>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Life-critical kW</th>
              <th scope="col">Essential kW</th>
              <th scope="col">Can wait kW</th>
              {showStorage && <th scope="col">Solar kW</th>}
              {showStorage && <th scope="col">Battery %</th>}
              <th scope="col">Generator kW</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.time}>
                <th scope="row">{row.time}</th>
                <td>{row.lifeCritical.toFixed(1)}</td>
                <td>{row.essential.toFixed(1)}</td>
                <td>{row.canWait.toFixed(1)}</td>
                {showStorage && <td>{row.solar.toFixed(1)}</td>}
                {showStorage && <td>{row.battery.toFixed(1)}</td>}
                <td>{row.generator.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
