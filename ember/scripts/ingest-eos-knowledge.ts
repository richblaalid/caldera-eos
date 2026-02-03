/**
 * EOS Knowledge Ingestion Script
 * Processes EOS chapter files and stores them as vectorized chunks for RAG
 *
 * Run with: npx tsx scripts/ingest-eos-knowledge.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { generateEmbeddings } from '../src/lib/embeddings'

// =============================================
// Configuration
// =============================================

const CHAPTERS_DIR = path.resolve(__dirname, '../../.claude/skills/eos-domain-skill/chapters')
const CHUNK_SIZE = 1200 // Target characters per chunk
const CHUNK_OVERLAP = 150 // Overlap between chunks
const BATCH_SIZE = 20 // Embeddings to generate at once

// Chapter title mapping (file name -> readable title)
const CHAPTER_TITLES: Record<string, string> = {
  '00-introduction.md': 'Introduction',
  '01-entrepreneurial-operating-system.md': 'The Entrepreneurial Operating System',
  '02-letting-go-of-the-vine.md': 'Letting Go of the Vine',
  '03-the-vision-component.md': 'The Vision Component',
  '04-the-people-component.md': 'The People Component',
  '05-the-data-component.md': 'The Data Component',
  '06-the-issues-component.md': 'The Issues Component',
  '07-the-process-component.md': 'The Process Component',
  '08-the-traction-component.md': 'The Traction Component',
  '09-pulling-it-all-together.md': 'Pulling It All Together',
  '10-getting-started.md': 'Getting Started',
}

// =============================================
// Types
// =============================================

interface Section {
  heading: string
  content: string
}

interface Chunk {
  sourceFile: string
  chapterTitle: string
  sectionHeading: string
  content: string
  chunkIndex: number
}

// =============================================
// Supabase Client
// =============================================

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(url, key)
}

// =============================================
// Markdown Parsing
// =============================================

/**
 * Parse markdown file into sections by heading
 */
function parseMarkdownSections(content: string): Section[] {
  const sections: Section[] = []
  const lines = content.split('\n')

  let currentHeading = ''
  let currentContent: string[] = []

  for (const line of lines) {
    // Check for heading (# or ##)
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)

    if (headingMatch) {
      // Save previous section if it has content
      if (currentContent.length > 0) {
        const sectionContent = currentContent.join('\n').trim()
        if (sectionContent.length > 50) {
          // Only keep sections with meaningful content
          sections.push({
            heading: currentHeading || 'Introduction',
            content: sectionContent,
          })
        }
      }

      currentHeading = headingMatch[2].trim()
      currentContent = []
    } else {
      currentContent.push(line)
    }
  }

  // Don't forget the last section
  if (currentContent.length > 0) {
    const sectionContent = currentContent.join('\n').trim()
    if (sectionContent.length > 50) {
      sections.push({
        heading: currentHeading || 'Conclusion',
        content: sectionContent,
      })
    }
  }

  return sections
}

/**
 * Split a section into overlapping chunks
 */
function chunkSection(
  section: Section,
  sourceFile: string,
  chapterTitle: string,
  startIndex: number
): Chunk[] {
  const chunks: Chunk[] = []
  const content = section.content

  // If content is small enough, return as single chunk
  if (content.length <= CHUNK_SIZE) {
    chunks.push({
      sourceFile,
      chapterTitle,
      sectionHeading: section.heading,
      content: content,
      chunkIndex: startIndex,
    })
    return chunks
  }

  // Split into sentences for cleaner chunking
  const sentences = content.split(/(?<=[.!?])\s+/)
  let currentChunk = ''
  let chunkIndex = startIndex

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > CHUNK_SIZE && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        sourceFile,
        chapterTitle,
        sectionHeading: section.heading,
        content: currentChunk.trim(),
        chunkIndex,
      })
      chunkIndex++

      // Start new chunk with overlap
      const words = currentChunk.split(' ')
      const overlapWords = words.slice(-Math.floor(CHUNK_OVERLAP / 5))
      currentChunk = overlapWords.join(' ') + ' ' + sentence
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 50) {
    chunks.push({
      sourceFile,
      chapterTitle,
      sectionHeading: section.heading,
      content: currentChunk.trim(),
      chunkIndex,
    })
  }

  return chunks
}

/**
 * Process a single chapter file
 */
