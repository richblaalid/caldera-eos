# Component Patterns

Common component patterns for Ember.

---

## UI Primitives

### Button

```tsx
// components/ui/Button.tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading,
  children,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';

  const variants = {
    primary: 'bg-primary text-white hover:bg-primary/90 focus:ring-primary',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500',
    ghost: 'hover:bg-gray-100 focus:ring-gray-500',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className} disabled:opacity-50`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <Spinner className="mr-2 h-4 w-4" /> : null}
      {children}
    </button>
  );
}
```

### Card

```tsx
// components/ui/Card.tsx
interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={`rounded-lg border bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 border-b pb-4">{children}</div>;
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-medium">{children}</h3>;
}

export function CardContent({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
```

### Badge

```tsx
// components/ui/Badge.tsx
type BadgeVariant = 'default' | 'success' | 'warning' | 'error';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  const variants = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}
```

---

## EOS Components

### RockCard

```tsx
// components/RockCard.tsx
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { Rock } from '@/types';

interface RockCardProps {
  rock: Rock;
}

export function RockCard({ rock }: RockCardProps) {
  const statusVariant = {
    on_track: 'success',
    off_track: 'error',
    complete: 'default',
  } as const;

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-medium">{rock.title}</h4>
          <p className="text-sm text-gray-500">{rock.owner.name}</p>
        </div>
        <Badge variant={statusVariant[rock.status]}>
          {rock.status.replace('_', ' ')}
        </Badge>
      </div>
      {rock.milestones && (
        <div className="mt-4">
          <div className="h-2 rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${rock.progress}%` }}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
```

### IssueCard

```tsx
// components/IssueCard.tsx
interface IssueCardProps {
  issue: Issue;
  onStatusChange?: (status: IssueStatus) => void;
}

export function IssueCard({ issue, onStatusChange }: IssueCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h4 className="font-medium">{issue.title}</h4>
          {issue.description && (
            <p className="mt-1 text-sm text-gray-500 line-clamp-2">
              {issue.description}
            </p>
          )}
        </div>
        <PriorityIndicator priority={issue.priority} />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {formatDate(issue.createdAt)}
        </span>
        <StatusSelect
          value={issue.status}
          onChange={onStatusChange}
          options={['open', 'discussed', 'solved']}
        />
      </div>
    </Card>
  );
}
```

---

## State Patterns

### Loading State

```tsx
export function RockList() {
  const { rocks, isLoading, error } = useRocks();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error) {
    return <ErrorMessage error={error} />;
  }

  if (rocks.length === 0) {
    return (
      <EmptyState
        title="No rocks yet"
        description="Create your first quarterly rock to get started."
        action={<Button>Create Rock</Button>}
      />
    );
  }

  return (
    <div className="space-y-4">
      {rocks.map((rock) => (
        <RockCard key={rock.id} rock={rock} />
      ))}
    </div>
  );
}
```

### Empty State

```tsx
// components/EmptyState.tsx
interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="mb-4 text-gray-400">{icon}</div>}
      <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
```

---

## Layout Patterns

### Page Layout

```tsx
// app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 p-8">{children}</main>
    </div>
  );
}
```

### Section with Header

```tsx
interface SectionProps {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function Section({ title, action, children }: SectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
```
