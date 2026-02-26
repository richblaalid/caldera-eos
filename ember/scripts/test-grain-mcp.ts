/**
 * POC: Test Grain MCP server via Anthropic MCP Connector API
 *
 * This script verifies we can call Grain's MCP tools from server-side code
 * using the Anthropic Messages API with the MCP Connector beta.
 *
 * Usage: npx tsx scripts/test-grain-mcp.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const GRAIN_MCP_URL = 'https://api.grain.com/_/mcp'

function readMcpRemoteToken(): string | undefined {
  // mcp-remote stores tokens in ~/.mcp-auth/
  const authDir = join(homedir(), '.mcp-auth')
  if (!existsSync(authDir)) return undefined
  // Find any tokens.json file
  const { readdirSync } = require('fs')
  for (const dir of readdirSync(authDir)) {
    const tokensPath = join(authDir, dir)
    const files = readdirSync(tokensPath).filter((f: string) => f.endsWith('_tokens.json'))
    if (files.length > 0) {
      const tokens = JSON.parse(readFileSync(join(tokensPath, files[0]), 'utf-8'))
      return tokens.access_token
    }
  }
  return undefined
}

async function testGrainMcp() {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  // The Grain MCP server uses OAuth. Token obtained via mcp-remote OAuth flow.
  // Falls back to env var, or reads from mcp-remote's token cache.
  const grainToken = process.env.GRAIN_MCP_TOKEN || readMcpRemoteToken()

  console.log('=== Grain MCP Connector POC ===')
  console.log(`Grain MCP URL: ${GRAIN_MCP_URL}`)
  console.log(`Grain token: ${grainToken ? 'SET (' + grainToken.slice(0, 10) + '...)' : 'NOT SET'}`)
  console.log()

  try {
    const response = await anthropic.beta.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: 'List the 3 most recent meetings. Return the meeting titles, dates, and durations.',
        },
      ],
      mcp_servers: [
        {
          type: 'url',
          url: GRAIN_MCP_URL,
          name: 'grain',
          ...(grainToken ? { authorization_token: grainToken } : {}),
        },
      ],
      tools: [
        {
          type: 'mcp_toolset',
          mcp_server_name: 'grain',
        },
      ],
      betas: ['mcp-client-2025-11-20'],
    })

    console.log('Response stop_reason:', response.stop_reason)
    console.log()

    for (const block of response.content) {
      if (block.type === 'text') {
        console.log('Text:', block.text)
      } else if (block.type === 'mcp_tool_use') {
        console.log('MCP Tool Use:', block.name, JSON.stringify(block.input, null, 2))
      } else if (block.type === 'mcp_tool_result') {
        console.log('MCP Tool Result:', JSON.stringify(block, null, 2).slice(0, 500))
      } else {
        console.log('Block type:', block.type, JSON.stringify(block, null, 2).slice(0, 200))
      }
      console.log()
    }
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string; error?: { type?: string; message?: string } }
    console.error('Error:', err.status, err.message)
    if (err.error) {
      console.error('Details:', JSON.stringify(err.error, null, 2))
    }
  }
}

testGrainMcp()
