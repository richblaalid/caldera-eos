'use client'

import { useRouter, usePathname } from 'next/navigation'

const OPTIONS = [
  { value: 4, label: '4 weeks' },
  { value: 8, label: '8 weeks' },
  { value: 13, label: '13 weeks (Quarter)' },
  { value: 26, label: '26 weeks' },
]

export function WeekRangeSelector({ value }: { value: number }) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <select
      value={value.toString()}
      onChange={(e) => router.push(`${pathname}?weeks=${e.target.value}`)}
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
