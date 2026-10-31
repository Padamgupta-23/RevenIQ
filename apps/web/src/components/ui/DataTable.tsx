import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Loader2,
  PackageOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  header: React.ReactNode;
  accessorKey?: keyof T;
  cell?: (row: T, index: number) => React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export interface DataTablePagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor?: (row: T, index: number) => string;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  pagination?: DataTablePagination;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  filtersSlot?: React.ReactNode;
  actionsSlot?: React.ReactNode;
  emptyState?: {
    icon?: React.ElementType;
    title?: string;
    description?: string;
    action?: {
      label: string;
      onClick?: () => void;
      href?: string;
    };
  };
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  isError = false,
  onRetry,
  pagination,
  search,
  filtersSlot,
  actionsSlot,
  emptyState,
  className,
}: DataTableProps<T>) {
  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1;

  const hasControls = search || filtersSlot || actionsSlot;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search & Filters Toolbar */}
      {hasControls && (
        <Card className="border border-cream-300 bg-white shadow-sm">
          <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {search && (
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-olive-600 pointer-events-none" />
                  <Input
                    placeholder={search.placeholder || 'Search records...'}
                    value={search.value}
                    onChange={(e) => search.onChange(e.target.value)}
                    className="pl-9 bg-cream-50/50 border-cream-300 text-sm focus:border-olive-500 rounded-lg"
                  />
                </div>
              )}
              {filtersSlot && <div className="flex items-center gap-2 flex-wrap">{filtersSlot}</div>}
            </div>

            {actionsSlot && <div className="flex items-center gap-2 shrink-0">{actionsSlot}</div>}
          </div>
        </Card>
      )}

      {/* Main Table Container */}
      <Card className="border border-cream-300 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-cream-200 bg-cream-50/75 text-[11px] font-bold uppercase tracking-wider text-olive-800/80">
                {columns.map((col, index) => (
                  <th
                    key={index}
                    className={cn(
                      'py-3.5 px-4',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      col.className
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-cream-200 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="py-14 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2.5 text-olive-600" />
                    <p className="text-xs text-olive-800 font-semibold">Loading data...</p>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={columns.length} className="py-10 px-4">
                    <ErrorState onRetry={onRetry} />
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-12 px-4">
                    <EmptyState
                      icon={emptyState?.icon || PackageOpen}
                      title={emptyState?.title || 'No records found'}
                      description={
                        emptyState?.description ||
                        'There are no entries matching your current filters.'
                      }
                      action={emptyState?.action}
                    />
                  </td>
                </tr>
              ) : (
                data.map((row, rowIndex) => {
                  const key = keyExtractor
                    ? keyExtractor(row, rowIndex)
                    : (row as any).id || rowIndex;

                  return (
                    <tr
                      key={key}
                      className="hover:bg-cream-50/60 transition-colors group"
                    >
                      {columns.map((col, colIndex) => {
                        let content: React.ReactNode = null;
                        if (col.cell) {
                          content = col.cell(row, rowIndex);
                        } else if (col.accessorKey) {
                          content = String(row[col.accessorKey] ?? '');
                        }

                        return (
                          <td
                            key={colIndex}
                            className={cn(
                              'py-3.5 px-4',
                              col.align === 'right' && 'text-right',
                              col.align === 'center' && 'text-center',
                              col.className
                            )}
                          >
                            {content}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Footer */}
        {pagination && (
          <div className="p-4 border-t border-cream-200 bg-cream-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-olive-800">
            <div>
              Showing{' '}
              <span className="font-bold text-olive-950">
                {pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1}
              </span>{' '}
              to{' '}
              <span className="font-bold text-olive-950">
                {Math.min(pagination.page * pagination.pageSize, pagination.total)}
              </span>{' '}
              of <span className="font-bold text-olive-950">{pagination.total}</span> records
            </div>

            <div className="flex items-center gap-3">
              {pagination.onPageSizeChange && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-olive-700">Rows:</span>
                  <select
                    value={pagination.pageSize}
                    onChange={(e) => pagination.onPageSizeChange!(Number(e.target.value))}
                    className="h-7 px-2 text-xs rounded border border-cream-300 bg-white font-semibold text-olive-950"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              )}

              <span className="font-medium text-olive-700">
                Page <span className="font-bold text-olive-950">{pagination.page}</span> of{' '}
                <span className="font-bold text-olive-950">{totalPages}</span>
              </span>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1 || isLoading}
                  onClick={() => pagination.onPageChange(Math.max(1, pagination.page - 1))}
                  className="h-8 w-8 p-0 border-cream-300 text-olive-800 hover:bg-cream-100"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= totalPages || isLoading}
                  onClick={() => pagination.onPageChange(pagination.page + 1)}
                  className="h-8 w-8 p-0 border-cream-300 text-olive-800 hover:bg-cream-100"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

