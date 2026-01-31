'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui'
import type { Meeting } from '@/types/database'

interface TranscriptUploadProps {
  meetings: Meeting[]
}

export function TranscriptUpload({ meetings }: TranscriptUploadProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [meetingId, setMeetingId] = useState<string>('')
  const [meetingDate, setMeetingDate] = useState('')

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    setError(null)

    const files = Array.from(e.dataTransfer.files)
    const validFile = files.find(
      (f) => f.name.endsWith('.txt') || f.name.endsWith('.md')
    )

    if (!validFile) {
      setError('Please upload a .txt or .md file')
      return
    }

    setSelectedFile(validFile)
    // Use filename (without extension) as default title
    const defaultTitle = validFile.name.replace(/\.(txt|md)$/, '')
    setTitle(defaultTitle)
  }, [])

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null)
      const file = e.target.files?.[0]
      if (!file) return

      if (!file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
        setError('Please upload a .txt or .md file')
        return
      }

      setSelectedFile(file)
      const defaultTitle = file.name.replace(/\.(txt|md)$/, '')
      setTitle(defaultTitle)
    },
    []
  )

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setError(null)

    try {
      // Read file content
      const text = await selectedFile.text()

      // Create transcript via API
      const res = await fetch('/api/eos/transcripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || null,
          full_text: text,
          meeting_id: meetingId || null,
          meeting_date: meetingDate || null,
          source: 'upload',
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to upload transcript')
      }

      const transcript = await res.json()

      // Reset form
      setSelectedFile(null)
      setTitle('')
      setMeetingId('')
      setMeetingDate('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Navigate to the new transcript
      router.push(`/dashboard/transcripts/${transcript.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload')
    } finally {
      setIsUploading(false)
    }
  }

  const handleCancel = () => {
    setSelectedFile(null)
    setTitle('')
    setMeetingId('')
    setMeetingDate('')
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Transcript</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !selectedFile && fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors
            ${isDragging
              ? 'border-ember-500 bg-ember-50'
              : selectedFile
                ? 'border-success bg-success/5'
                : 'border-border hover:border-ember-300 hover:bg-muted/50'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md"
            onChange={handleFileSelect}
            className="hidden"
          />

          {selectedFile ? (
            <div className="space-y-2">
              <svg
                className="w-10 h-10 mx-auto text-success"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <svg
                className="w-10 h-10 mx-auto text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-foreground">
                Drag and drop your transcript file here
              </p>
              <p className="text-sm text-muted-foreground">
                or click to browse (.txt, .md)
              </p>
            </div>
          )}
        </div>

        {/* Metadata Form */}
        {selectedFile && (
          <div className="space-y-4 pt-4 border-t border-border">
            <Input
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Meeting transcript title"
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Link to Meeting (optional)
                </label>
                <select
                  value={meetingId}
                  onChange={(e) => setMeetingId(e.target.value)}
                  className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-white"
                >
                  <option value="">None</option>
                  {meetings.map((meeting) => (
                    <option key={meeting.id} value={meeting.id}>
                      {meeting.title} -{' '}
                      {new Date(meeting.meeting_date).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Meeting Date (optional)
                </label>
                <input
                  type="datetime-local"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button onClick={handleUpload} isLoading={isUploading}>
                Upload Transcript
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
