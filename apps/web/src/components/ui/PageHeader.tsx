import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: string;
  badgeIcon?: React.ElementType;
  actions?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  className?: string;
}

export function PageHeader({
  title,
  description,
  badge,
  badgeIcon: BadgeIcon,
  actions,
  breadcrumbs,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-2xl bg-gradient-to-br from-cream-100 via-white to-olive-100/60 border-2 border-olive-200/90 shadow-sm',
        className
      )}
    >
      <div className="space-y-1.5 max-w-3xl">
        {/* Optional Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-xs text-olive-700/80 mb-2">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.label}>
                {idx > 0 && <ChevronRight className="w-3 h-3 text-olive-400" />}
                {crumb.href ? (
                  <Link
                    to={crumb.href}
                    className="hover:text-olive-950 font-medium transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="font-semibold text-olive-950">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        {/* Optional Badge / Pill */}
        {badge && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-olive-100 border border-olive-300 text-olive-900 text-xs font-semibold mb-1 shadow-2xs">
            {BadgeIcon && <BadgeIcon className="w-3.5 h-3.5 text-olive-700 shrink-0" />}
            <span>{badge}</span>
          </div>
        )}

        {/* Title */}
        <h1 className="text-2xl md:text-3xl font-serif font-bold text-olive-950 tracking-tight">
          {title}
        </h1>

        {/* Description */}
        {description && (
          <p className="text-sm text-olive-800/90 leading-relaxed font-normal">
            {description}
          </p>
        )}
      </div>

      {/* Action Buttons Slot */}
      {actions && (
        <div className="flex flex-wrap items-center gap-3 shrink-0 pt-2 md:pt-0">
          {actions}
        </div>
      )}
    </div>
  );
}

