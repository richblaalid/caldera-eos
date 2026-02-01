'use client'

import Image from 'next/image'
import { useState, useCallback } from 'react'
import { MobileNav } from './MobileNav'
import { ThemeToggle } from '@/components/ThemeToggle'
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
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), [])

  const displayName = profile?.name || user.user_metadata?.full_name || user.email?.split('@')[0]
  const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-background px-4 lg:px-6">
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
          <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="header-ember-grad" x1="50%" y1="100%" x2="50%" y2="0%">
                <stop offset="0%" stopColor="#c2410c"/>
                <stop offset="50%" stopColor="#ea580c"/>
                <stop offset="100%" stopColor="#f97316"/>
              </linearGradient>
            </defs>
            <path
              d="M16 2C16 2 6 10 6 18C6 24 10 28 16 30C16 30 12 24 12 20C12 16 14 12 16 10C18 12 20 16 20 20C20 24 16 30 16 30C22 28 26 24 26 18C26 10 16 2 16 2Z"
              fill="url(#header-ember-grad)"
            />
            <path
              d="M16 8C16 8 11 14 11 19C11 23 13 26 16 27C16 27 14 23 14 20C14 17 15 14 16 13C17 14 18 17 18 20C18 23 16 27 16 27C19 26 21 23 21 19C21 14 16 8 16 8Z"
              fill="#fff"
              fillOpacity="0.2"
            />
          </svg>
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

        {/* Theme toggle and user menu */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
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
        onClose={closeMobileMenu}
        user={user}
        profile={profile}
      />
    </>
  )
}
