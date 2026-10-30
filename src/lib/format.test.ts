import { expect, test } from 'vitest'
import { formatDuration, formatNgn, formatPct, formatUsd, formatYears } from './format'

test('formatDuration: under an hour shows minutes only', () => {
  expect(formatDuration(0)).toBe('0m')
  expect(formatDuration(45)).toBe('45m')
  expect(formatDuration(59)).toBe('59m')
})

test('formatDuration: an hour or more shows hours and minutes', () => {
  expect(formatDuration(680)).toBe('11h 20m')
  expect(formatDuration(60)).toBe('1h 0m')
  expect(formatDuration(120)).toBe('2h 0m')
})

test('formatDuration: rounds to the nearest minute, carrying into the hour', () => {
  expect(formatDuration(44.6)).toBe('45m')
  expect(formatDuration(0.4)).toBe('0m')
  expect(formatDuration(59.6)).toBe('1h 0m')
  expect(formatDuration(680.4)).toBe('11h 20m')
})

test('formatDuration: negative reads as 0m, non-finite as a dash', () => {
  expect(formatDuration(-5)).toBe('0m')
  expect(formatDuration(Number.NaN)).toBe('—')
  expect(formatDuration(Infinity)).toBe('—')
  expect(formatDuration(-Infinity)).toBe('—')
})

test('formatters: the brief examples', () => {
  expect(formatNgn(68_700_000)).toBe('₦68.7M')
  expect(formatNgn(950_000)).toBe('₦950K')
  expect(formatNgn(68_700_000, 'full')).toBe('₦68,700,000')
  expect(formatUsd(1_600_000, 1600)).toBe('$1.0K')
  expect(formatPct(0.151)).toBe('15.1%')
  expect(formatYears(null)).toBe('n/a')
  expect(formatYears(1.94)).toBe('1.9 yrs')
  expect(formatDuration(680)).toBe('11h 20m')
  expect(formatDuration(45)).toBe('45m')
  expect(formatDuration(0)).toBe('0m')
})

test('formatNgn compact: below 1,000 is a whole number with no suffix', () => {
  expect(formatNgn(0)).toBe('₦0')
  expect(formatNgn(950)).toBe('₦950')
  expect(formatNgn(12.7)).toBe('₦13')
  expect(formatNgn(949.4)).toBe('₦949')
})

test('formatNgn compact: 1 decimal under 100 of a unit, none from 100', () => {
  expect(formatNgn(1_000)).toBe('₦1.0K')
  expect(formatNgn(12_345)).toBe('₦12.3K')
  expect(formatNgn(99_949)).toBe('₦99.9K')
  expect(formatNgn(123_456)).toBe('₦123K')
  expect(formatNgn(1_500_000_000)).toBe('₦1.5B')
  expect(formatNgn(250_400_000)).toBe('₦250M')
})

test('formatNgn compact: rounding that reaches the next unit carries over', () => {
  expect(formatNgn(999.6)).toBe('₦1.0K')
  expect(formatNgn(99_960)).toBe('₦100K')
  expect(formatNgn(999_960)).toBe('₦1.0M')
  expect(formatNgn(999_960_000)).toBe('₦1.0B')
  expect(formatNgn(999_400)).toBe('₦999K')
})

test('formatNgn: negative amounts lead with a minus sign', () => {
  expect(formatNgn(-1_200_000)).toBe('-₦1.2M')
  expect(formatNgn(-950)).toBe('-₦950')
  expect(formatNgn(-1_234_567, 'full')).toBe('-₦1,234,567')
})

test('formatNgn: an amount that rounds to zero has no minus sign', () => {
  expect(formatNgn(-0.3)).toBe('₦0')
  expect(formatNgn(-0.3, 'full')).toBe('₦0')
  expect(formatNgn(-0)).toBe('₦0')
})

test('formatNgn full: whole naira with comma grouping', () => {
  expect(formatNgn(0, 'full')).toBe('₦0')
  expect(formatNgn(999, 'full')).toBe('₦999')
  expect(formatNgn(1_234.5, 'full')).toBe('₦1,235')
  expect(formatNgn(1_000_000_000, 'full')).toBe('₦1,000,000,000')
})

test('formatNgn: non-finite values read n/a in both modes', () => {
  for (const bad of [Number.NaN, Infinity, -Infinity]) {
    expect(formatNgn(bad)).toBe('n/a')
    expect(formatNgn(bad, 'full')).toBe('n/a')
  }
})

test('formatUsd: converts at the given rate and compacts like naira', () => {
  expect(formatUsd(68_700_000, 1600)).toBe('$42.9K')
  expect(formatUsd(1_600_000_000, 1600)).toBe('$1.0M')
  expect(formatUsd(0, 1600)).toBe('$0')
  expect(formatUsd(-1_600_000, 1600)).toBe('-$1.0K')
})

test('formatUsd: a rate that is 0, negative or not a number reads n/a, never Infinity', () => {
  expect(formatUsd(1_600_000, 0)).toBe('n/a')
  expect(formatUsd(0, 0)).toBe('n/a')
  expect(formatUsd(1_600_000, -1600)).toBe('n/a')
  expect(formatUsd(1_600_000, Number.NaN)).toBe('n/a')
  expect(formatUsd(1_600_000, Infinity)).toBe('n/a')
})

test('formatUsd: a non-finite naira amount reads n/a', () => {
  expect(formatUsd(Number.NaN, 1600)).toBe('n/a')
  expect(formatUsd(Infinity, 1600)).toBe('n/a')
  expect(formatUsd(-Infinity, 1600)).toBe('n/a')
})

test('formatPct: one decimal, any sign', () => {
  expect(formatPct(0)).toBe('0.0%')
  expect(formatPct(1)).toBe('100.0%')
  expect(formatPct(-0.052)).toBe('-5.2%')
  expect(formatPct(6.18)).toBe('618.0%')
})

test('formatPct: a value that rounds to zero has no minus sign', () => {
  expect(formatPct(-0.00004)).toBe('0.0%')
})

test('formatPct: non-finite values read n/a', () => {
  expect(formatPct(Number.NaN)).toBe('n/a')
  expect(formatPct(Infinity)).toBe('n/a')
  expect(formatPct(-Infinity)).toBe('n/a')
})

test('formatYears: one decimal and the unit; null or non-finite reads n/a', () => {
  expect(formatYears(0)).toBe('0.0 yrs')
  expect(formatYears(10)).toBe('10.0 yrs')
  expect(formatYears(0.0878)).toBe('0.1 yrs')
  expect(formatYears(Number.NaN)).toBe('n/a')
  expect(formatYears(Infinity)).toBe('n/a')
})
