import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { globalSearch, type SearchEntityType } from '@/lib/search'

const VALID_TYPES: SearchEntityType[] = ['rocks', 'issues', 'todos', 'transcripts', 'meetings']
const MIN_QUERY_LENGTH = 2

// GET /api/eos/search?q=<query>&types=rocks,issues,todos
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const typesParam = searchParams.get('types')

    // Validate query
    if (!query || query.trim().length < MIN_QUERY_LENGTH) {
      return NextResponse.json(
        { error: `Query must be at least ${MIN_QUERY_LENGTH} characters` },
        { status: 400 }
      )
    }

    // Parse and validate types if provided
    let types: SearchEntityType[] | undefined
    if (typesParam) {
      const requestedTypes = typesParam.split(',').map((t) => t.trim().toLowerCase())
      const validRequestedTypes = requestedTypes.filter((t): t is SearchEntityType =>
        VALID_TYPES.includes(t as SearchEntityType)
      )

      if (validRequestedTypes.length === 0) {
        return NextResponse.json(
          { error: `Invalid types. Valid types are: ${VALID_TYPES.join(', ')}` },
          { status: 400 }
        )
      }

      types = validRequestedTypes
    }

    // Perform search
    const results = await globalSearch(query.trim(), { types })

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error performing search:', error)
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    )
  }
}
