import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Users,
  Building,
  Phone,
  Mail,
  FileText,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface Customer {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  phone: string | null;
  company: string | null;
  address: string | null;
  createdAt: string;
}

interface CustomersResponse {
  data: Customer[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export function CustomersPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch } = useQuery<CustomersResponse>({
    queryKey: ['customers', page, pageSize, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        role: 'CUSTOMER',
      });
      if (search.trim()) params.append('search', search.trim());

      const res = await apiClient.get<CustomersResponse>(`/users?${params.toString()}`);
      return res.data;
    },
  });

  const customers = data?.data || [];
  const meta = data?.meta || { page: 1, pageSize: 10, total: 0 };

  const columns: Column<Customer>[] = [
    {
      header: 'Customer',
      cell: (c) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-cream-200 border border-cream-300 text-olive-950 font-bold text-xs flex items-center justify-center shrink-0">
            {c.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-olive-950 truncate">{c.name}</p>
            <p className="text-xs text-olive-700 font-medium flex items-center gap-1 mt-0.5 truncate">
              <Mail className="w-3 h-3 text-olive-500" /> {c.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: 'Organization & Address',
      cell: (c) => (
        <div className="text-xs text-olive-800">
          {c.company ? (
            <div className="font-semibold text-olive-950 flex items-center gap-1">
              <Building className="w-3 h-3 text-olive-500" /> {c.company}
            </div>
          ) : (
            <span className="text-olive-400 italic">Individual client</span>
          )}
          {c.address && (
            <div className="text-olive-600 truncate max-w-xs mt-0.5">{c.address}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Contact Phone',
      cell: (c) => (
        <div className="text-xs text-olive-800">
          {c.phone ? (
            <div className="font-medium text-olive-900 flex items-center gap-1">
              <Phone className="w-3 h-3 text-olive-500" /> {c.phone}
            </div>
          ) : (
            <span className="text-olive-400 italic">&mdash;</span>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (c) => (
        <StatusBadge
          status={c.isActive ? 'ACTIVE' : 'INACTIVE'}
          label={c.isActive ? 'Active' : 'Deactivated'}
        />
      ),
    },
    {
      header: 'Member Since',
      cell: (c) => (
        <span className="text-xs text-olive-700 font-medium">
          {new Date(c.createdAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      ),
    },
    {
      header: 'Subscriptions',
      align: 'right',
      cell: (c) => (
        <Link to={`/subscriptions?customerId=${c.id}`}>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-olive-800 hover:text-olive-950 hover:bg-olive-100 rounded-md font-semibold text-xs inline-flex items-center gap-1"
          >
            <FileText className="w-3.5 h-3.5" /> Subscriptions
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Customers & Accounts"
        description="Directory of active and registered customer accounts, organizations, contact points, and subscription profiles."
        badge="Customer Directory"
        badgeIcon={Users}
      />

      <DataTable
        columns={columns}
        data={customers}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        search={{
          value: search,
          onChange: (val) => {
            setSearch(val);
            setPage(1);
          },
          placeholder: 'Search customers by name, email, company...',
        }}
        pagination={{
          page: meta.page,
          pageSize: meta.pageSize,
          total: meta.total,
          onPageChange: (newPage) => setPage(newPage),
          onPageSizeChange: (newPageSize) => {
            setPageSize(newPageSize);
            setPage(1);
          },
        }}
        emptyState={{
          icon: Users,
          title: 'No customers registered yet',
          description:
            'New signups through the public portal will automatically appear in this directory.',
        }}
      />
    </div>
  );
}
