import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import type { Profile } from '@/types/database'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  // Display name priority: profile name > user metadata > email prefix
  const displayName = profile?.name || user.user_metadata?.full_name || user.email?.split('@')[0]
  const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                <span className="text-sm text-white font-bold">E</span>
              </div>
              <span className="font-semibold text-gray-900">Ember</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={displayName || 'User avatar'}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                    <span className="text-sm text-gray-600 font-medium">
                      {displayName?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}
                <span className="text-sm text-gray-600">
                  {displayName}
                </span>
              </div>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Welcome back, {displayName}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* V/TO Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">V/TO</h2>
            <p className="text-gray-600 text-sm">Vision/Traction Organizer</p>
            <p className="text-gray-400 text-sm mt-4">Coming soon...</p>
          </div>

          {/* Rocks Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Rocks</h2>
            <p className="text-gray-600 text-sm">Quarterly priorities</p>
            <p className="text-gray-400 text-sm mt-4">Coming soon...</p>
          </div>

          {/* Scorecard Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Scorecard</h2>
            <p className="text-gray-600 text-sm">Weekly metrics</p>
            <p className="text-gray-400 text-sm mt-4">Coming soon...</p>
          </div>

          {/* Issues Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Issues</h2>
            <p className="text-gray-600 text-sm">IDS workflow</p>
            <p className="text-gray-400 text-sm mt-4">Coming soon...</p>
          </div>

          {/* To-dos Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">To-dos</h2>
            <p className="text-gray-600 text-sm">7-day action items</p>
            <p className="text-gray-400 text-sm mt-4">Coming soon...</p>
          </div>

          {/* Chat Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Chat with Ember</h2>
            <p className="text-gray-600 text-sm">EOS coaching & questions</p>
            <p className="text-gray-400 text-sm mt-4">Coming soon...</p>
          </div>
        </div>
      </main>
    </div>
  )
}
