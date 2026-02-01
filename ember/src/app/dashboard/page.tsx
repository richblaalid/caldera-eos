import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Profile } from '@/types/database'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch user profile for welcome message
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id || '')
    .single<Profile>()

  const displayName = profile?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0]

  const quickActions = [
    {
      name: 'V/TO',
      description: 'Vision/Traction Organizer',
      href: '/dashboard/vto',
      color: 'bg-ember-500/10 border-ember-500/20 hover:border-ember-500/40',
      iconColor: 'text-ember-600 dark:text-ember-400',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      name: 'Rocks',
      description: '90-day priorities',
      href: '/dashboard/rocks',
      color: 'bg-blue-500/10 border-blue-500/20 hover:border-blue-500/40',
      iconColor: 'text-blue-600 dark:text-blue-400',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      name: 'Scorecard',
      description: 'Weekly metrics',
      href: '/dashboard/scorecard',
      color: 'bg-green-500/10 border-green-500/20 hover:border-green-500/40',
      iconColor: 'text-green-600 dark:text-green-400',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      name: 'Issues',
      description: 'IDS workflow',
      href: '/dashboard/issues',
      color: 'bg-amber-500/10 border-amber-500/20 hover:border-amber-500/40',
      iconColor: 'text-amber-600 dark:text-amber-400',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      name: 'To-dos',
      description: '7-day action items',
      href: '/dashboard/todos',
      color: 'bg-purple-500/10 border-purple-500/20 hover:border-purple-500/40',
      iconColor: 'text-purple-600 dark:text-purple-400',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      name: 'Chat with Ember',
      description: 'EOS coaching & questions',
      href: '/dashboard/chat',
      color: 'bg-slate-500/10 border-slate-500/20 hover:border-slate-500/40',
      iconColor: 'text-slate-600 dark:text-slate-400',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="max-w-7xl mx-auto">
      {/* Welcome header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {displayName}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Here&apos;s an overview of your EOS system
        </p>
      </div>

      {/* Quick actions grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {quickActions.map((action) => (
          <Link
            key={action.name}
            href={action.href}
            className={`
              flex items-start gap-4 p-5 rounded-xl border bg-background
              transition-all duration-150 hover:shadow-md
              ${action.color}
            `}
          >
            <div className={`p-2 rounded-lg ${action.color.split(' ')[0]}`}>
              <span className={action.iconColor}>{action.icon}</span>
            </div>
            <div>
              <h2 className="font-semibold text-foreground">{action.name}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent activity section (placeholder) */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
        <div className="bg-background rounded-xl border border-border p-6">
          <p className="text-muted-foreground text-sm">
            Your recent EOS activity will appear here once you start using the system.
          </p>
        </div>
      </div>

      {/* Upcoming L10 section (placeholder) */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">Upcoming L10</h2>
        <div className="bg-background rounded-xl border border-border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-ember-500/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-ember-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-foreground">No upcoming meetings</p>
              <p className="text-sm text-muted-foreground">Schedule your L10 to get started</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
