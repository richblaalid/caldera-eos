/**
 * Parse todo suggestion data from insight content.
 * Client-safe utility (no server imports).
 */
export function parseTodoSuggestion(content: string): {
  title: string
  description?: string
  owner?: string
  due_date?: string
  priority?: number
  confidence?: number
  context: string
} | null {
  try {
    const data = JSON.parse(content)
    return {
      title: data.title || '',
      description: data.description,
      owner: data.owner,
      due_date: data.due_date,
      priority: data.priority,
      confidence: data.confidence,
      context: data.context || '',
    }
  } catch {
    return null
  }
}
