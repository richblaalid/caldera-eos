/** Check if a title is similar to any existing titles (word overlap). */
export function isSimilarTitle(title: string, existingTitles: string[]): boolean {
  const normalized = title.toLowerCase().trim()

  for (const existing of existingTitles) {
    // Exact match
    if (normalized === existing) return true

    // Check if one contains the other (handles variations like "Sales Calls" vs "Weekly Sales Calls")
    if (normalized.includes(existing) || existing.includes(normalized)) return true

    // Check word overlap (if 2+ significant words match)
    const newWords = normalized.split(/\s+/).filter(w => w.length > 2)
    const existingWords = existing.split(/\s+/).filter(w => w.length > 2)
    const commonWords = newWords.filter(w => existingWords.includes(w))
    if (commonWords.length >= 2) return true
  }

  return false
}
