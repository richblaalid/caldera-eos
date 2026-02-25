/**
 * Parse issue suggestion data from insight content.
 * Client-safe utility (no server imports).
 */
export function parseIssueSuggestion(content: string): {
  title: string
  description?: string
  owner?: string
  priority?: number
  context: string
} | null {
  try {
    const data = JSON.parse(content)
    return {
      title: data.title || '',
      description: data.description,
      owner: data.owner,
      priority: data.priority,
      context: data.context || '',
    }
  } catch {
    return null
  }
}
