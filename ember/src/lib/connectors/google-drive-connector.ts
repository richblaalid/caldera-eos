import { google } from 'googleapis'
import { createAuthenticatedGoogleClient } from './google-auth'
import type { DataConnector, ConnectorPullParams, ConnectorResult, ConnectorRecord } from './types'

const MAX_CONTENT_LENGTH = 10_000
const MAX_FILES = 50

/** File name patterns that indicate relevant business documents */
const RELEVANT_PATTERNS = [
  /sow/i, /statement.?of.?work/i, /proposal/i, /scope/i,
  /template/i, /process/i, /runbook/i, /handbook/i, /guide/i,
  /deliverable/i, /project.?plan/i, /kickoff/i,
]

type DocumentType = 'sow' | 'proposal' | 'template' | 'process_doc' | 'other'

function classifyDocument(fileName: string): DocumentType {
  const lower = fileName.toLowerCase()
  if (/sow|statement.?of.?work|scope.?of.?work/.test(lower)) return 'sow'
  if (/proposal|rfp/.test(lower)) return 'proposal'
  if (/template/.test(lower)) return 'template'
  if (/process|runbook|handbook|guide|playbook/.test(lower)) return 'process_doc'
  return 'other'
}

function isRelevantFile(fileName: string): boolean {
  return RELEVANT_PATTERNS.some(p => p.test(fileName))
}

export const googleDriveConnector: DataConnector = {
  source: 'google_drive',

  async pull(params: ConnectorPullParams): Promise<ConnectorResult> {
    const records: ConnectorRecord[] = []
    const errors: Array<{ code: string; message: string; recoverable: boolean }> = []

    const refreshToken = params.config.google_refresh_token as string | undefined
    if (!refreshToken) {
      return { records, errors: [{ code: 'NO_TOKEN', message: 'No Google refresh token', recoverable: false }] }
    }

    try {
      const auth = createAuthenticatedGoogleClient(refreshToken)
      const drive = google.drive({ version: 'v3', auth })

      // Check for configured folder ID, otherwise search broadly
      const folderId = (params.config.drive_folder_id as string) || undefined

      // Build query for Google Docs, PDFs, and Word docs
      const mimeTypes = [
        "mimeType='application/vnd.google-apps.document'",
        "mimeType='application/pdf'",
        "mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document'",
      ]
      let query = `(${mimeTypes.join(' or ')}) and trashed=false`
      if (folderId) {
        query += ` and '${folderId}' in parents`
      }

      const listResponse = await drive.files.list({
        q: query,
        fields: 'files(id,name,mimeType,modifiedTime,parents,size)',
        orderBy: 'modifiedTime desc',
        pageSize: MAX_FILES,
      })

      const files = listResponse.data.files || []

      for (const file of files) {
        if (!file.id || !file.name) continue

        // If no folder filter, only include files matching relevant patterns
        if (!folderId && !isRelevantFile(file.name)) continue

        try {
          // Extract text content for Google Docs
          let contentPreview = ''
          if (file.mimeType === 'application/vnd.google-apps.document') {
            const exportResponse = await drive.files.export({
              fileId: file.id,
              mimeType: 'text/plain',
            })
            const text = typeof exportResponse.data === 'string'
              ? exportResponse.data
              : String(exportResponse.data || '')
            contentPreview = text.slice(0, MAX_CONTENT_LENGTH)
          }
          // For PDFs/DOCX, just store metadata (content extraction is complex)

          const documentType = classifyDocument(file.name)

          const record: ConnectorRecord = {
            source: 'google_drive',
            sourceId: `gdrive-${file.id}`,
            dataType: 'document',
            payload: {
              file_name: file.name,
              file_id: file.id,
              mime_type: file.mimeType,
              modified_at: file.modifiedTime,
              content_preview: contentPreview,
              content_length: contentPreview.length,
              document_type: documentType,
            },
            entities: {
              topics: [documentType],
            },
            relevanceTags: ['operations', 'delivery', documentType],
            sourceTimestamp: file.modifiedTime || new Date().toISOString(),
          }
          records.push(record)
        } catch (fileError) {
          const err = fileError as Error
          errors.push({
            code: 'FILE_ERROR',
            message: `Failed to process ${file.name}: ${err.message}`,
            recoverable: true,
          })
        }
      }
    } catch (error) {
      const err = error as Error
      errors.push({
        code: 'DRIVE_ERROR',
        message: `Google Drive connector error: ${err.message}`,
        recoverable: false,
      })
    }

    return { records, errors }
  },
}
