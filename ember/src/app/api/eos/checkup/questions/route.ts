import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCheckupQuestions, getQuestionsByComponent } from '@/lib/eos/checkup'

// GET /api/eos/checkup/questions - Get all questions
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const grouped = searchParams.get('grouped') === 'true'

    if (grouped) {
      const questionsByComponent = await getQuestionsByComponent()
      return NextResponse.json(questionsByComponent)
    }

    const questions = await getCheckupQuestions()
    return NextResponse.json(questions)
  } catch (error) {
    console.error('Checkup questions GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
