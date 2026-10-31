import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  icon?: React.ElementType;
  className?: string;
}

export function ErrorState({
  title = 'Failed to load data',
  description = 'An error occurred while communicating with the RevenIQ backend. Please verify your connection and try again.',
  onRetry,
  retryLabel = 'Try Again',
  icon: Icon = AlertCircle,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'p-10 text-center rounded-2xl border-2 border-rose-200 bg-rose-50/40 flex flex-col items-center justify-center max-w-lg mx-auto',
        className
      )}
    >
      <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center mb-3.5 shadow-2xs">
        <Icon className="w-6 h-6 text-rose-700" />
      </div>

      <h3 className="font-serif font-bold text-lg text-rose-950 mb-1">{title}</h3>

      {description && (
        <p className="text-xs text-rose-800/90 font-medium max-w-sm mb-5 leading-relaxed">
          {description}
        </p>
      )}

      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          className="border-2 border-rose-300 bg-white hover:bg-rose-100 text-rose-900 font-semibold text-xs px-4 py-2 rounded-lg inline-flex items-center gap-1.5 shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

