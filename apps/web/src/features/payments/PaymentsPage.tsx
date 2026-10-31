import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import apiClient from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Calendar, User, FileText } from 'lucide-react';

interface Payment {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  method: string;
  amount: string;
  paymentDate: string;
  note: string | null;
  recordedBy: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
}

interface PaymentsResponse {
  data: Payment[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export function PaymentsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery<PaymentsResponse>({
    queryKey: ['payments-list', page, pageSize, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (search) params.append('search', search);

      const res = await apiClient.get(`/payments?${params.toString()}`);
      return res.data;
    },
  });

  const columns: Column<Payment>[] = [
    {
      header: 'Payment Date',
      accessorKey: 'paymentDate',
      cell: (p) => (
        <div className="flex items-center gap-1.5 text-xs text-olive-900 font-medium">
          <Calendar className="w-3.5 h-3.5 text-olive-600" />
          <span>{new Date(p.paymentDate).toLocaleDateString()}</span>
        </div>
      ),
    },
    {
      header: 'Invoice #',
      accessorKey: 'invoiceNumber',
      cell: (p) => (
        <Link
          to={`/invoices/${p.invoiceId}`}
          className="font-mono font-bold text-olive-900 hover:text-olive-700 hover:underline flex items-center gap-1"
        >
          <FileText className="w-3.5 h-3.5 text-olive-600" />
          <span>{p.invoiceNumber}</span>
        </Link>
      ),
    },
    {
      header: 'Customer',
      accessorKey: 'customerName',
      cell: (p) => (
        <div>
          <span className="font-semibold text-olive-950 block">{p.customerName}</span>
          <span className="text-xs text-stone-500">{p.customerEmail}</span>
        </div>
      ),
    },
    {
      header: 'Method',
      accessorKey: 'method',
      cell: (p) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-olive-100 text-olive-800 border border-olive-200">
          {p.method}
        </span>
      ),
    },
    {
      header: 'Amount',
      accessorKey: 'amount',
      cell: (p) => (
        <span className="font-mono font-bold text-emerald-800 text-sm">
          ${p.amount}
        </span>
      ),
    },
    {
      header: 'Recorded By',
      accessorKey: 'recordedBy',
      cell: (p) => (
        <div className="flex items-center gap-1.5 text-xs text-stone-600">
          <User className="w-3 h-3 text-stone-400" />
          <span>{p.recordedBy?.name || 'Staff'}</span>
        </div>
      ),
    },
    {
      header: 'Notes',
      accessorKey: 'note',
      cell: (p) => (
        <span className="text-xs text-stone-500">
          {p.note || '&mdash;'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Payment Transactions"
        description="Audit ledger of customer payments, transaction settlements, and invoice reconciliations stored in the database."
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
          onPageSizeChange: (newSize: number) => {
            setPageSize(newSize);
            setPage(1);
          },
        }}
        search={{
          value: search,
          onChange: (val: string) => {
            setSearch(val);
            setPage(1);
          },
          placeholder: 'Search payments by invoice #, customer name, or memo...',
        }}
        emptyState={{
          title: 'No Payments Recorded',
          description: 'Transactions will be logged here as payments are received and applied against confirmed invoices.',
        }}
      />
    </div>
  );
}
