import { anthropic } from './claude'
import type { TranscriptChunkInsert } from '@/types/database'

// =============================================
// Chunking Configuration
// =============================================

const CHUNK_SIZE = 1500 // Target characters per chunk
const CHUNK_OVERLAP = 200 // Overlap between chunks for context

// =============================================
// Chunking Functions
// =============================================

/**
 * Split transcript text into overlapping chunks for processing and embedding
 */
export function chunkTranscript(
  text: string,
  transcriptId: string
): TranscriptChunkInsert[] {
  const chunks: TranscriptChunkInsert[] = []

  // Normalize line endings
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Split into paragraphs first
  const paragraphs = normalizedText.split(/\n\n+/).filter((p) => p.trim())

  let currentChunk = ''
  let chunkIndex = 0
  let currentSpeaker: string | null = null

  for (const paragraph of paragraphs) {
    // Try to detect speaker attribution (e.g., "John:", "SPEAKER 1:", "[Rich]")
    const speakerMatch = paragraph.match(
      /^(?:\[([^\]]+)\]|([A-Za-z\s]+):|SPEAKER\s*(\d+):)/i
    )
    if (speakerMatch) {
      currentSpeaker =
        speakerMatch[1] || speakerMatch[2] || `Speaker ${speakerMatch[3]}`
    }

    // If adding this paragraph would exceed chunk size, save current chunk
    if (currentChunk && currentChunk.length + paragraph.length > CHUNK_SIZE) {
      chunks.push({
        transcript_id: transcriptId,
        content: currentChunk.trim(),
        speaker: currentSpeaker,
        chunk_index: chunkIndex,
      })
      chunkIndex++

      // Start new chunk with overlap from previous chunk
      const overlapStart = Math.max(0, currentChunk.length - CHUNK_OVERLAP)
      currentChunk = currentChunk.slice(overlapStart) + '\n\n' + paragraph
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph
    }
  }

  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push({
      transcript_id: transcriptId,
      content: currentChunk.trim(),
      speaker: currentSpeaker,
      chunk_index: chunkIndex,
    })
  }

  return chunks
}

// =============================================
// AI Extraction Types
// =============================================

export interface ExtractedItem {
  type: 'issue' | 'todo' | 'decision' | 'action'
  title: string
  description?: string
  owner?: string
  priority?: number
  due_date?: string
  context: string // Relevant quote from transcript
}

export interface ExtractionResult {
  issues: ExtractedItem[]
  todos: ExtractedItem[]
  decisions: ExtractedItem[]
  summary: string
}

// =============================================
// AI Extraction Functions
// =============================================

const EXTRACTION_SYSTEM_PROMPT = `You are an EOS (Entrepreneurial Operating System) meeting analyst. Your job is to analyze meeting transcripts and extract:

1. **Issues** - Problems, concerns, or topics that need discussion using the IDS (Identify, Discuss, Solve) process
2. **To-dos** - Action items with clear owners and implied deadlines (EOS standard is 7 days)
3. **Decisions** - Important decisions made during the meeting

Be specific and actionable. Use exact quotes when helpful. Attribute items to speakers when mentioned.

Format your output as valid JSON only.`

/**
 * Extract EOS items from a transcript chunk using AI
 */
export async function extractFromChunk(
  content: string,
  context: string = ''
): Promise<ExtractionResult> {
  const userPrompt = `Analyze this meeting transcript excerpt and extract any Issues, To-dos, and Decisions.

${context ? `Context from earlier in the meeting:\n${context}\n\n` : ''}Transcript:
"""
${content}
"""

Return a JSON object with this structure:
{
  "issues": [
    {
      "type": "issue",
      "title": "Brief issue title",
      "description": "More detail if needed",
      "owner": "Person's name if mentioned",
      "priority": 1-3 (1=high, 3=low),
      "context": "Brief quote from transcript"
    }
  ],
  "todos": [
    {
      "type": "todo",
      "title": "Action item title",
      "owner": "Person's name if mentioned",
      "due_date": "Date if mentioned, otherwise null",
      "context": "Brief quote from transcript"
    }
  ],
  "decisions": [
    {
      "type": "decision",
      "title": "Decision summary",
      "context": "Brief quote from transcript"
    }
  ],
  "summary": "One sentence summary of this excerpt"
}

If no items are found for a category, return an empty array. Only output valid JSON.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const textContent = message.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return emptyResult()
    }

    // Parse JSON response - strip markdown code blocks if present
    let jsonText = textContent.text.trim()
    if (jsonText.startsWith('```')) {
      const firstNewline = jsonText.indexOf('\n')
      if (firstNewline !== -1) {
        jsonText = jsonText.slice(firstNewline + 1)
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.slice(0, -3)
      }
      jsonText = jsonText.trim()
    }

    const parsed = JSON.parse(jsonText)
    return {
      issues: parsed.issues || [],
      todos: parsed.todos || [],
      decisions: parsed.decisions || [],
      summary: parsed.summary || '',
    }
  } catch (error) {
    console.error('Error extracting from chunk:', error)
    return emptyResult()
  }
}

function emptyResult(): ExtractionResult {
  return {
    issues: [],
    todos: [],
    decisions: [],
    summary: '',
  }
}

/**
 * Generate a summary of the entire transcript
 */
export async function generateTranscriptSummary(
  fullText: string
): Promise<string> {
  // Truncate if too long
  const maxLength = 8000
  const text =
    fullText.length > maxLength
      ? fullText.slice(0, maxLength) + '\n\n[Transcript truncated...]'
      : fullText

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system:
        'You are an executive assistant creating brief meeting summaries. Be concise and focus on key outcomes.',
      messages: [
        {
          role: 'user',
          content: `Summarize this meeting transcript in 2-3 sentences, focusing on main topics discussed and any decisions made:\n\n${text}`,
        },
      ],
    })

    const textContent = message.content.find((c) => c.type === 'text')
    return textContent?.type === 'text' ? textContent.text : ''
  } catch (error) {
    console.error('Error generating summary:', error)
    return ''
  }
}

/**
 * Merge extraction results from multiple chunks
 */
export function mergeExtractionResults(
  results: ExtractionResult[]
): ExtractionResult {
  const issues: ExtractedItem[] = []
  const todos: ExtractedItem[] = []
  const decisions: ExtractedItem[] = []
  const summaries: string[] = []

  for (const result of results) {
    issues.push(...result.issues)
    todos.push(...result.todos)
    decisions.push(...result.decisions)
    if (result.summary) {
      summaries.push(result.summary)
    }
  }

  // Deduplicate by title (simple approach)
  const dedupeByTitle = <T extends { title: string }>(items: T[]): T[] => {
    const seen = new Set<string>()
    return items.filter((item) => {
      const key = item.title.toLowerCase().trim()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  return {
    issues: dedupeByTitle(issues),
    todos: dedupeByTitle(todos),
    decisions: dedupeByTitle(decisions),
    summary: summaries.join(' '),
  }
}
