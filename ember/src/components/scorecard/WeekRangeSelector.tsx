'use client'

import { useRouter, usePathname } from 'next/navigation'

const OPTIONS = [
  { value: 'this-quarter', label: 'This Quarter' },
  { value: 'last-quarter', label: 'Last Quarter' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'last-year', label: 'Last Year' },
  { value: 'trailing-13', label: 'Trailing 13 Weeks' },
]

export function WeekRangeSelector({ value }: { value: string }) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <select
      value={value}
      onChange={(e) => router.push(`${pathname}?range=${e.target.value}`)}
      className="h-10 px-3 text-sm rounded-lg border border-border bg-background"
    >
      {OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
