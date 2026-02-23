import type { DataSource, DataType, IngestedEntities } from '@/types/agents'

/**
 * Common interface for all data connectors.
 * Each connector pulls data from an external source,
 * normalizes it, and returns records ready for the ingested_data table.
 */
export interface DataConnector {
  /** Which data source this connector handles */
  source: DataSource

  /** Pull new data for a given partner. Returns normalized records. */
  pull(params: ConnectorPullParams): Promise<ConnectorResult>
}

export interface ConnectorPullParams {
  organizationId: string
  partnerId: string
  /** Connector-specific config (tokens, sync markers, etc.) */
  config: Record<string, unknown>
}

export interface ConnectorResult {
  records: ConnectorRecord[]
  /** Updated sync state to store back in partner_preferences */
  syncState?: Record<string, unknown>
  errors: ConnectorError[]
}

export interface ConnectorRecord {
  source: DataSource
  sourceId: string
  dataType: DataType
  payload: Record<string, unknown>
  rawPayload?: Record<string, unknown>
  entities: IngestedEntities
  relevanceTags: string[]
  sourceTimestamp: string | null
}

export interface ConnectorError {
  code: string
  message: string
  recoverable: boolean
}
