import type { ExtractionResult, ExtractedItem, ExtractedMetric } from '@/lib/transcripts'

/**
 * Parse Grain AI-generated meeting notes into Ember's extraction format.
 *
 * Grain notes follow a consistent markdown structure:
 * - ## Section Headers (topics/themes)
 * - Bullet points with key information
 * - Nested sub-bullets for details
 * - **Bold names** for people mentions
 * - Action items in "Name will..." or "Name to..." patterns
 * - Dollar amounts like $10K, $600K, $50,000
 *
 * This is deterministic parsing — no LLM needed.
 */
export function parseGrainNotes(markdown: string): ExtractionResult {
  const sections = parseSections(markdown)
  const todos = extractTodos(markdown)
  const issues = extractIssues(sections)
  const decisions = extractDecisions(sections)
  const metrics = extractMetrics(markdown)
  const summary = generateSummary(sections)

  return { issues, todos, decisions, metrics, summary }
}

// =============================================
// Section Parsing
// =============================================

interface NoteSection {
  title: string
  bullets: string[]
}

function parseSections(markdown: string): NoteSection[] {
  const sections: NoteSection[] = []
  let currentSection: NoteSection | null = null

  for (const line of markdown.split('\n')) {
    const headerMatch = line.match(/^##\s+(.+)/)
    if (headerMatch) {
      if (currentSection) sections.push(currentSection)
      currentSection = { title: headerMatch[1].trim(), bullets: [] }
      continue
    }

    // Top-level bullets (not deeply nested)
    const bulletMatch = line.match(/^[-*]\s+(.+)/)
    if (bulletMatch && currentSection) {
      currentSection.bullets.push(bulletMatch[1].trim())
    }
  }

  if (currentSection) sections.push(currentSection)
  return sections
}

// =============================================
// Todo/Action Item Extraction
// =============================================

/**
 * Extract action items from Grain notes.
 *
 * Patterns detected:
 * - "**Name** will do something"
 * - "**Name** to do something"
 * - "Name will do something"
 * - "- [ ] Name will do something" (checkbox format)
 * - Lines in "Action Items" sections
 */
function extractTodos(markdown: string): ExtractedItem[] {
  const todos: ExtractedItem[] = []
  const seen = new Set<string>()

  // Pattern 1: "**Name** will/to do something" or "Name will/to do something"
  const actionPatterns = [
    /\*\*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\*\*\s+(?:will|to|should|needs to|is going to)\s+(.+)/g,
    /(?:^|\n)\s*[-*]\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:will|to|should|needs to|is going to)\s+(.+)/g,
  ]

  for (const pattern of actionPatterns) {
    for (const match of markdown.matchAll(pattern)) {
      const owner = match[1].trim()
      const task = cleanBulletText(match[2])
      const key = `${owner.toLowerCase()}:${task.toLowerCase().slice(0, 50)}`
      if (!seen.has(key) && task.length > 5) {
        seen.add(key)
        todos.push({
          type: 'todo',
          title: task,
          context: match[0].trim(),
          owner,
          priority: 3,
        })
      }
    }
  }

  // Pattern 2: Checkbox items "- [ ] task"
  const checkboxPattern = /^\s*[-*]\s*\[[ x]\]\s*(?:\*\*([^*]+)\*\*\s*)?(.+)/gm
  for (const match of markdown.matchAll(checkboxPattern)) {
    const owner = match[1]?.trim()
    const task = cleanBulletText(match[2])
    const key = `${(owner || 'unassigned').toLowerCase()}:${task.toLowerCase().slice(0, 50)}`
    if (!seen.has(key) && task.length > 5) {
      seen.add(key)
      todos.push({
        type: 'todo',
        title: task,
        context: match[0].trim(),
        owner: owner || undefined,
        priority: 3,
      })
    }
  }

  // Pattern 3: Items under "Action Items" or "Next Steps" sections
  const actionSection = extractSectionContent(markdown, /action items|next steps|follow[- ]?ups/i)
  if (actionSection) {
    const bulletPattern = /^\s*[-*]\s+(.+)/gm
    for (const match of actionSection.matchAll(bulletPattern)) {
      const text = cleanBulletText(match[1])
      // Try to extract owner from "Owner: task" or "Owner - task" format
      const ownerMatch = text.match(/^(?:\*\*)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:\*\*)?\s*[:–—-]\s*(.+)/)
      const owner = ownerMatch ? ownerMatch[1].trim() : undefined
      const task = ownerMatch ? ownerMatch[2].trim() : text
      const key = `${(owner || 'unassigned').toLowerCase()}:${task.toLowerCase().slice(0, 50)}`
      if (!seen.has(key) && task.length > 5) {
        seen.add(key)
        todos.push({
          type: 'todo',
          title: task,
          context: match[0].trim(),
          owner,
          priority: 2,
        })
      }
    }
  }

  return todos
}

// =============================================
// Issue Extraction
// =============================================

/**
 * Extract issues/concerns from Grain notes.
 *
 * Patterns: risk mentions, concern keywords, challenge keywords,
 * problem indicators, and items from "Issues" or "Challenges" sections.
 */
