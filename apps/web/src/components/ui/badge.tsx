import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/10 text-primary hover:bg-primary/20',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive/10 text-destructive',
        outline: 'text-foreground border border-border',
        // Domain specific status badges per AGENTS.md section 12
        draft: 'bg-slate-100 text-slate-700 border-slate-200',
        quotation: 'bg-blue-50 text-blue-700 border-blue-200',
        confirmed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        paused: 'bg-amber-50 text-amber-700 border-amber-200',
        closed: 'bg-slate-200 text-slate-800 border-slate-300',
        paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        overdue: 'bg-rose-50 text-rose-700 border-rose-200',
        olive: 'bg-olive-100 text-olive-800 border-olive-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

