import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Layers,
  Calendar,
  Pause,
  Play,
  RotateCw,
  XCircle,
} from 'lucide-react';

interface PortalSubscription {
  id: string;
  number: string;
  status: 'DRAFT' | 'QUOTATION' | 'CONFIRMED' | 'ACTIVE' | 'PAUSED' | 'CLOSED';
  startDate: string;
  expiryDate: string;
  nextBillingDate: string | null;
  paymentTermDays: number;
  plan: {
    id: string;
    name: string;
    price: string;
    billingPeriod: string;
    pausable: boolean;
    closable: boolean;
    renewable: boolean;
  };
  lines: {
    id: string;
    productName: string;
    quantity: number;
    unitPrice: string;
    amount: string;
  }[];
  createdAt: string;
}

export function PortalSubscriptionsPage() {
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading } = useQuery<{
    data: PortalSubscription[];
    meta: { page: number; pageSize: number; total: number };
  }>({
    queryKey: ['portal-subscriptions', page, pageSize],
    queryFn: async () => {
      const res = await apiClient.get(`/portal/subscriptions?page=${page}&pageSize=${pageSize}`);
      return res.data;
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      return apiClient.post(`/portal/subscriptions/${id}/${action}`);
    },
    onSuccess: (_, vars) => {
      success('Action Executed', `Subscription successfully updated (${vars.action}).`);
      queryClient.invalidateQueries({ queryKey: ['portal-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
    onError: (err: any, vars) => {
      const msg = err.response?.data?.error?.message || `Failed to execute ${vars.action}`;
      error('Portal Action Error', msg);
    },
  });

  const columns: Column<PortalSubscription>[] = [
    {
      header: 'Subscription #',
      accessorKey: 'number',
      cell: (sub) => (
        <div className="font-mono font-bold text-olive-950 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-olive-600" />
          <span>{sub.number}</span>
        </div>
      ),
    },
    {
      header: 'Plan & Billing',
      accessorKey: 'plan',
      cell: (sub) => (
        <div>
          <span className="font-bold text-olive-950 block">{sub.plan.name}</span>
          <span className="text-xs text-olive-700 font-mono">
            ${sub.plan.price} / {sub.plan.billingPeriod.toLowerCase()}
          </span>
        </div>
      ),
    },
    {
      header: 'Active Term',
      accessorKey: 'startDate',
      cell: (sub) => (
        <div className="text-xs text-olive-900">
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-olive-600" />
            <span>{new Date(sub.startDate).toLocaleDateString()}</span>
            <span className="text-stone-400">&rarr;</span>
            <span>{new Date(sub.expiryDate).toLocaleDateString()}</span>
          </div>
          {sub.nextBillingDate && (
            <span className="text-[11px] text-stone-500 block mt-0.5">
              Next billing: {new Date(sub.nextBillingDate).toLocaleDateString()}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (sub) => <StatusBadge status={sub.status} />,
    },
    {
      header: 'Allowed Actions',
      accessorKey: 'id',
      className: 'text-right',
      cell: (sub) => {
        const canPause = sub.status === 'ACTIVE' && sub.plan.pausable;
        const canResume = sub.status === 'PAUSED' && sub.plan.pausable;
        const canClose = sub.status !== 'CLOSED' && sub.plan.closable;
        const canRenew = sub.status !== 'CLOSED' && sub.plan.renewable;

        return (
          <div className="flex items-center justify-end gap-1.5">
            {canPause && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => actionMutation.mutate({ id: sub.id, action: 'pause' })}
                disabled={actionMutation.isPending}
                className="h-7 text-xs border-amber-300 text-amber-900 hover:bg-amber-50"
              >
                <Pause className="w-3 h-3 mr-1" /> Pause
              </Button>
            )}

            {canResume && (
              <Button
                size="sm"
                onClick={() => actionMutation.mutate({ id: sub.id, action: 'resume' })}
                disabled={actionMutation.isPending}
                className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                <Play className="w-3 h-3 mr-1" /> Resume
              </Button>
            )}

            {canRenew && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => actionMutation.mutate({ id: sub.id, action: 'renew' })}
                disabled={actionMutation.isPending}
                className="h-7 text-xs border-olive-300 text-olive-900 hover:bg-cream-100"
              >
                <RotateCw className="w-3 h-3 mr-1" /> Renew
              </Button>
            )}

            {canClose && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => actionMutation.mutate({ id: sub.id, action: 'close' })}
                disabled={actionMutation.isPending}
                className="h-7 text-xs border-rose-300 text-rose-700 hover:bg-rose-50"
              >
                <XCircle className="w-3 h-3 mr-1" /> Close
              </Button>
            )}

            {!canPause && !canResume && !canRenew && !canClose && (
              <span className="text-xs text-stone-400 italic">No self-actions</span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="My Subscriptions"
        description="View your active tier subscriptions, renewal schedules, and contract controls."
      />

      <DataTable
        columns={columns}
        data={data?.data || []}
        isLoading={isLoading}
        pagination={{
          page,
          pageSize,
          total: data?.meta?.total || 0,
          onPageChange: setPage,
          onPageSizeChange: (newSize) => {
            setPageSize(newSize);
            setPage(1);
          },
        }}
        emptyState={{
          title: 'No Active Subscriptions',
          description: 'You do not have any active subscriptions registered to your account yet.',
        }}
      />
    </div>
  );
}

