import { describe, it, expect } from 'vitest'
import { getSmartLookback, getTranscriptLabel } from '../lookback'

// Helper: create a timestamp for a specific day of week at noon UTC
function atDay(dayOfWeek: number): number {
  // 2026-02-23 is a Monday (dayOfWeek=1)
  // Offset from Monday to desired day
  const monday = new Date('2026-02-23T12:00:00Z')
  const offset = dayOfWeek - 1 // Mon=0 offset, Tue=1, etc.
  const target = new Date(monday.getTime() + offset * 24 * 60 * 60 * 1000)
  // Handle Sunday (dayOfWeek=0) → go back 1 day from Monday
  if (dayOfWeek === 0) {
    return new Date(monday.getTime() - 24 * 60 * 60 * 1000).getTime()
  }
  return target.getTime()
}

function hoursBack(now: number, isoString: string): number {
  const cutoff = new Date(isoString).getTime()
  return Math.round((now - cutoff) / (60 * 60 * 1000))
}

describe('getSmartLookback', () => {
  it('Monday 48h → 96h back (reaches Thursday)', () => {
    const now = atDay(1) // Monday
    const result = getSmartLookback(48, now)
    expect(hoursBack(now, result)).toBe(96)
  })

  it('Monday 24h → 72h back', () => {
    const now = atDay(1)
    const result = getSmartLookback(24, now)
    expect(hoursBack(now, result)).toBe(72)
  })

  it('Tuesday 48h → 72h back', () => {
    const now = atDay(2) // Tuesday
    const result = getSmartLookback(48, now)
    expect(hoursBack(now, result)).toBe(72)
  })

  it('Tuesday 24h → 48h back', () => {
    const now = atDay(2)
    const result = getSmartLookback(24, now)
    expect(hoursBack(now, result)).toBe(48)
  })

  it('Wednesday 48h → 48h (unchanged)', () => {
    const now = atDay(3) // Wednesday
    const result = getSmartLookback(48, now)
    expect(hoursBack(now, result)).toBe(48)
  })

  it('Saturday 48h → 48h (unchanged)', () => {
    const now = atDay(6) // Saturday
    const result = getSmartLookback(48, now)
    expect(hoursBack(now, result)).toBe(48)
  })

  it('Sunday 24h → 24h (unchanged)', () => {
    const now = atDay(0) // Sunday
    const result = getSmartLookback(24, now)
    expect(hoursBack(now, result)).toBe(24)
  })

  it('returns a valid ISO 8601 string', () => {
    const result = getSmartLookback(48, atDay(3))
    expect(new Date(result).toISOString()).toBe(result)
  })
})

describe('getTranscriptLabel', () => {
  it('returns Thu-Sun label on Monday', () => {
    expect(getTranscriptLabel(atDay(1))).toBe('Recent Meetings (Thu-Sun)')
  })

  it('returns Sat-Mon label on Tuesday', () => {
    expect(getTranscriptLabel(atDay(2))).toBe('Recent Meetings (Sat-Mon)')
  })

  it('returns Yesterday\'s Meetings on Wednesday', () => {
    expect(getTranscriptLabel(atDay(3))).toBe("Yesterday's Meetings")
  })

  it('returns Yesterday\'s Meetings on Friday', () => {
    expect(getTranscriptLabel(atDay(5))).toBe("Yesterday's Meetings")
  })
})
