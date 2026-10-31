import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { CreditCard, Calendar, Printer } from 'lucide-react';

interface PortalInvoice {
  id: string;
  number: string;
  subscriptionNumber: string | null;
  status: 'DRAFT' | 'CONFIRMED' | 'PAID' | 'CANCELLED';
  isOverdue: boolean;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
  total: string;
  amountPaid: string;
  balance: string;
  createdAt: string;
}

export function PortalInvoicesPage() {
  const { error } = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading } = useQuery<{
    data: PortalInvoice[];
    meta: { page: number; pageSize: number; total: number };
  }>({
    queryKey: ['portal-invoices', page, pageSize],
    queryFn: async () => {
      const res = await apiClient.get(`/portal/invoices?page=${page}&pageSize=${pageSize}`);
      return res.data;
    },
  });

  const handlePrint = async (invoiceId: string) => {
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

  const columns: Column<PortalInvoice>[] = [
    {
      header: 'Invoice #',
      accessorKey: 'number',
      cell: (inv) => (
        <div className="font-mono font-bold text-olive-950 flex items-center gap-1.5">
          <CreditCard className="w-3.5 h-3.5 text-olive-600" />
          <span>{inv.number}</span>
        </div>
      ),
    },
    {
      header: 'Billing Period & Due',
      accessorKey: 'issueDate',
      cell: (inv) => (
        <div className="text-xs text-olive-900">
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-olive-600" />
            <span>Due {new Date(inv.dueDate).toLocaleDateString()}</span>
          </div>
          <span className="text-[11px] text-stone-500 block mt-0.5">
            Period: {new Date(inv.periodStart).toLocaleDateString()} &rarr;{' '}
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
          <span className="text-xs font-mono font-semibold text-rose-700">
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePrint(inv.id)}
            className="h-8 px-2.5 text-xs border-olive-300 text-olive-900 hover:bg-cream-100 flex items-center gap-1"
          >
            <Printer className="w-3.5 h-3.5 text-olive-700" /> Print
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="My Invoices"
        description="Review past invoices, receipts, and payment confirmations."
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
          title: 'No Invoices Found',
          description: 'No billing invoices have been issued to your customer account yet.',
        }}
      />
    </div>
  );
}

