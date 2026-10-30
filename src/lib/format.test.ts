import { expect, test } from 'vitest'
import { formatDuration } from './format'

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
