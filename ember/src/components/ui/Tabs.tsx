'use client'

interface Tab {
  id: string
  label: string
  count?: number
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (tabId: string) => void
  className?: string
}

export function Tabs({ tabs, activeTab, onChange, className = '' }: TabsProps) {
  return (
    <div className={`border-b border-border ${className}`}>
      <nav className="-mb-px flex gap-6" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`
                relative py-3 text-sm font-medium transition-colors
                ${
                  isActive
                    ? 'text-ember-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-ember-600'
                    : 'text-muted-foreground hover:text-foreground'
                }
              `}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`
                    ml-2 rounded-full px-2 py-0.5 text-xs
                    ${isActive ? 'bg-ember-100 text-ember-700' : 'bg-muted text-muted-foreground'}
                  `}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
