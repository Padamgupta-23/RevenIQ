import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Receipt,
  Plus,
  Edit2,
  Trash2,
  X,
  Percent,
} from 'lucide-react';

interface Tax {
  id: string;
  name: string;
  rate: string;
  isActive: boolean;
  createdAt: string;
}

interface TaxesResponse {
  data: Tax[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export function TaxesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Dialogs
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedTax, setSelectedTax] = useState<Tax | null>(null);

  const [form, setForm] = useState({
    name: '',
    rate: 18.0,
    isActive: true,
  });

  const { data, isLoading, isError, refetch } = useQuery<TaxesResponse>({
    queryKey: ['taxes', page, pageSize, search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) params.append('search', search.trim());
      if (statusFilter !== '') params.append('isActive', statusFilter);

      const res = await apiClient.get<TaxesResponse>(`/taxes?${params.toString()}`);
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const res = await apiClient.post('/taxes', payload);
      return res.data;
    },
    onSuccess: () => {
      success('Tax created', 'New tax rate rule configured successfully.');
      setCreateModalOpen(false);
      setForm({ name: '', rate: 18.0, isActive: true });
      queryClient.invalidateQueries({ queryKey: ['taxes'] });
    },
    onError: (err: any) => {
      error('Creation failed', err.response?.data?.error?.message || 'Could not create tax');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: typeof form }) => {
      const res = await apiClient.patch(`/taxes/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      success('Tax updated', 'Tax configuration updated successfully.');
      setEditModalOpen(false);
      setSelectedTax(null);
      queryClient.invalidateQueries({ queryKey: ['taxes'] });
    },
    onError: (err: any) => {
      error('Update failed', err.response?.data?.error?.message || 'Could not update tax');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/taxes/${id}`);
      return res.data;
    },
    onSuccess: (data: any) => {
      success('Action completed', data.data?.message || 'Tax rate processed successfully.');
      queryClient.invalidateQueries({ queryKey: ['taxes'] });
    },
    onError: (err: any) => {
      error('Delete failed', err.response?.data?.error?.message || 'Could not delete tax');
    },
  });

  const handleOpenEdit = (tax: Tax) => {
    setSelectedTax(tax);
    setForm({
      name: tax.name,
      rate: parseFloat(tax.rate),
      isActive: tax.isActive,
    });
    setEditModalOpen(true);
  };

  const taxesList = data?.data || [];
  const meta = data?.meta || { page: 1, pageSize: 10, total: 0 };

  const columns: Column<Tax>[] = [
    {
      header: 'Tax Name',
      cell: (t) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-olive-100 border border-olive-200 text-olive-800 flex items-center justify-center">
            <Percent className="w-4 h-4 text-olive-700" />
          </div>
          <div>
            <p className="font-bold text-olive-950 text-sm">{t.name}</p>
            <p className="text-[11px] text-olive-700 font-medium">Automatic invoice line snapshot</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Tax Rate',
      cell: (t) => (
        <span className="font-mono font-bold text-olive-950 text-sm bg-cream-100 border border-cream-300 px-2.5 py-1 rounded-md">
          {t.rate}%
        </span>
      ),
    },
    {
      header: 'Status',
      cell: (t) => (
        <StatusBadge
          status={t.isActive ? 'ACTIVE' : 'INACTIVE'}
          label={t.isActive ? 'Active' : 'Deactivated'}
        />
      ),
    },
    {
      header: 'Configured On',
      cell: (t) => (
        <span className="text-xs text-olive-700 font-medium">
          {new Date(t.createdAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (t) => {
        if (!isAdmin) return <span className="text-xs text-olive-400 italic">Read-only</span>;
        return (
          <div className="inline-flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenEdit(t)}
              className="h-8 px-2.5 text-olive-800 hover:text-olive-950 hover:bg-olive-100 rounded-md font-semibold text-xs flex items-center gap-1"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm(`Remove or deactivate "${t.name}"?`)) {
                  deleteMutation.mutate(t.id);
                }
              }}
              className="h-8 px-2.5 text-rose-700 hover:text-rose-800 hover:bg-rose-50 rounded-md font-semibold text-xs flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Taxes & Rates"
        description="Configure standardized sales taxes, VAT, and GST rates automatically calculated on subscriptions and invoices."
        badge="Tax Engine"
        badgeIcon={Receipt}
        actions={
          isAdmin && (
            <Button
              onClick={() => {
                setForm({ name: '', rate: 18.0, isActive: true });
                setCreateModalOpen(true);
              }}
              className="bg-olive-800 hover:bg-olive-900 text-white font-semibold px-5 py-2.5 rounded-lg shadow-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Tax Rate
            </Button>
          )
        }
      />

      <DataTable
        columns={columns}
        data={taxesList}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        search={{
          value: search,
          onChange: (val) => {
            setSearch(val);
            setPage(1);
          },
          placeholder: 'Search tax name...',
        }}
        filtersSlot={
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 px-3 rounded-lg border border-cream-300 bg-cream-50/50 text-xs text-olive-950 font-medium focus:outline-none focus:border-olive-500"
          >
            <option value="">All Statuses</option>
            <option value="true">Active Only</option>
            <option value="false">Deactivated Only</option>
          </select>
        }
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
          icon: Receipt,
          title: 'No tax rates configured',
          description: 'Define your first tax rate (e.g. GST 18%, VAT 20%) to attach to catalog items.',
        }}
      />

      {/* CREATE MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border-2 border-olive-200 max-w-md w-full p-6 shadow-xl relative animate-in fade-in">
            <div className="flex items-center justify-between pb-3.5 border-b border-cream-200 mb-4">
              <h3 className="font-serif font-bold text-lg text-olive-950">Add Tax Rate</h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate(form);
              }}
              className="space-y-4"
            >
              <div>
                <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                  Tax Name *
                </Label>
                <Input
                  required
                  placeholder="e.g. GST 18% or Standard VAT"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="bg-cream-50/50 border-cream-300"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                  Rate Percentage (%) *
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  placeholder="18.00"
                  value={form.rate}
                  onChange={(e) => setForm({ ...form, rate: parseFloat(e.target.value) || 0 })}
                  className="bg-cream-50/50 border-cream-300"
                />
              </div>

              <div className="pt-2">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                  label="Active Status"
                  description="Available for immediate assignment on products & subscriptions"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-cream-200 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateModalOpen(false)}
                  className="border-cream-300 text-olive-800 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-olive-800 hover:bg-olive-900 text-white text-xs font-semibold px-5"
                >
                  {createMutation.isPending ? 'Saving...' : 'Create Tax Rate'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editModalOpen && selectedTax && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border-2 border-olive-200 max-w-md w-full p-6 shadow-xl relative animate-in fade-in">
            <div className="flex items-center justify-between pb-3.5 border-b border-cream-200 mb-4">
              <h3 className="font-serif font-bold text-lg text-olive-950">Edit Tax Rate</h3>
              <button onClick={() => setEditModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate({ id: selectedTax.id, payload: form });
              }}
              className="space-y-4"
            >
              <div>
                <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                  Tax Name *
                </Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="bg-cream-50/50 border-cream-300"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                  Rate Percentage (%) *
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  value={form.rate}
                  onChange={(e) => setForm({ ...form, rate: parseFloat(e.target.value) || 0 })}
                  className="bg-cream-50/50 border-cream-300"
                />
              </div>

              <div className="pt-2">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                  label="Active Status"
                  description="When deactivated, existing invoices preserve historical rates"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-cream-200 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditModalOpen(false)}
                  className="border-cream-300 text-olive-800 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="bg-olive-800 hover:bg-olive-900 text-white text-xs font-semibold px-5"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

