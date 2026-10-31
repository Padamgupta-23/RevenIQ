import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import apiClient from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  CreditCard,
  Play,
  Eye,
  Printer,
  Calendar,
  AlertCircle,
  X,
  Sparkles,
} from 'lucide-react';

interface Invoice {
  id: string;
  number: string;
  subscriptionId: string;
  customerId: string;
  status: 'DRAFT' | 'CONFIRMED' | 'PAID' | 'CANCELLED';
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  balance: string;
  isOverdue: boolean;
  sentAt: string | null;
  customer?: {
    id: string;
    name: string;
    email: string;
    company: string | null;
  };
  subscription?: {
    id: string;
    number: string;
    plan?: {
      name: string;
      billingPeriod: string;
    };
  };
}

interface InvoicesResponse {
  data: Invoice[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export function InvoicesPage() {
  const { user } = useAuth();
  const isAdminOrStaff = user?.role === 'ADMIN' || user?.role === 'STAFF';
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Billing Run Modal State
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [billingResult, setBillingResult] = useState<{
    created: number;
    skipped: number;
    failed: any[];
  } | null>(null);

  // 1. Fetch Invoices
  const { data, isLoading } = useQuery<InvoicesResponse>({
    queryKey: ['invoices', page, pageSize, search, statusFilter, overdueOnly],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (overdueOnly) params.append('overdue', 'true');

      const res = await apiClient.get(`/invoices?${params.toString()}`);
      return res.data;
    },
  });

  // Run Billing Mutation
  const runBillingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/billing/run', {});
      return res.data?.data;
    },
    onSuccess: (resData) => {
      setBillingResult(resData);
      setIsBillingModalOpen(true);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      success('Billing Run Finished', `Generated ${resData.created} invoices.`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.message || 'Failed to execute billing run';
      error('Billing Run Error', msg);
    },
  });

  const handlePrint = async (invoiceId: string) => {
    // Open window synchronously on user click to prevent popup blockers
    const printWindow = window.open('about:blank', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head><title>Loading Invoice...</title></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #FAF8F2; color: #2F3A21;">
            <div style="text-align: center;">
              <h3 style="margin-bottom: 8px;">Preparing Printable Invoice...</h3>
              <p style="font-size: 13px; color: #5A6F3F;">Please wait while the invoice document is rendered.</p>
            </div>
          </body>
        </html>
      `);
    }

    try {
      const res = await apiClient.get(`/invoices/${invoiceId}/print`, {
        responseType: 'text',
      });
      if (printWindow && !printWindow.closed) {
        printWindow.document.open();
        printWindow.document.write(res.data);
        printWindow.document.close();
        printWindow.focus();
      } else {
        const blob = new Blob([res.data], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const w = window.open(url, '_blank');
        if (!w) {
          const iframe = document.createElement('iframe');
          iframe.style.position = 'fixed';
          iframe.style.right = '0';
          iframe.style.bottom = '0';
          iframe.style.width = '0';
          iframe.style.height = '0';
          iframe.style.border = '0';
          document.body.appendChild(iframe);
          iframe.contentDocument?.open();
          iframe.contentDocument?.write(res.data);
          iframe.contentDocument?.close();
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => document.body.removeChild(iframe), 2000);
        }
      }
    } catch {
      if (printWindow && !printWindow.closed) {
        printWindow.close();
      }
      error('Print Error', 'Failed to load printable invoice view.');
    }
  };

  const columns: Column<Invoice>[] = [
    {
      header: 'Invoice #',
      accessorKey: 'number',
      cell: (inv) => (
        <Link
          to={`/invoices/${inv.id}`}
          className="font-mono font-bold text-olive-900 hover:text-olive-700 hover:underline flex items-center gap-1.5"
        >
          <CreditCard className="w-3.5 h-3.5 text-olive-600" />
          <span>{inv.number}</span>
        </Link>
      ),
    },
    {
      header: 'Customer',
      accessorKey: 'customer',
      cell: (inv) => (
        <div>
          <span className="font-semibold text-olive-950 block">
            {inv.customer?.name || 'Customer'}
          </span>
          <span className="text-xs text-olive-700/80">{inv.customer?.email}</span>
        </div>
      ),
    },
    {
      header: 'Period & Due',
      accessorKey: 'issueDate',
      cell: (inv) => (
        <div className="text-xs text-olive-900">
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-olive-600" />
            <span>Due {new Date(inv.dueDate).toLocaleDateString()}</span>
          </div>
          <span className="text-[11px] text-olive-700 block mt-0.5">
            Period: {new Date(inv.periodStart).toLocaleDateString()} &ndash;{' '}
            {new Date(inv.periodEnd).toLocaleDateString()}
          </span>
        </div>
      ),
    },
    {
      header: 'Total / Balance',
      accessorKey: 'total',
      cell: (inv) => (
        <div>
          <span className="font-mono font-bold text-olive-950 block">${inv.total}</span>
          <span
            className={`text-xs font-mono font-semibold block ${
              parseFloat(inv.balance) > 0 ? 'text-rose-600' : 'text-emerald-700'
            }`}
          >
            Due: ${inv.balance}
          </span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (inv) => (
        <StatusBadge
          status={inv.isOverdue ? 'OVERDUE' : inv.status}
          label={inv.isOverdue ? 'Overdue' : undefined}
        />
      ),
    },
    {
      header: 'Actions',
      accessorKey: 'id',
      className: 'text-right',
      cell: (inv) => (
        <div className="flex items-center justify-end gap-1.5">
          <Link to={`/invoices/${inv.id}`}>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-olive-700 hover:text-olive-950 hover:bg-olive-100"
              title="View Invoice"
            >
              <Eye className="w-4 h-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handlePrint(inv.id)}
            className="h-8 w-8 p-0 text-olive-700 hover:text-olive-950 hover:bg-olive-100"
            title="Print Invoice"
          >
            <Printer className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Invoices & Recurring Billing"
        description="Monitor automated recurring billing runs, reconcile receivables, print invoices, and track overdue accounts."
        actions={
          isAdminOrStaff && (
            <Button
              onClick={() => runBillingMutation.mutate()}
              disabled={runBillingMutation.isPending}
              className="bg-olive-800 hover:bg-olive-900 text-white font-semibold px-4 py-2.5 rounded-lg shadow-sm flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{runBillingMutation.isPending ? 'Running Batch...' : 'Run Billing'}</span>
            </Button>
          )
        }
      />

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 text-sm rounded-lg border border-cream-300 bg-white text-olive-950 font-medium focus:ring-2 focus:ring-olive-500/20 focus:border-olive-600 transition-colors shadow-2xs"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="PAID">Paid</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <button
          type="button"
          onClick={() => {
            setOverdueOnly(!overdueOnly);
            setPage(1);
          }}
          className={`h-10 px-3.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 shadow-2xs ${
            overdueOnly
              ? 'bg-rose-50 border-rose-300 text-rose-800 ring-2 ring-rose-200'
              : 'bg-white border-cream-300 text-olive-900 hover:bg-cream-50'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          <span>Overdue Only</span>
        </button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data?.data || []}
        isLoading={isLoading}
        search={{
          value: search,
          onChange: (val: string) => {
            setSearch(val);
            setPage(1);
          },
          placeholder: 'Search invoices by number or customer name...',
        }}
        pagination={{
          page,
          pageSize,
          total: data?.meta?.total || 0,
          onPageChange: (newPage) => setPage(newPage),
          onPageSizeChange: (newPageSize) => {
            setPageSize(newPageSize);
            setPage(1);
          },
        }}
        emptyState={{
          icon: CreditCard,
          title: 'No Invoices Found',
          description: 'Click "Run Billing" above to trigger recurring invoice creation for active subscriptions.',
        }}
      />

      {/* BILLING RUN RESULT SUMMARY MODAL */}
      {isBillingModalOpen && billingResult && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-cream-300 shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-cream-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-olive-100 border border-olive-200 text-olive-800 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-olive-700" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-olive-950">
                    Billing Cycle Run Complete
                  </h3>
                  <p className="text-xs text-olive-700/80">Batch processing execution summary</p>
                </div>
              </div>
              <button
                onClick={() => setIsBillingModalOpen(false)}
                className="p-1 rounded-lg text-olive-700 hover:text-olive-950"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <span className="text-2xl font-bold font-mono text-emerald-900 block">
                  {billingResult.created}
                </span>
                <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">
                  Created
                </span>
              </div>

              <div className="p-3 bg-cream-100 border border-cream-300 rounded-xl text-center">
                <span className="text-2xl font-bold font-mono text-olive-900 block">
                  {billingResult.skipped}
                </span>
                <span className="text-[11px] font-semibold text-olive-800 uppercase tracking-wider">
                  Skipped
                </span>
              </div>

              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
                <span className="text-2xl font-bold font-mono text-rose-900 block">
                  {billingResult.failed.length}
                </span>
                <span className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider">
                  Failed
                </span>
              </div>
            </div>

            {billingResult.failed.length > 0 && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1 max-h-32 overflow-y-auto">
                <span className="text-xs font-bold text-rose-900 block">Failure Log:</span>
                {billingResult.failed.map((f, i) => (
                  <p key={i} className="text-[11px] text-rose-800">
                    &bull; Sub #{f.subscriptionNumber || f.subscriptionId}: {f.error}
                  </p>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setIsBillingModalOpen(false)}
                className="bg-olive-800 hover:bg-olive-900 text-white font-semibold text-xs px-4"
              >
                Dismiss Summary
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
