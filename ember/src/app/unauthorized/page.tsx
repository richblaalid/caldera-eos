'use client'

import { createClient } from '@/lib/supabase/client'

export default function UnauthorizedPage() {
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-4 text-center">
        <div className="bg-card rounded-2xl shadow-xl p-8 border border-border">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 mb-6">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            Your account is not authorized to access Ember. This application is restricted to the Caldera leadership team.
          </p>

          <div className="space-y-3">
            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2 bg-ember-600 text-white rounded-lg hover:bg-ember-700 transition-colors font-medium"
            >
              Sign Out
            </button>
            <p className="text-sm text-muted-foreground">
              If you believe you should have access, please contact the team administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
