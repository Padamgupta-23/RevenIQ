import React from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { PackageOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  children?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = PackageOpen,
  title,
  description,
  action,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'p-12 text-center rounded-2xl border-2 border-dashed border-cream-300 bg-cream-50/40 flex flex-col items-center justify-center max-w-lg mx-auto',
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-olive-100 border border-olive-200 text-olive-800 flex items-center justify-center mb-4 shadow-2xs">
        <Icon className="w-7 h-7 text-olive-700" />
      </div>

      <h3 className="font-serif font-bold text-lg text-olive-950 mb-1.5">{title}</h3>

      {description && (
        <p className="text-sm text-olive-700 font-normal max-w-sm mb-6 leading-relaxed">
          {description}
        </p>
      )}

      {action && (
        <div>
          {action.href ? (
            <Link to={action.href}>
              <Button className="bg-olive-800 hover:bg-olive-900 text-white font-semibold text-xs px-5 py-2.5 rounded-lg shadow-sm">
                {action.label}
              </Button>
            </Link>
          ) : (
            <Button
              onClick={action.onClick}
              className="bg-olive-800 hover:bg-olive-900 text-white font-semibold text-xs px-5 py-2.5 rounded-lg shadow-sm"
            >
              {action.label}
            </Button>
          )}
        </div>
      )}

      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

