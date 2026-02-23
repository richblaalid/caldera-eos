---
description: Sync meeting transcripts from Grain into Ember
argument-hint: [list|sync <meeting-id>|search <query>]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(npm:*), AskUserQuestion, mcp__claude_ai_Grain__list_meetings, mcp__claude_ai_Grain__list_attended_meetings, mcp__claude_ai_Grain__fetch_meeting, mcp__claude_ai_Grain__fetch_meeting_notes, mcp__claude_ai_Grain__fetch_meeting_transcript, mcp__claude_ai_Grain__search_meetings, mcp__claude_ai_Grain__search_persons
---

# Sync Grain Command

Sync meeting transcripts from Grain into Ember for EOS entity extraction and AI processing.

## Usage

| Command | Description |
|---------|-------------|
| `/sync-grain list` | List recent meetings available in Grain |
| `/sync-grain sync <meeting-id>` | Sync a specific meeting's transcript |
| `/sync-grain search <query>` | Search meetings by content |
| `/sync-grain attended` | List meetings you attended |

## Examples

```
/sync-grain list                    # See recent meetings
/sync-grain attended                # See meetings you attended
/sync-grain search "quarterly rocks" # Find meetings about rocks
/sync-grain sync abc123             # Sync specific meeting
```

## Workflow

### List Meetings (`/sync-grain list`)

1. Call `mcp__claude_ai_Grain__list_meetings` with:
   - `limit`: 10
   - `filters.participant_scope`: "external" for client meetings, omit for all
2. Display results in table format:
   ```
   | Date | Title | Duration | Participants |
   |------|-------|----------|--------------|
   ```
3. Include meeting IDs for sync

### Search Meetings (`/sync-grain search <query>`)

1. Call `mcp__claude_ai_Grain__search_meetings` with:
   - `search_string`: user query
   - `sort_by`: "recency"
   - `limit`: 10
2. Display matched segments with context
3. Include meeting IDs for sync

### Sync Meeting (`/sync-grain sync <meeting-id>`)

1. **Fetch meeting details**
   ```
   mcp__claude_ai_Grain__fetch_meeting
   ```

2. **Fetch transcript**
   ```
   mcp__claude_ai_Grain__fetch_meeting_transcript
   ```

3. **Fetch AI notes** (if available)
   ```
   mcp__claude_ai_Grain__fetch_meeting_notes
   ```

4. **Format for Ember**
   - Create transcript document following Ember's format
   - Extract participants and map to Ember users
   - Identify meeting type (L10, Quarterly, 1:1, etc.)

5. **Save to Ember**
   - Write to appropriate location based on meeting type
   - Trigger EOS entity extraction if applicable

### Attended Meetings (`/sync-grain attended`)

1. Call `mcp__claude_ai_Grain__list_attended_meetings`
2. Display with same format as list

## Meeting Type Detection

| Grain Title Pattern | Ember Type | EOS Relevance |
|---------------------|------------|---------------|
| "L10", "Level 10" | l10 | High - extract rocks, issues, todos |
| "Quarterly", "Q[1-4]" | quarterly | High - rock reviews |
| "1:1", "One-on-one" | one_on_one | Medium - personal rocks |
| "Standup", "Daily" | standup | Low - skip |
| Other | general | Medium - scan for issues |

## Output Format

When syncing, create output like:

```
Meeting Synced: {title}
====================
Date: {date}
Duration: {duration}
Participants: {list}
Type: {detected type}

Transcript saved to: {path}

EOS Entities Detected:
- Rocks mentioned: {count}
- Issues raised: {count}
- Todos assigned: {count}

Next steps:
- Run `/execute` to process for entity extraction
- Or manually review transcript at {path}
```

## Integration Points

### Ember Transcript Schema
Synced transcripts should match:
```typescript
{
  title: string
  date: string // ISO date
  duration_minutes: number
  participants: string[]
  source: 'grain'
  source_id: string // Grain meeting ID
  content: string // Full transcript
  meeting_type: 'l10' | 'quarterly' | 'one_on_one' | 'general'
  extracted_entities?: {
    rocks: string[]
    issues: string[]
    todos: string[]
  }
}
```

### User Mapping
Map Grain participants to Ember profiles using:
- Email matching (preferred)
- Name matching (fallback)
- `search_persons` for fuzzy matching

## Error Handling

### No Meetings Found
```
No meetings found matching your criteria.
Try:
- /sync-grain list (see all recent)
- /sync-grain attended (see yours)
- /sync-grain search "keyword"
```

### Meeting Not Accessible
```
Meeting {id} not accessible.
This may be due to:
- Meeting not recorded
- Insufficient permissions
- Meeting still processing
```

### Sync Failures
Log errors but continue:
```
Warning: Could not fetch notes for {id}
Transcript synced without AI notes.
```
