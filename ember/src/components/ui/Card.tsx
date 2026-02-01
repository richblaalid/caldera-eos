import { type HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outline' | 'ghost'
}

export function Card({
  className = '',
  variant = 'default',
  children,
  ...props
}: CardProps) {
  const variantStyles = {
    default: 'bg-background border border-border shadow-sm',
    outline: 'bg-background border border-border',
    ghost: 'bg-transparent',
  }

  return (
    <div
      className={`rounded-xl ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

type CardHeaderProps = HTMLAttributes<HTMLDivElement>

export function CardHeader({ className = '', children, ...props }: CardHeaderProps) {
  return (
    <div
      className={`px-6 py-4 border-b border-border ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}

export function CardTitle({
  className = '',
  as: Component = 'h3',
  children,
  ...props
}: CardTitleProps) {
  return (
    <Component
      className={`font-semibold text-foreground ${className}`}
      {...props}
    >
      {children}
    </Component>
  )
}

type CardDescriptionProps = HTMLAttributes<HTMLParagraphElement>

export function CardDescription({ className = '', children, ...props }: CardDescriptionProps) {
  return (
    <p className={`text-sm text-muted-foreground ${className}`} {...props}>
      {children}
    </p>
  )
}

type CardContentProps = HTMLAttributes<HTMLDivElement>

export function CardContent({ className = '', children, ...props }: CardContentProps) {
  return (
    <div className={`px-6 py-4 ${className}`} {...props}>
      {children}
    </div>
  )
}

type CardFooterProps = HTMLAttributes<HTMLDivElement>

export function CardFooter({ className = '', children, ...props }: CardFooterProps) {
  return (
    <div
      className={`px-6 py-4 border-t border-border ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
