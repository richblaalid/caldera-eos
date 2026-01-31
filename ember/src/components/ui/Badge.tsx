import { type HTMLAttributes } from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline'
type BadgeSize = 'sm' | 'md'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-amber-700 border-warning/20',
  danger: 'bg-danger/10 text-danger border-danger/20',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  outline: 'bg-white text-foreground border-border',
}

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
}

export function Badge({
  className = '',
  variant = 'default',
  size = 'sm',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full border
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  )
}

// Status badge for EOS rocks/issues
type StatusType = 'on_track' | 'off_track' | 'at_risk' | 'complete' | 'open' | 'identified' | 'discussed' | 'solved' | 'dropped'

const statusConfig: Record<StatusType, { label: string; variant: BadgeVariant }> = {
  on_track: { label: 'On Track', variant: 'success' },
  off_track: { label: 'Off Track', variant: 'danger' },
  at_risk: { label: 'At Risk', variant: 'warning' },
  complete: { label: 'Complete', variant: 'success' },
  open: { label: 'Open', variant: 'default' },
  identified: { label: 'Identified', variant: 'info' },
  discussed: { label: 'Discussed', variant: 'warning' },
  solved: { label: 'Solved', variant: 'success' },
  dropped: { label: 'Dropped', variant: 'default' },
}

interface StatusBadgeProps {
  status: StatusType
  size?: BadgeSize
  className?: string
}

export function StatusBadge({ status, size = 'sm', className = '' }: StatusBadgeProps) {
  const config = statusConfig[status]
  return (
    <Badge variant={config.variant} size={size} className={className}>
      {config.label}
    </Badge>
  )
}