function extractIssues(sections: NoteSection[]): ExtractedItem[] {
  const issues: ExtractedItem[] = []
  const seen = new Set<string>()
  const issueKeywords = /\b(?:concern|risk|challenge|problem|issue|blocker|gap|obstacle|worry|bottleneck|delay|unclear|missing)\b/i

  for (const section of sections) {
    // Check if this is an issues/challenges section
    const isIssueSection = /issues?|challenges?|concerns?|risks?|blockers?|problems?/i.test(section.title)

    for (const bullet of section.bullets) {
      const isIssue = isIssueSection || issueKeywords.test(bullet)
      if (isIssue) {
        const title = cleanBulletText(bullet).slice(0, 200)
        const key = title.toLowerCase().slice(0, 50)
        if (!seen.has(key) && title.length > 10) {
          seen.add(key)
          issues.push({
            type: 'issue',
            title,
            context: bullet,
            description: `From section: ${section.title}`,
            priority: isIssueSection ? 2 : 3,
          })
        }
      }
    }
  }

  return issues
}

// =============================================
// Decision Extraction
// =============================================

/**
 * Extract decisions from Grain notes.
 *
 * Patterns: "decided to", "agreed to", "will proceed with",
 * items in "Decisions" sections.
 */
function extractDecisions(sections: NoteSection[]): ExtractedItem[] {
  const decisions: ExtractedItem[] = []
  const seen = new Set<string>()
  const decisionKeywords = /\b(?:decided|agreed|approved|confirmed|will proceed|moving forward with|chosen|selected|going with)\b/i

  for (const section of sections) {
    const isDecisionSection = /decisions?|agreements?|resolutions?/i.test(section.title)

    for (const bullet of section.bullets) {
      const isDecision = isDecisionSection || decisionKeywords.test(bullet)
      if (isDecision) {
        const title = cleanBulletText(bullet).slice(0, 200)
        const key = title.toLowerCase().slice(0, 50)
        if (!seen.has(key) && title.length > 10) {
          seen.add(key)
          decisions.push({
            type: 'decision',
            title,
            context: bullet,
            description: `From section: ${section.title}`,
          })
        }
      }
    }
  }

  return decisions
}

// =============================================
// Metric Extraction
// =============================================

/**
 * Extract potential scorecard metrics from Grain notes.
 *
 * Detects dollar amounts, percentages, and numeric targets.
 */
function extractMetrics(markdown: string): ExtractedMetric[] {
  const metrics: ExtractedMetric[] = []
  const seen = new Set<string>()

  // Dollar amounts: $10K, $600K, $50,000, $1.2M
  const dollarPattern = /(\$[\d,.]+[KkMmBb]?)\s*(?:[-–—]\s*)?([^.\n]{5,80})/g
  for (const match of markdown.matchAll(dollarPattern)) {
    const value = match[1]
    const surrounding = cleanBulletText(match[2]).slice(0, 100)
    const key = `${value}:${surrounding.slice(0, 30)}`
    if (!seen.has(key)) {
      seen.add(key)
      metrics.push({
        type: 'metric',
        name: surrounding || `Financial target: ${value}`,
        context: match[0].trim(),
        suggested_target: value,
      })
    }
  }

  // Percentages: 80%, 30%
  const percentPattern = /(\d+%)\s*(?:[-–—]\s*)?([^.\n]{5,80})/g
  for (const match of markdown.matchAll(percentPattern)) {
    const value = match[1]
    const surrounding = cleanBulletText(match[2]).slice(0, 100)
    const key = `${value}:${surrounding.slice(0, 30)}`
    if (!seen.has(key)) {
      seen.add(key)
      metrics.push({
        type: 'metric',
        name: surrounding || `Target: ${value}`,
        context: match[0].trim(),
        suggested_target: value,
      })
    }
  }

  return metrics
}

// =============================================
// Summary Generation
// =============================================

function generateSummary(sections: NoteSection[]): string {
  if (sections.length === 0) return ''

  // Use section titles as the summary backbone
  const topicSummary = sections
    .map(s => s.title)
    .join(', ')

  const keyPoints = sections
    .flatMap(s => s.bullets.slice(0, 2)) // First 2 bullets from each section
    .slice(0, 6) // Max 6 key points
    .map(b => `- ${b.slice(0, 150)}`)
    .join('\n')

  return `Topics discussed: ${topicSummary}\n\nKey points:\n${keyPoints}`
}

// =============================================
// Utilities
// =============================================

function cleanBulletText(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold markers
    .replace(/`([^`]+)`/g, '$1') // Remove code markers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
    .replace(/^\s*[-*]\s*/, '') // Remove leading bullet
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
}

function extractSectionContent(markdown: string, titlePattern: RegExp): string | null {
  const lines = markdown.split('\n')
  let capturing = false
  const content: string[] = []

  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+)/)
    if (headerMatch) {
      if (capturing) break // Next section reached
      if (titlePattern.test(headerMatch[1])) {
        capturing = true
        continue
      }
    }
    if (capturing) {
      content.push(line)
    }
  }

  return content.length > 0 ? content.join('\n') : null
}
