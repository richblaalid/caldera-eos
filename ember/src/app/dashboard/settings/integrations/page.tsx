'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui'

interface ConnectorStatus {
  name: string
  key: string
  connected: boolean
  lastSync: string | null
  details?: string
}

interface StatusResponse {
  connectors: ConnectorStatus[]
}

const CONNECTOR_META: Record<string, { label: string; description: string; color: string; authUrl: string; disconnectable: boolean }> = {
  google: {
    label: 'Google (Gmail + Calendar)',
    description: 'Email monitoring and calendar events for briefing context',
    color: '#4285F4',
    authUrl: '/api/agents/auth/google',
    disconnectable: true,
  },
  slack: {
    label: 'Slack',
    description: 'Briefing delivery, commands, and team notifications',
    color: '#4A154B',
    authUrl: '/api/integrations/slack/oauth',
    disconnectable: true,
  },
  hubspot: {
    label: 'HubSpot',
    description: 'Sales pipeline, deals, contacts, and companies',
    color: '#FF7A59',
    authUrl: '', // Private App — configured via environment variable
    disconnectable: false,
  },
  quickbooks: {
    label: 'QuickBooks',
    description: 'Invoices, payments, P&L, and AR aging reports',
    color: '#2CA01C',
    authUrl: '/api/agents/auth/quickbooks',
    disconnectable: true,
  },
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function IntegrationsPage() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Check URL params for OAuth results
  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')

    if (success) {
      const successMessages: Record<string, string> = {
        google_connected: 'Google connected successfully!',
        hubspot_connected: 'HubSpot connected successfully!',
        quickbooks_connected: 'QuickBooks connected successfully!',
        slack_connected: 'Slack connected successfully!',
      }
      setMessage({ type: 'success', text: successMessages[success] || 'Connected!' })
    } else if (error) {
      setMessage({ type: 'error', text: `Connection error: ${error.replace(/_/g, ' ')}` })
    }
  }, [searchParams])

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/status')
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
      }
    } catch (err) {
      console.error('Failed to load connector status:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load connector status
  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  async function handleDisconnect(connectorKey: string, label: string) {
    if (!confirm(`Disconnect ${label}? This will remove the saved credentials.`)) return

    setDisconnecting(connectorKey)
    try {
      const res = await fetch('/api/agents/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connector: connectorKey }),
      })

      if (res.ok) {
        setMessage({ type: 'success', text: `${label} disconnected.` })
        await loadStatus()
      } else {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error || 'Failed to disconnect.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to disconnect. Please try again.' })
    } finally {
      setDisconnecting(null)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading integrations...</div>
      </div>
    )
  }

  const connectors = status?.connectors || []

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">Integrations</h1>
        <p className="text-muted-foreground mt-1">
          Connect your tools to power Ember&apos;s briefings and agent pipeline
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Connector Cards */}
      <div className="space-y-4">
        {Object.entries(CONNECTOR_META).map(([key, meta]) => {
          const connector = connectors.find(c => c.key === key)
          const isConnected = connector?.connected ?? false
          const lastSync = connector?.lastSync

          return (
            <Card key={key}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: meta.color }}
                    >
                      {meta.label[0]}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{meta.label}</h3>
                      <p className="text-sm text-muted-foreground">{meta.description}</p>
                      {isConnected && lastSync && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last sync: {formatTimeAgo(lastSync)}
                        </p>
                      )}
                      {isConnected && connector?.details && (
                        <p className="text-xs text-muted-foreground">{connector.details}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isConnected ? (
                      <>
                        <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          Connected
                        </span>
                        {key === 'slack' && (
                          <Link
                            href="/dashboard/settings/slack"
                            className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                          >
                            Settings
                          </Link>
                        )}
                        {meta.disconnectable && (
                          <button
                            onClick={() => handleDisconnect(key, meta.label)}
                            disabled={disconnecting === key}
                            className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-50"
                          >
                            {disconnecting === key ? 'Disconnecting...' : 'Disconnect'}
                          </button>
                        )}
                      </>
                    ) : meta.authUrl ? (
                      <a
                        href={meta.authUrl}
                        className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                        style={{ backgroundColor: meta.color }}
                      >
                        Connect
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Not configured
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Info */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-3">How integrations work</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-ember-500 mt-0.5">1.</span>
              <span>Connect your tools using the buttons above (OAuth — your credentials stay with the provider)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-ember-500 mt-0.5">2.</span>
              <span>Ember syncs data automatically — Gmail and Calendar every 15 minutes, HubSpot every 30 minutes</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-ember-500 mt-0.5">3.</span>
              <span>Agents analyze synced data overnight and generate your morning briefing</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-ember-500 mt-0.5">4.</span>
              <span>Briefings are delivered to your Slack DM each morning</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
