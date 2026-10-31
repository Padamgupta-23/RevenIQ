import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PasswordRule {
  id: string;
  label: string;
  passed: boolean;
}

export function evaluatePassword(password: string): PasswordRule[] {
  return [
    {
      id: 'length',
      label: 'More than 8 characters (min 9)',
      passed: password.length > 8,
    },
    {
      id: 'uppercase',
      label: 'At least one uppercase letter',
      passed: /[A-Z]/.test(password),
    },
    {
      id: 'lowercase',
      label: 'At least one lowercase letter',
      passed: /[a-z]/.test(password),
    },
    {
      id: 'special',
      label: 'At least one special character (!@#$%^&*...)',
      passed: /[^a-zA-Z0-9]/.test(password),
    },
  ];
}

interface PasswordStrengthIndicatorProps {
  rules: PasswordRule[];
  showProgress?: boolean;
}

export function PasswordStrengthIndicator({
  rules,
  showProgress = true,
}: PasswordStrengthIndicatorProps) {
  const passedCount = rules.filter((r) => r.passed).length;
  const progressPercent = (passedCount / rules.length) * 100;

  return (
    <div className="space-y-3 pt-1">
      {showProgress && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Password security</span>
            <span
              className={cn(
                'font-medium',
                passedCount === 4 && 'text-olive-700',
                passedCount >= 2 && passedCount < 4 && 'text-amber-600',
                passedCount < 2 && 'text-muted-foreground'
              )}
            >
              {passedCount === 4
                ? 'Strong'
                : passedCount >= 2
                ? 'Moderate'
                : 'Incomplete'}
            </span>
          </div>
          <div className="h-1.5 w-full bg-cream-200 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300 rounded-full',
                passedCount === 4 && 'bg-olive-600',
                passedCount >= 2 && passedCount < 4 && 'bg-amber-500',
                passedCount < 2 && 'bg-rose-500'
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className={cn(
              'flex items-center gap-2 p-1.5 rounded-md transition-colors',
              rule.passed
                ? 'text-olive-800 bg-olive-50/80 font-medium'
                : 'text-muted-foreground/80 bg-cream-100/50'
            )}
          >
            <div
              className={cn(
                'w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors',
                rule.passed
                  ? 'bg-olive-600 text-white'
                  : 'border border-border bg-white text-muted-foreground'
              )}
            >
              {rule.passed ? (
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              ) : (
                <X className="w-2.5 h-2.5 opacity-40" />
              )}
            </div>
            <span className="leading-tight">{rule.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