function processChapter(filePath: string): Chunk[] {
  const fileName = path.basename(filePath)
  const chapterTitle = CHAPTER_TITLES[fileName] || fileName.replace('.md', '')

  console.log(`  Processing: ${fileName} (${chapterTitle})`)

  const content = fs.readFileSync(filePath, 'utf-8')
  const sections = parseMarkdownSections(content)

  console.log(`    Found ${sections.length} sections`)

  const chunks: Chunk[] = []
  let chunkIndex = 0

  for (const section of sections) {
    const sectionChunks = chunkSection(section, fileName, chapterTitle, chunkIndex)
    chunks.push(...sectionChunks)
    chunkIndex += sectionChunks.length
  }

  console.log(`    Created ${chunks.length} chunks`)
  return chunks
}

// =============================================
// Database Operations
// =============================================

/**
 * Clear existing knowledge chunks (for re-ingestion)
 */
async function clearExistingChunks(supabase: ReturnType<typeof createClient>) {
  console.log('Clearing existing knowledge chunks...')
  const { error } = await supabase.from('eos_knowledge_chunks').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  if (error) {
    console.warn('Warning: Could not clear chunks (table may not exist yet):', error.message)
  } else {
    console.log('Cleared existing chunks')
  }
}

/**
 * Insert chunks with embeddings into database
 */
async function insertChunks(
  supabase: ReturnType<typeof createClient>,
  chunks: Chunk[],
  embeddings: number[][]
) {
  const records = chunks.map((chunk, i) => ({
    source_file: chunk.sourceFile,
    chapter_title: chunk.chapterTitle,
    section_heading: chunk.sectionHeading,
    content: chunk.content,
    chunk_index: chunk.chunkIndex,
    embedding: embeddings[i],
    metadata: {},
  }))

  const { error } = await supabase.from('eos_knowledge_chunks').insert(records)

  if (error) {
    throw new Error(`Failed to insert chunks: ${error.message}`)
  }
}

// =============================================
// Main Ingestion Process
// =============================================

async function main() {
  console.log('='.repeat(60))
  console.log('EOS Knowledge Ingestion')
  console.log('='.repeat(60))

  // Check chapters directory exists
  if (!fs.existsSync(CHAPTERS_DIR)) {
    throw new Error(`Chapters directory not found: ${CHAPTERS_DIR}`)
  }

  // Get all chapter files
  const files = fs.readdirSync(CHAPTERS_DIR).filter((f) => f.endsWith('.md')).sort()

  console.log(`\nFound ${files.length} chapter files in:`)
  console.log(`  ${CHAPTERS_DIR}\n`)

  // Process all chapters
  console.log('Step 1: Parsing chapters into chunks...')
  const allChunks: Chunk[] = []

  for (const file of files) {
    const filePath = path.join(CHAPTERS_DIR, file)
    const chunks = processChapter(filePath)
    allChunks.push(...chunks)
  }

  console.log(`\nTotal chunks created: ${allChunks.length}`)

  // Generate embeddings in batches
  console.log('\nStep 2: Generating embeddings...')
  const allEmbeddings: number[][] = []

  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE)
    const texts = batch.map((c) => `${c.chapterTitle} - ${c.sectionHeading}\n\n${c.content}`)

    console.log(`  Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allChunks.length / BATCH_SIZE)} (${batch.length} chunks)...`)

    const embeddings = await generateEmbeddings(texts)
    allEmbeddings.push(...embeddings)
  }

  console.log(`\nGenerated ${allEmbeddings.length} embeddings`)

  // Store in database
  console.log('\nStep 3: Storing in database...')
  const supabase = getSupabaseClient()

  await clearExistingChunks(supabase)

  // Insert in batches
  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const chunkBatch = allChunks.slice(i, i + BATCH_SIZE)
    const embeddingBatch = allEmbeddings.slice(i, i + BATCH_SIZE)

    console.log(`  Inserting batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allChunks.length / BATCH_SIZE)}...`)

    await insertChunks(supabase, chunkBatch, embeddingBatch)
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('Ingestion Complete!')
  console.log('='.repeat(60))
  console.log(`  Chapters processed: ${files.length}`)
  console.log(`  Total chunks: ${allChunks.length}`)
  console.log(`  Embeddings generated: ${allEmbeddings.length}`)
  console.log('='.repeat(60))
}

// Run
main().catch((error) => {
  console.error('\nIngestion failed:', error)
  process.exit(1)
})
