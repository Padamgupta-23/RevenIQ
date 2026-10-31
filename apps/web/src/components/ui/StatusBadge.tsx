import { cn } from '@/lib/utils';

export type BadgeStatus =
  // Subscriptions
  | 'DRAFT'
  | 'QUOTATION'
  | 'CONFIRMED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'CLOSED'
  // Invoices
  | 'PAID'
  | 'CANCELLED'
  | 'OVERDUE'
  // Roles
  | 'ADMIN'
  | 'STAFF'
  | 'CUSTOMER'
  // User status
  | 'INACTIVE';

interface StatusBadgeProps {
  status: BadgeStatus | string;
  className?: string;
  dot?: boolean;
  label?: string;
}

export function StatusBadge({ status, className, dot = true, label }: StatusBadgeProps) {
  const normalized = (status || '').toUpperCase() as BadgeStatus;

  // Colors strictly conforming to AGENTS.md Section 12:
  // "Draft grey, Quotation blue, Confirmed indigo, Active green, Paused amber, Closed slate; Invoice Paid green, Overdue red"
  let colorClasses = 'bg-stone-100 text-stone-700 border-stone-300';
  let dotColor = 'bg-stone-500';

  switch (normalized) {
    case 'DRAFT':
      colorClasses = 'bg-stone-100 text-stone-700 border-stone-300';
      dotColor = 'bg-stone-500';
      break;

    case 'QUOTATION':
    case 'CUSTOMER':
      colorClasses = 'bg-sky-50 text-sky-800 border-sky-300';
      dotColor = 'bg-sky-500';
      break;

    case 'CONFIRMED':
    case 'ADMIN':
      colorClasses = 'bg-indigo-50 text-indigo-800 border-indigo-300';
      dotColor = 'bg-indigo-500';
      break;

    case 'ACTIVE':
    case 'STAFF':
      colorClasses = 'bg-emerald-50 text-emerald-900 border-emerald-300';
      dotColor = 'bg-emerald-600';
      break;

    case 'PAUSED':
      colorClasses = 'bg-amber-50 text-amber-900 border-amber-300';
      dotColor = 'bg-amber-600';
      break;

    case 'CLOSED':
      colorClasses = 'bg-slate-100 text-slate-800 border-slate-300';
      dotColor = 'bg-slate-500';
      break;

    case 'PAID':
      colorClasses = 'bg-emerald-50 text-emerald-900 border-emerald-300';
      dotColor = 'bg-emerald-600';
      break;

    case 'OVERDUE':
      colorClasses = 'bg-rose-50 text-rose-800 border-rose-300';
      dotColor = 'bg-rose-600';
      break;

    case 'CANCELLED':
    case 'INACTIVE':
      colorClasses = 'bg-stone-100 text-stone-600 border-stone-300';
      dotColor = 'bg-stone-400';
      break;

    default:
      colorClasses = 'bg-cream-100 text-olive-900 border-cream-300';
      dotColor = 'bg-olive-600';
      break;
  }

  const displayText = label || normalized;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase border transition-colors shadow-2xs',
        colorClasses,
        className
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor)} />}
      <span>{displayText}</span>
    </span>
  );
}
