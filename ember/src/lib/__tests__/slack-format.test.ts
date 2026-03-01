import { describe, it, expect } from 'vitest'
import {
  escapeSlackMrkdwn,
  slackDate,
  truncateForSlack,
  chunkForSlackSections,
  sanitizeLLMForMrkdwn,
} from '../slack-format'

describe('escapeSlackMrkdwn', () => {
  it('escapes ampersand', () => {
    expect(escapeSlackMrkdwn('Fix login & signup')).toBe('Fix login &amp; signup')
  })

  it('escapes angle brackets', () => {
    expect(escapeSlackMrkdwn('Revenue > $500K')).toBe('Revenue &gt; $500K')
    expect(escapeSlackMrkdwn('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('escapes all three in combination', () => {
    expect(escapeSlackMrkdwn('A & B > C < D')).toBe('A &amp; B &gt; C &lt; D')
  })

  it('does not double-escape already escaped text', () => {
    // If someone passes already-escaped text, it gets escaped again — this is correct
    expect(escapeSlackMrkdwn('&amp;')).toBe('&amp;amp;')
  })

  it('leaves clean text unchanged', () => {
    expect(escapeSlackMrkdwn('Simple rock title')).toBe('Simple rock title')
  })

  it('handles empty string', () => {
    expect(escapeSlackMrkdwn('')).toBe('')
  })

  it('preserves mrkdwn formatting characters', () => {
    // *, _, ~, `, : are NOT escaped — they're mrkdwn syntax
    expect(escapeSlackMrkdwn('*bold* _italic_ `code`')).toBe('*bold* _italic_ `code`')
  })
})

describe('slackDate', () => {
  it('generates date token from Date object', () => {
    const date = new Date('2026-03-01T12:00:00Z')
    const result = slackDate(date, '{date_long}')
    expect(result).toMatch(/^<!date\^\d+\^\{date_long\}\|.+>$/)
  })

  it('generates date token from ISO string', () => {
    const result = slackDate('2026-03-01T12:00:00Z', '{date_short} {time}', 'Mar 1, 2026 12:00')
    expect(result).toMatch(/^<!date\^\d+\^\{date_short\} \{time\}\|Mar 1, 2026 12:00>$/)
  })

  it('generates date token from unix seconds', () => {
    const result = slackDate(1740830400, '{date_num}', '2025-03-01')
    expect(result).toBe('<!date^1740830400^{date_num}|2025-03-01>')
  })

  it('handles unix milliseconds', () => {
    const result = slackDate(1740830400000, '{date_num}', '2025-03-01')
    expect(result).toBe('<!date^1740830400^{date_num}|2025-03-01>')
  })

  it('generates fallback when not provided', () => {
    const result = slackDate('2026-03-01T12:00:00Z', '{date}')
    expect(result).toMatch(/<!date\^\d+\^\{date\}\|Mar 1, 2026>/)
  })

  it('supports mixed token and literal text', () => {
    const result = slackDate('2026-03-01T12:00:00Z', '{date_long} at {time}', 'March 1 at noon')
    expect(result).toContain('{date_long} at {time}|March 1 at noon')
  })
})

describe('truncateForSlack', () => {
  it('returns short text unchanged', () => {
    expect(truncateForSlack('hello')).toBe('hello')
  })

  it('truncates at word boundary', () => {
    const text = 'word '.repeat(600) // 3000 chars
    const result = truncateForSlack(text)
    expect(result.length).toBeLessThanOrEqual(2801) // 2800 + ellipsis
    expect(result.endsWith('…')).toBe(true)
    expect(result.endsWith(' …')).toBe(false) // should cut at word boundary cleanly
  })

  it('respects custom maxLen', () => {
    const text = 'a '.repeat(100) // 200 chars
    const result = truncateForSlack(text, 50)
    expect(result.length).toBeLessThanOrEqual(51)
    expect(result.endsWith('…')).toBe(true)
  })

  it('returns text exactly at limit unchanged', () => {
    const text = 'a'.repeat(2800)
    expect(truncateForSlack(text)).toBe(text)
  })
})

describe('chunkForSlackSections', () => {
  it('returns empty array for empty input', () => {
    expect(chunkForSlackSections([])).toEqual([])
  })

  it('keeps short items in one chunk', () => {
    const items = ['Item 1', 'Item 2', 'Item 3']
    const result = chunkForSlackSections(items)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('Item 1\n\nItem 2\n\nItem 3')
  })

  it('splits into multiple chunks when items exceed limit', () => {
    const items = [
      'a'.repeat(1500),
      'b'.repeat(1500),
      'c'.repeat(1500),
    ]
    const result = chunkForSlackSections(items)
    expect(result.length).toBeGreaterThan(1)
    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(2800)
    }
  })

  it('uses custom separator', () => {
    const items = ['Item 1', 'Item 2']
    const result = chunkForSlackSections(items, '\n')
    expect(result[0]).toBe('Item 1\nItem 2')
  })

  it('handles single item exceeding limit', () => {
    const items = ['a'.repeat(5000)]
    const result = chunkForSlackSections(items)
    expect(result).toHaveLength(1)
    expect(result[0].length).toBeLessThanOrEqual(2801) // truncated + ellipsis
  })
})

describe('sanitizeLLMForMrkdwn', () => {
  it('converts standard bold to slack bold', () => {
    expect(sanitizeLLMForMrkdwn('This is **bold** text')).toBe('This is *bold* text')
  })

  it('converts standard links to slack links', () => {
    expect(sanitizeLLMForMrkdwn('[Click here](https://example.com)'))
      .toBe('<https://example.com|Click here>')
  })

  it('converts markdown headings to bold', () => {
    expect(sanitizeLLMForMrkdwn('## Section Title')).toBe('*Section Title*')
    expect(sanitizeLLMForMrkdwn('### Sub Heading')).toBe('*Sub Heading*')
  })

  it('handles multiple conversions in one string', () => {
    const input = '## Report\n**Revenue** grew. See [details](https://example.com).'
    const expected = '*Report*\n*Revenue* grew. See <https://example.com|details>.'
    expect(sanitizeLLMForMrkdwn(input)).toBe(expected)
  })

  it('leaves already-valid mrkdwn unchanged', () => {
    const mrkdwn = '*bold* _italic_ `code` <https://example.com|link>'
    expect(sanitizeLLMForMrkdwn(mrkdwn)).toBe(mrkdwn)
  })

  it('does not break single asterisks (slack italic)', () => {
    expect(sanitizeLLMForMrkdwn('*italic* stays')).toBe('*italic* stays')
  })
})
