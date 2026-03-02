import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { ParsedCommand } from '@/types/agents'

const parsedCommandSchema = z.object({
  command_type: z.enum(['approve', 'reject', 'defer', 'status_query', 'freeform']).catch('freeform'),
  item_numbers: z.array(z.number()).catch([]),
  parameters: z.record(z.string(), z.string()).catch({} as Record<string, string>),
})

const anthropic = new Anthropic()

interface CommandContext {
  briefingId?: string
  threadTs?: string
}

/**
 * Parse a user's Slack message into a structured command.
 * Uses Haiku for fast classification, with regex fallback for simple patterns.
 */
export async function parseCommand(
  text: string,
  context: CommandContext
): Promise<ParsedCommand> {
  const trimmed = text.trim()

  // Try fast regex matching first for common patterns
  const regexResult = tryRegexParse(trimmed)
  if (regexResult) return regexResult

  // Fall back to AI classification for natural language
  return classifyWithAI(trimmed, context)
}

/**
 * Fast regex-based parsing for common command patterns.
 */
function tryRegexParse(text: string): ParsedCommand | null {
  const lower = text.toLowerCase()

  // "approve 3" or "approve 1, 3, 5"
  const approveMatch = lower.match(/^approve\s+([\d,\s]+)$/i)
  if (approveMatch) {
    return {
      command_type: 'approve',
      item_numbers: parseNumbers(approveMatch[1]),
      parameters: {},
      raw_text: text,
    }
  }

  // "reject 3" or "reject 3 — reason" or "reject 3 - reason"
  const rejectMatch = lower.match(/^reject\s+([\d,\s]+?)(?:\s*[—-]\s*(.+))?$/i)
  if (rejectMatch) {
    const params: Record<string, string> = {}
    if (rejectMatch[2]) params.reason = rejectMatch[2].trim()
    return {
      command_type: 'reject',
      item_numbers: parseNumbers(rejectMatch[1]),
      parameters: params,
      raw_text: text,
    }
  }

  // "defer 3" or "defer 3 to Wednesday"
  const deferMatch = lower.match(/^defer\s+([\d,\s]+?)(?:\s+to\s+(.+))?$/i)
  if (deferMatch) {
    const params: Record<string, string> = {}
    if (deferMatch[2]) params.defer_to = deferMatch[2].trim()
    return {
      command_type: 'defer',
      item_numbers: parseNumbers(deferMatch[1]),
      parameters: params,
      raw_text: text,
    }
  }

  // Combined: "approve 3, defer 4 to Wednesday"
  const combinedMatch = lower.match(/^(approve|reject|defer)\s+.*,\s*(approve|reject|defer)\s+/i)
  if (combinedMatch) {
    // Don't handle combined commands via regex — let AI parse them
    return null
  }

  // "status of X" or "what's the status of X"
  const statusMatch = text.match(/(?:what'?s?\s+(?:the\s+)?)?status\s+(?:of\s+)?(.+)/i)
  if (statusMatch) {
    return {
      command_type: 'status_query',
      item_numbers: [],
      parameters: { topic: statusMatch[1].trim() },
      raw_text: text,
    }
  }

  return null
}

function parseNumbers(str: string): number[] {
  return str
    .split(/[,\s]+/)
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n))
}

/**
 * Use Haiku for AI-powered command classification.
 */
async function classifyWithAI(
  text: string,
  context: CommandContext
): Promise<ParsedCommand> {
  try {
    const response = await anthropic.messages.create({
      model: process.env.AGENT_FAST_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Classify this Slack message as a command. Respond ONLY with valid JSON.

Message: "${text}"
${context.briefingId ? `Context: This is a reply to a morning briefing (ID: ${context.briefingId})` : ''}

JSON format:
{
  "command_type": "approve" | "reject" | "defer" | "status_query" | "freeform",
  "item_numbers": [numbers referenced, empty array if none],
  "parameters": {
    "reason": "rejection reason if given",
    "defer_to": "day/date if given",
    "topic": "query topic if status_query",
    "question": "the user's question if freeform"
  }
}

Rules:
- "approve 3, defer 4 to Wednesday" → two separate commands are NOT supported, classify as freeform
- Questions about business, EOS, meetings → status_query with topic
- General conversation or complex requests → freeform with question
- Only classify as approve/reject/defer if the intent is clearly about briefing items`,
      }],
    })

    const responseText = response.content[0].type === 'text' ? response.content[0].text : ''
    const json: unknown = JSON.parse(responseText)
    const result = parsedCommandSchema.safeParse(json)

    if (!result.success) {
      return { command_type: 'freeform', item_numbers: [], parameters: { question: text }, raw_text: text }
    }

    return {
      command_type: result.data.command_type,
      item_numbers: result.data.item_numbers,
      parameters: Object.keys(result.data.parameters).length > 0 ? result.data.parameters : { question: text },
      raw_text: text,
    }
  } catch {
    // Default to freeform if AI fails
    return {
      command_type: 'freeform',
      item_numbers: [],
      parameters: { question: text },
      raw_text: text,
    }
  }
}
