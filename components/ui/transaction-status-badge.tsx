import { cn } from '@/lib/utils'

type Status = 'completed' | 'pending' | 'failed'

const STATUS_STYLES: Record<Status, string> = {
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

const STATUS_LABELS: Record<Status, string> = {
  completed: 'Completed',
  pending: 'Pending',
  failed: 'Failed',
}

interface TransactionStatusBadgeProps {
  status: Status
  className?: string
}

export function TransactionStatusBadge({ status, className }: TransactionStatusBadgeProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      data-testid="transaction-status-badge"
      data-status={status}
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        STATUS_STYLES[status] ?? STATUS_STYLES.failed,
        className,
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
