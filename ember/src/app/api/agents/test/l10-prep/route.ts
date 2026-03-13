import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateL10Prep, type L10Prep } from '@/lib/agents/l10-prep'
import { getSlackClient, postBlockMessage, openDM } from '@/lib/connectors/slack-connector'
import { escapeSlackMrkdwn, chunkForSlackSections, slackDate } from '@/lib/slack-format'
import { verifyCronAuth } from '@/lib/agents/ingest-helpers'

const esc = escapeSlackMrkdwn

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * GET /api/agents/test/l10-prep — Generate and deliver L10 prep independently.
 * Requires CRON_SECRET auth.
 */
export async function GET(request: NextRequest) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const orgId = '00000000-0000-0000-0000-000000000001'

    // Generate L10 prep from EOS data
    const { prep, outputId } = await generateL10Prep(orgId)

    // Build Slack blocks (same as deliverL10Prep in morning-briefing)
    const l10DateToken = slackDate(new Date(), '{date_short}', 'today')
    const blocks = buildL10PrepBlocks(prep, l10DateToken)

    // Post to #caldera-eos channel
    const { data: slackSettings } = await supabaseAdmin
      .from('slack_settings')
      .select('channel_id')
      .eq('organization_id', orgId)
      .single()

    let channelPosted = false
    const client = await getSlackClient(orgId)

    if (client && slackSettings?.channel_id) {
      await postBlockMessage(
        client,
        slackSettings.channel_id,
        `L10 Meeting Prep — ${l10DateToken}: ${prep.headline}`,
        blocks
      )
      channelPosted = true
    }

    // DM each partner their personal summary
    let dmsDelivered = 0
    if (client) {
      const { data: members } = await supabaseAdmin
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', orgId)

      for (const member of members || []) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('slack_user_id, name')
          .eq('id', member.user_id)
          .single()

        if (!profile?.slack_user_id) continue

        const dmChannel = await openDM(client, profile.slack_user_id)
        if (!dmChannel) continue

        const partnerName = profile.name || 'Unknown'
        const myRocks = prep.rock_review.rocks.filter(r => r.owner === partnerName)
        const myOverdue = prep.todo_review.carryforward_items

        const personalBlocks: Record<string, unknown>[] = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Your L10 Prep — ${l10DateToken}*\n\nThe full prep has been posted to the team channel. Here's your personal summary:`,
            },
          },
        ]

        if (myRocks.length > 0) {
          personalBlocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Your Rocks:*\n' + myRocks.map(r =>
                `• ${esc(r.title)} — ${esc(r.status)} (${r.completion_pct}% done) ${esc(r.note)}`
              ).join('\n'),
            },
          })
        }

        if (myOverdue.length > 0) {
          personalBlocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Carried-Forward To-Dos:*\n' + myOverdue.map(t => `• ${esc(t)}`).join('\n'),
            },
          })
        }

        await postBlockMessage(client, dmChannel, `Your L10 Prep — ${l10DateToken}`, personalBlocks)
        dmsDelivered++
      }
    }

    return NextResponse.json({
      message: 'L10 prep generated and delivered',
      outputId,
      headline: prep.headline,
      channel_posted: channelPosted,
      dms_delivered: dmsDelivered,
      issues_count: prep.issues_list.length,
      rocks_count: prep.rock_review.rocks.length,
    })
  } catch (error) {
    console.error('L10 prep test error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'L10 prep failed' },
      { status: 500 }
    )
  }
}

function buildL10PrepBlocks(prep: L10Prep, l10DateToken: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `L10 Meeting Prep — ${l10DateToken}`, emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*${esc(prep.headline)}*` },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Segue:* ${esc(prep.segue_prompt)}` },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Scorecard:* ${esc(prep.scorecard_review.summary)}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Rocks:* ${esc(prep.rock_review.summary)}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*To-Dos:* ${prep.todo_review.completion_rate_2wk}% completion rate | ${prep.todo_review.overdue_count} overdue\n${esc(prep.todo_review.note)}`,
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Financial*\n${esc(prep.financial_snapshot)}` },
        { type: 'mrkdwn', text: `*Pipeline*\n${esc(prep.pipeline_snapshot)}` },
      ],
    },
  ]

  // IDS priorities
  if (prep.issues_list.length > 0) {
    blocks.push({ type: 'divider' })
    const issueLines = prep.issues_list
      .sort((a, b) => a.recommended_order - b.recommended_order)
      .map((issue, i) => `${i + 1}. ${esc(issue.title)} _(${esc(issue.priority)}, ${issue.age_days}d old)_`)
    const issueChunks = chunkForSlackSections(issueLines, '\n')
    issueChunks.forEach((chunk, i) => {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: i === 0 ? `*IDS Priority Order:*\n${chunk}` : chunk,
        },
      })
    })
  }

  // Ember observations
  if (prep.ember_observations.length > 0) {
    blocks.push({ type: 'divider' })
    const obsLines = prep.ember_observations.map(o => `• ${esc(o)}`)
    const obsChunks = chunkForSlackSections(obsLines, '\n')
    obsChunks.forEach((chunk, i) => {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: i === 0 ? `*Ember Observations:*\n${chunk}` : chunk,
        },
      })
    })
  }

  return blocks
}
