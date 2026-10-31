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
  Layers,
  Plus,
  Edit2,
  Trash2,
  X,
  Calendar,
  ShieldCheck,
} from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  price: string;
  billingPeriod: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  minQuantity: number;
  startDate: string;
  endDate: string | null;
  autoClose: boolean;
  closable: boolean;
  pausable: boolean;
  renewable: boolean;
  isActive: boolean;
  createdAt: string;
}

interface PlansResponse {
  data: Plan[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export function PlansPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const [form, setForm] = useState({
    name: '',
    price: 199.0,
    billingPeriod: 'MONTHLY' as 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY',
    minQuantity: 1,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    autoClose: false,
    closable: true,
    pausable: false,
    renewable: true,
    isActive: true,
  });

  const { data, isLoading, isError, refetch } = useQuery<PlansResponse>({
    queryKey: ['plans', page, pageSize, search, periodFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) params.append('search', search.trim());
      if (periodFilter) params.append('billingPeriod', periodFilter);
      if (statusFilter !== '') params.append('isActive', statusFilter);

      const res = await apiClient.get<PlansResponse>(`/plans?${params.toString()}`);
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const res = await apiClient.post('/plans', {
        ...payload,
        endDate: payload.endDate ? new Date(payload.endDate).toISOString() : null,
      });
      return res.data;
    },
    onSuccess: () => {
      success('Plan created', 'Subscription plan configured successfully.');
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
    onError: (err: any) => {
      error('Creation failed', err.response?.data?.error?.message || 'Could not create plan');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: typeof form }) => {
      const res = await apiClient.patch(`/plans/${id}`, {
        ...payload,
        endDate: payload.endDate ? new Date(payload.endDate).toISOString() : null,
      });
      return res.data;
    },
    onSuccess: () => {
      success('Plan updated', 'Subscription plan configuration saved.');
      setModalOpen(false);
      setSelectedPlan(null);
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
    onError: (err: any) => {
      error('Update failed', err.response?.data?.error?.message || 'Could not update plan');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/plans/${id}`);
      return res.data;
    },
    onSuccess: (data: any) => {
      success('Plan status updated', data.data?.message || 'Plan deleted successfully.');
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
    onError: (err: any) => {
      error('Delete failed', err.response?.data?.error?.message || 'Could not delete plan');
    },
  });

  const handleOpenEdit = (plan: Plan) => {
    setSelectedPlan(plan);
    setForm({
      name: plan.name,
      price: parseFloat(plan.price),
      billingPeriod: plan.billingPeriod,
      minQuantity: plan.minQuantity,
      startDate: new Date(plan.startDate).toISOString().split('T')[0],
      endDate: plan.endDate ? new Date(plan.endDate).toISOString().split('T')[0] : '',
      autoClose: plan.autoClose,
      closable: plan.closable,
      pausable: plan.pausable,
      renewable: plan.renewable,
      isActive: plan.isActive,
    });
    setModalOpen(true);
  };

  const plansList = data?.data || [];
  const meta = data?.meta || { page: 1, pageSize: 10, total: 0 };

  const columns: Column<Plan>[] = [
    {
      header: 'Plan Name',
      cell: (p) => (
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-olive-100 border border-olive-200 text-olive-900 flex items-center justify-center font-bold text-xs">
            <Layers className="w-4.5 h-4.5 text-olive-700" />
          </div>
          <div>
            <p className="font-bold text-olive-950 text-sm">{p.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cream-200 text-olive-900 border border-cream-300">
                {p.billingPeriod}
              </span>
              <span className="text-[11px] text-olive-700 font-medium">
                Min Qty: {p.minQuantity}
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Base Price',
      cell: (p) => (
        <span className="font-mono font-bold text-olive-950 text-base">
          ${p.price}
        </span>
      ),
    },
    {
      header: 'State Policies',
      cell: (p) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          {p.renewable && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
              Renewable
            </span>
          )}
          {p.pausable && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold">
              Pausable
            </span>
          )}
          {p.closable && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-50 text-slate-800 border border-slate-200 font-bold">
              Closable
            </span>
          )}
          {p.autoClose && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-bold">
              Auto-Close
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Validity Period',
      cell: (p) => (
        <div className="text-xs text-olive-800 font-medium flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-olive-500" />
          <span>
            {new Date(p.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            {p.endDate ? ` → ${new Date(p.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : ' (Ongoing)'}
          </span>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (p) => (
        <StatusBadge
          status={p.isActive ? 'ACTIVE' : 'INACTIVE'}
          label={p.isActive ? 'Active' : 'Deactivated'}
        />
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (p) => {
        if (!isAdmin) return <span className="text-xs text-olive-400 italic">Read-only</span>;
        return (
          <div className="inline-flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenEdit(p)}
              className="h-8 px-2 text-olive-800 hover:bg-olive-100 rounded-md font-semibold text-xs flex items-center gap-1"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm(`Remove or deactivate plan "${p.name}"?`)) {
                  deleteMutation.mutate(p.id);
                }
              }}
              className="h-8 px-2 text-rose-700 hover:bg-rose-50 rounded-md font-semibold text-xs flex items-center gap-1"
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
        title="Subscription Plans"
        description="Define recurring billing cycles, minimum quantity rules, expiration constraints, and lifecycle state flags."
        badge="Plan Engine"
        badgeIcon={ShieldCheck}
        actions={
          isAdmin && (
            <Button
              onClick={() => {
                setSelectedPlan(null);
                setForm({
                  name: '',
                  price: 199.0,
                  billingPeriod: 'MONTHLY',
                  minQuantity: 1,
                  startDate: new Date().toISOString().split('T')[0],
                  endDate: '',
                  autoClose: false,
                  closable: true,
                  pausable: false,
                  renewable: true,
                  isActive: true,
                });
                setModalOpen(true);
              }}
              className="bg-olive-800 hover:bg-olive-900 text-white font-semibold px-5 py-2.5 rounded-lg shadow-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Plan
            </Button>
          )
        }
      />

      <DataTable
        columns={columns}
        data={plansList}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        search={{
          value: search,
          onChange: (val) => {
            setSearch(val);
            setPage(1);
          },
          placeholder: 'Search plan name...',
        }}
        filtersSlot={
          <>
            <select
              value={periodFilter}
              onChange={(e) => {
                setPeriodFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 px-3 rounded-lg border border-cream-300 bg-cream-50/50 text-xs text-olive-950 font-medium focus:outline-none focus:border-olive-500"
            >
              <option value="">All Periods</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </select>

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
          </>
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
          icon: Layers,
          title: 'No subscription plans configured',
          description: 'Create your first recurring subscription plan to start issuing quotes.',
        }}
      />

      {/* CREATE / EDIT PLAN MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border-2 border-olive-200 max-w-lg w-full p-6 shadow-xl relative my-8 animate-in fade-in">
            <div className="flex items-center justify-between pb-3.5 border-b border-cream-200 mb-4">
              <h3 className="font-serif font-bold text-lg text-olive-950">
                {selectedPlan ? 'Edit Subscription Plan' : 'Create Subscription Plan'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (selectedPlan) {
                  updateMutation.mutate({ id: selectedPlan.id, payload: form });
                } else {
                  createMutation.mutate(form);
                }
              }}
              className="space-y-4"
            >
              <div>
                <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                  Plan Name *
                </Label>
                <Input
                  required
                  placeholder="e.g. Enterprise Monthly Tier"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="bg-cream-50/50 border-cream-300"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                    Price ($) *
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                    className="bg-cream-50/50 border-cream-300"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                    Billing Period *
                  </Label>
                  <select
                    value={form.billingPeriod}
                    onChange={(e) => setForm({ ...form, billingPeriod: e.target.value as any })}
                    className="w-full h-10 px-2 rounded-lg border border-cream-300 bg-cream-50/50 text-xs font-semibold text-olive-950 focus:outline-none focus:border-olive-500"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                    Min Quantity *
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    required
                    value={form.minQuantity}
                    onChange={(e) => setForm({ ...form, minQuantity: parseInt(e.target.value, 10) || 1 })}
                    className="bg-cream-50/50 border-cream-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                    Valid From Date *
                  </Label>
                  <Input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="bg-cream-50/50 border-cream-300"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                    Valid Until (Optional)
                  </Label>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="bg-cream-50/50 border-cream-300"
                  />
                </div>
              </div>

              {/* Lifecycle State Policy Switches */}
              <div className="p-4 rounded-xl bg-cream-100/60 border border-cream-300 space-y-3.5 mt-2">
                <p className="text-xs font-bold text-olive-900 uppercase tracking-wider">
                  Lifecycle State Machine Rules (AGENTS.md Section 8)
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <Switch
                    checked={form.renewable}
                    onCheckedChange={(checked) => setForm({ ...form, renewable: checked })}
                    label="Renewable"
                    description="Extends expiry / next term"
                  />

                  <Switch
                    checked={form.pausable}
                    onCheckedChange={(checked) => setForm({ ...form, pausable: checked })}
                    label="Pausable"
                    description="Allows customer pause transition"
                  />

                  <Switch
                    checked={form.closable}
                    onCheckedChange={(checked) => setForm({ ...form, closable: checked })}
                    label="Closable"
                    description="Allows early cancellation"
                  />

                  <Switch
                    checked={form.autoClose}
                    onCheckedChange={(checked) => setForm({ ...form, autoClose: checked })}
                    label="Auto-Close"
                    description="Closes on expiryDate pass"
                  />
                </div>
              </div>

              <div className="pt-1">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                  label="Active Tier"
                  description="Available in quotation generation and customer portal"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-cream-200 mt-5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                  className="border-cream-300 text-olive-800 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-olive-800 hover:bg-olive-900 text-white text-xs font-semibold px-5"
                >
                  {selectedPlan ? 'Save Changes' : 'Create Plan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

