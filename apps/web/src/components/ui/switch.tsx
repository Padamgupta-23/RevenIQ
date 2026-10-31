import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
  description?: string;
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, onCheckedChange, label, description, disabled, ...props }, ref) => {
    return (
      <label className={cn('flex items-start gap-3 cursor-pointer select-none', disabled && 'opacity-50 cursor-not-allowed', className)}>
        <div className="relative inline-flex items-center shrink-0 mt-0.5">
          <input
            type="checkbox"
            className="sr-only"
            ref={ref}
            checked={checked}
            disabled={disabled}
            onChange={(e) => onCheckedChange?.(e.target.checked)}
            {...props}
          />
          <div
            className={cn(
              'w-11 h-6 rounded-full transition-colors duration-200 ease-in-out border border-cream-300',
              checked ? 'bg-olive-800' : 'bg-cream-200'
            )}
          />
          <div
            className={cn(
              'absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out',
              checked ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </div>
        {(label || description) && (
          <div className="text-left">
            {label && <p className="text-xs font-bold text-olive-950 uppercase tracking-wider">{label}</p>}
            {description && <p className="text-[11px] text-olive-700 font-normal">{description}</p>}
          </div>
        )}
      </label>
    );
  }
);

Switch.displayName = 'Switch';

