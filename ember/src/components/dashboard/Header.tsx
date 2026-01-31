'use client'

import Image from 'next/image'
import { useState } from 'react'
import { MobileNav } from './MobileNav'
import type { Profile } from '@/types/database'

interface HeaderProps {
  user: {
    email?: string | null
    user_metadata?: {
      full_name?: string
      avatar_url?: string
    }
  }
  profile: Profile | null
}

export function Header({ user, profile }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const displayName = profile?.name || user.user_metadata?.full_name || user.email?.split('@')[0]
  const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-white px-4 lg:px-6">
        {/* Mobile menu button */}
        <button
          type="button"
          className="lg:hidden -ml-2 p-2 text-muted-foreground hover:text-foreground"
          onClick={() => setMobileMenuOpen(true)}
        >
          <span className="sr-only">Open menu</span>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-3">
          <div className="w-8 h-8 rounded-full ember-gradient flex items-center justify-center">
            <span className="text-sm text-white font-bold">E</span>
          </div>
          <span className="font-semibold text-foreground">Ember</span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search (optional - placeholder for future) */}
        <div className="hidden md:flex items-center gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search..."
              className="w-64 h-9 pl-9 pr-4 text-sm bg-muted border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-ember-500"
            />
            <svg className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* User menu */}
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
              <div className="w-8 h-8 rounded-full bg-ember-100 flex items-center justify-center">
                <span className="text-sm text-ember-700 font-medium">
                  {displayName?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
            )}
            <span className="hidden sm:block text-sm text-foreground font-medium">
              {displayName}
            </span>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* Mobile navigation */}
      <MobileNav
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        user={user}
        profile={profile}
      />
    </>
  )
}
