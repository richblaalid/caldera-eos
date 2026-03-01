/**
 * Slack formatting utilities for mrkdwn safety, date tokens, and text limits.
 *
 * Reference: .claude/skills/slack-mrkdwn/SKILL.md
 * Reference: .agents/skills/slack-block-kit/SKILL.md
 */

/**
 * Escape user-generated text for safe interpolation into Slack mrkdwn.
 * Only three characters are control characters in Slack's markup system.
 */
export function escapeSlackMrkdwn(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Generate a Slack `<!date^>` token that renders in the reader's local timezone.
 *
 * @param date - Date object, ISO string, or unix timestamp (seconds)
 * @param format - Token string using Slack date tokens, e.g. `"{date_long} at {time}"`
 * @param fallback - Plain text shown for clients that don't support date formatting
 * @returns Slack date token string like `<!date^1234567890^{date_long}|Feb 18, 2024>`
 *
 * Supported tokens: {date_num}, {date}, {date_short}, {date_long},
 * {date_pretty}, {date_short_pretty}, {date_long_pretty},
 * {time}, {time_secs}, {ago}
 */
export function slackDate(
  date: Date | string | number,
  format: string,
  fallback?: string
): string {
  let unix: number

  if (typeof date === 'number') {
    // If > 1e12, assume milliseconds
    unix = date > 1e12 ? Math.floor(date / 1000) : date
  } else {
    const d = typeof date === 'string' ? new Date(date) : date
    unix = Math.floor(d.getTime() / 1000)
  }

  const fb = fallback || new Date(unix * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return `<!date^${unix}^${format}|${fb}>`
}

/**
 * Truncate text to stay within Slack's section block limit (3000 chars).
 * Truncates at word boundaries and appends `…` if truncated.
 *
 * @param text - Text to truncate
 * @param maxLen - Maximum character length (default 2800, leaving buffer under 3000)
 */
export function truncateForSlack(text: string, maxLen: number = 2800): string {
  if (text.length <= maxLen) return text

  // Find the last space before the limit
  const truncated = text.slice(0, maxLen)
  const lastSpace = truncated.lastIndexOf(' ')
  const cutPoint = lastSpace > maxLen * 0.8 ? lastSpace : maxLen

  return truncated.slice(0, cutPoint) + '…'
}

/**
 * Chunk a list of text items into groups that fit within a section block limit.
 * Each group's joined text will be under maxLen.
 *
 * @param items - Array of text strings to chunk
 * @param separator - Join separator between items (default `"\n\n"`)
 * @param maxLen - Max chars per chunk (default 2800)
 * @returns Array of joined text strings, each under maxLen
 */
export function chunkForSlackSections(
  items: string[],
  separator: string = '\n\n',
  maxLen: number = 2800
): string[] {
  if (items.length === 0) return []

  const chunks: string[] = []
  let current: string[] = []
  let currentLen = 0

  for (const item of items) {
    const itemLen = item.length
    const sepLen = current.length > 0 ? separator.length : 0

    if (currentLen + sepLen + itemLen > maxLen && current.length > 0) {
      chunks.push(current.join(separator))
      current = [truncateForSlack(item, maxLen)]
      currentLen = Math.min(truncateForSlack(item, maxLen).length, maxLen)
    } else if (current.length === 0 && itemLen > maxLen) {
      current.push(truncateForSlack(item, maxLen))
      currentLen = truncateForSlack(item, maxLen).length
    } else {
      current.push(item)
      currentLen += sepLen + itemLen
    }
  }

  if (current.length > 0) {
    chunks.push(current.join(separator))
  }

  return chunks
}

/**
 * Sanitize LLM output that may contain standard Markdown into Slack mrkdwn.
 * Converts common patterns:
 *   **bold** → *bold*
 *   [text](url) → <url|text>
 *   ## heading → *heading*
 *
 * Does NOT escape &<> — call escapeSlackMrkdwn() first if content is user-generated.
 */
export function sanitizeLLMForMrkdwn(text: string): string {
  return text
    // Standard Markdown bold **text** → Slack bold *text*
    // Must run before italic conversion to avoid conflicts
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    // Standard Markdown links [text](url) → Slack links <url|text>
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>')
    // Markdown headings ## text → bold *text*
    .replace(/^#{1,6}\s+(.+)$/gm, '*$1*')
}
