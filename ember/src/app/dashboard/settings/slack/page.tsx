'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui'

interface SlackChannel {
  id: string
  name: string
  is_private: boolean
}

interface SlackSettings {
  connected: boolean
  team?: string
  error?: string
  settings: {
    channel_id: string | null
    channel_name: string | null
    is_active: boolean
  } | null
  channels: SlackChannel[]
}

export default function SlackSettingsPage() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<SlackSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState<string>('')
  const [isActive, setIsActive] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [syncing, setSyncing] = useState(false)

  // Check URL params for OAuth result
  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')

    if (success === 'connected') {
      setMessage({ type: 'success', text: 'Successfully connected to Slack!' })
    } else if (error) {
      const errorMessages: Record<string, string> = {
        denied: 'You denied the Slack authorization request.',
        no_code: 'No authorization code received from Slack.',
        invalid_state: 'Invalid state token. Please try again.',
        token_failed: 'Failed to exchange authorization code.',
        connection_failed: 'Failed to connect to Slack.',
        no_org: 'No organization found for your account.',
        save_failed: 'Failed to save Slack settings.',
        unknown: 'An unknown error occurred.',
      }
      setMessage({ type: 'error', text: errorMessages[error] || error })
    }
  }, [searchParams])

  // Load Slack settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/integrations/slack/settings')
        const settingsData = await res.json()
        setData(settingsData)

        if (settingsData.settings) {
          setSelectedChannel(settingsData.settings.channel_id || '')
          setIsActive(settingsData.settings.is_active)
        }
      } catch (err) {
        console.error('Failed to load Slack settings:', err)
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  // Save channel selection
  const handleSave = async () => {
    if (!selectedChannel) return

    setSaving(true)
    setMessage(null)

    try {
      const channel = data?.channels.find(c => c.id === selectedChannel)
      const res = await fetch('/api/integrations/slack/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: selectedChannel,
          channel_name: channel?.name || null,
          is_active: isActive,
        }),
      })

      if (res.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' })
      } else {
        throw new Error('Failed to save')
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save settings.' })
    } finally {
      setSaving(false)
    }
  }

  // Sync Slack user IDs to profiles
  const handleSyncUsers = async () => {
    setSyncing(true)
    setMessage(null)

    try {
      const res = await fetch('/api/integrations/slack/sync-users', {
        method: 'POST',
      })

      const result = await res.json()

      if (res.ok) {
        setMessage({
          type: 'success',
          text: `Synced ${result.matched} profile(s) with Slack. ${result.notFound} not found in Slack.`
        })
      } else {
        throw new Error(result.error || 'Failed to sync')
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to sync Slack users.'
      })
    } finally {
      setSyncing(false)
    }
  }

  // Disconnect Slack
  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Slack?')) return

    try {
      const res = await fetch('/api/integrations/slack/settings', {
        method: 'DELETE',
      })

      if (res.ok) {
        setData({ connected: false, settings: null, channels: [] })
        setSelectedChannel('')
        setMessage({ type: 'success', text: 'Slack disconnected.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to disconnect Slack.' })
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading Slack settings...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/checkup"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Checkup
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">Slack Integration</h1>
        <p className="text-muted-foreground mt-1">
          Connect Slack to receive checkup reminders in your team channel
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

      {/* Connection Status */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Slack Logo */}
              <div className="w-12 h-12 bg-[#4A154B] rounded-lg flex items-center justify-center">
                <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Slack</h2>
                {data?.connected ? (
                  <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Connected to {data.team}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Not connected</p>
                )}
              </div>
            </div>

            {data?.connected ? (
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
              >
                Disconnect
              </button>
            ) : (
              <a
                href="/api/integrations/slack/oauth"
                className="px-4 py-2 bg-[#4A154B] text-white rounded-lg font-medium hover:bg-[#3D1040] transition-colors"
              >
                Connect Slack
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Channel Selection */}
      {data?.connected && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Reminder Settings</h3>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Reminder Channel
              </label>
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ember-500"
              >
                <option value="">Select a channel...</option>
                {data.channels.map(channel => (
                  <option key={channel.id} value={channel.id}>
                    {channel.is_private ? '🔒 ' : '# '}{channel.name}
                  </option>
                ))}
              </select>
              <p className="text-sm text-muted-foreground mt-1">
                Checkup reminders will be posted to this channel
              </p>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-ember-500 border-border rounded focus:ring-ember-500"
              />
              <span className="text-sm text-foreground">Enable weekly reminders</span>
            </label>

            <div className="pt-4 border-t border-border flex justify-end">
              <button
                onClick={handleSave}
                disabled={!selectedChannel || saving}
                className="px-4 py-2 bg-ember-500 text-white rounded-lg font-medium hover:bg-ember-600 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Sync */}
      {data?.connected && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="text-lg font-semibold text-foreground">User Mapping</h3>
            <p className="text-sm text-muted-foreground">
              Sync your team profiles with Slack to enable @mentions in reminders.
              This matches profiles by email address.
            </p>
            <div className="flex justify-end">
              <button
                onClick={handleSyncUsers}
                disabled={syncing}
                className="px-4 py-2 border border-border text-foreground rounded-lg font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                {syncing ? 'Syncing...' : 'Sync Slack Users'}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">How it works</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-ember-500 mt-0.5">1.</span>
              <span>Connect your Slack workspace using the button above</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-ember-500 mt-0.5">2.</span>
              <span>Select a channel where reminders should be posted</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-ember-500 mt-0.5">3.</span>
              <span>When a checkup is active, reminders are sent every Monday at 9 AM</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-ember-500 mt-0.5">4.</span>
              <span>Team members who haven&apos;t completed will be @mentioned</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
