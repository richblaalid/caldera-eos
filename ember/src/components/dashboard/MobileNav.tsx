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
      <div className="fixed inset-y-0 left-0 w-full max-w-xs bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full ember-gradient flex items-center justify-center">
              <span className="text-sm text-white font-bold">E</span>
            </div>
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
              <div className="w-10 h-10 rounded-full bg-ember-100 flex items-center justify-center">
                <span className="text-lg text-ember-700 font-medium">
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
                    ? 'bg-ember-50 text-ember-700'
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
