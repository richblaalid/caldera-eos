/**
 * Weekend-aware lookback window for briefing data queries.
 *
 * On Monday, expands the window by 48h so it reaches back to Thursday/Friday.
 * On Tuesday, expands by 24h to catch any weekend stragglers.
 * Other days use the normal lookback period.
 *
 * @param normalHours - Default lookback in hours (e.g., 48 for transcripts, 24 for emails)
 * @param now - Injectable timestamp for testing (defaults to Date.now())
 * @returns ISO 8601 cutoff datetime string
 */
export function getSmartLookback(normalHours: number, now: number = Date.now()): string {
  const date = new Date(now)
  const dayOfWeek = date.getDay() // 0=Sun, 1=Mon, 2=Tue, ...

  let extraHours = 0
  if (dayOfWeek === 1) extraHours = 48 // Monday: reach back to Thursday
  if (dayOfWeek === 2) extraHours = 24 // Tuesday: catch weekend stragglers

  const totalMs = (normalHours + extraHours) * 60 * 60 * 1000
  return new Date(now - totalMs).toISOString()
}

/**
 * Get a day-aware label for transcript highlights in the briefing prompt.
 */
export function getTranscriptLabel(now: number = Date.now()): string {
  const dayOfWeek = new Date(now).getDay()
  if (dayOfWeek === 1) return 'Recent Meetings (Thu-Sun)'
  if (dayOfWeek === 2) return 'Recent Meetings (Sat-Mon)'
  return "Yesterday's Meetings"
}
