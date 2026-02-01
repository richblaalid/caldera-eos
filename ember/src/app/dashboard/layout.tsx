import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar, Header } from '@/components/dashboard'
import type { Profile } from '@/types/database'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user is authorized using secure database function
  const { data: isAllowed } = await supabase
    .rpc('is_user_allowed')

  if (!isAllowed) {
    redirect('/unauthorized')
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  return (
    <div className="flex h-screen bg-muted">
      {/* Sidebar - hidden on mobile */}
      <Sidebar className="hidden lg:flex" />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={user} profile={profile} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
