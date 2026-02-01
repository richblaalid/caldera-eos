import Link from 'next/link'
import { getTranscripts, getMeetings } from '@/lib/eos'
import { Card, CardContent, Badge } from '@/components/ui'
import { TranscriptUpload } from './TranscriptUpload'
import type { Transcript } from '@/types/database'

function TranscriptCard({ transcript }: { transcript: Transcript }) {
  const date = transcript.meeting_date
    ? new Date(transcript.meeting_date)
    : new Date(transcript.created_at)

  return (
    <Link href={`/dashboard/transcripts/${transcript.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {transcript.processed ? (
                  <Badge variant="success">Processed</Badge>
                ) : (
                  <Badge variant="warning">Pending</Badge>
                )}
                {transcript.source && (
                  <Badge variant="default">{transcript.source}</Badge>
                )}
              </div>
              <h3 className="font-semibold text-foreground truncate">
                {transcript.title || 'Untitled Transcript'}
              </h3>
              {transcript.summary && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {transcript.summary}
                </p>
              )}
              {transcript.participants && transcript.participants.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Participants: {transcript.participants.join(', ')}
                </p>
              )}
            </div>
            <div className="text-right text-sm flex-shrink-0">
              <p className="font-medium text-foreground">
                {date.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
              <p className="text-muted-foreground">
                {date.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <svg
          className="w-12 h-12 mx-auto text-muted-foreground mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="text-muted-foreground mb-2">No transcripts yet</p>
        <p className="text-sm text-muted-foreground">
          Upload a meeting transcript to get started
        </p>
      </CardContent>
    </Card>
  )
}

export default async function TranscriptsPage() {
  const [transcripts, meetings] = await Promise.all([
    getTranscripts(),
    getMeetings(),
  ])

  const processedCount = transcripts.filter((t) => t.processed).length
  const pendingCount = transcripts.filter((t) => !t.processed).length

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Transcripts</h1>
        <p className="text-muted-foreground mt-1">
          Upload and analyze meeting transcripts
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-foreground">
              {transcripts.length}
            </p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-success">{processedCount}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Processed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-warning">{pendingCount}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Pending
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Upload Section */}
      <TranscriptUpload meetings={meetings} />

      {/* Transcript List */}
      {transcripts.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            All Transcripts
          </h2>
          {transcripts.map((transcript) => (
            <TranscriptCard key={transcript.id} transcript={transcript} />
          ))}
        </div>
      )}
    </div>
  )
}
