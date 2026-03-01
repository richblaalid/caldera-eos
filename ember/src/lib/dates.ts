/** Returns ISO string for N days ago. */
export function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString()
}

/** Returns today's date as YYYY-MM-DD in UTC. */
export function todayUTC(): string {
  return new Date().toISOString().split('T')[0]
}
