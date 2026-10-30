// "11h 20m" for a runway, "45m" under an hour. Rounds to the nearest minute.
export function formatDuration(min: number): string {
  if (!Number.isFinite(min)) return '—'
  const totalMin = Math.max(0, Math.round(min))
  if (totalMin < 60) return `${totalMin}m`
  return `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`
}
