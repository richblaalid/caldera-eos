'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { navigation } from './Sidebar'
import type { Profile } from '@/types/database'

interface MobileNavProps {
  isOpen: boolean
  onClose: () => void
  user: {
    email?: string | null
    user_metadata?: {
      full_name?: string
      avatar_url?: string
    }
  }
  profile: Profile | null
}

export function MobileNav({ isOpen, onClose, user, profile }: MobileNavProps) {
  const pathname = usePathname()

  const displayName = profile?.name || user.user_metadata?.full_name || user.email?.split('@')[0]
  const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url

  // Close menu when route changes
  useEffect(() => {
    onClose()
  }, [pathname, onClose])

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-foreground/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 w-full max-w-xs bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="mobile-ember-grad" x1="50%" y1="100%" x2="50%" y2="0%">
                  <stop offset="0%" stopColor="#c2410c"/>
                  <stop offset="50%" stopColor="#ea580c"/>
                  <stop offset="100%" stopColor="#f97316"/>
                </linearGradient>
              </defs>
              <path
                d="M16 2C16 2 6 10 6 18C6 24 10 28 16 30C16 30 12 24 12 20C12 16 14 12 16 10C18 12 20 16 20 20C20 24 16 30 16 30C22 28 26 24 26 18C26 10 16 2 16 2Z"
                fill="url(#mobile-ember-grad)"
              />
              <path
                d="M16 8C16 8 11 14 11 19C11 23 13 26 16 27C16 27 14 23 14 20C14 17 15 14 16 13C17 14 18 17 18 20C18 23 16 27 16 27C19 26 21 23 21 19C21 14 16 8 16 8Z"
                fill="#fff"
                fillOpacity="0.2"
              />
            </svg>
            <span className="font-semibold text-foreground">Ember</span>
          </div>
          <button
            type="button"
            className="p-2 -mr-2 text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <span className="sr-only">Close menu</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* User info */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName || 'User avatar'}
                width={40}
                height={40}
                className="rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-ember-500/10 flex items-center justify-center">
                <span className="text-lg text-ember-600 dark:text-ember-400 font-medium">
                  {displayName?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-foreground">{displayName}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href))

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium
                  transition-colors duration-150
                  ${isActive
                    ? 'bg-ember-500/10 text-ember-600 dark:text-ember-400'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }
                `}
              >
                <span className={isActive ? 'text-ember-600' : ''}>{item.icon}</span>
                <div>
                  <span>{item.name}</span>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  )}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border">
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
