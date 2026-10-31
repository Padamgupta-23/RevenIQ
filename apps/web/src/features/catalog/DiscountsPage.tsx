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
  Tag,
  Plus,
  Edit2,
  Trash2,
  X,
  Calendar,
  CheckSquare,
  Square,
} from 'lucide-react';

interface Discount {
  id: string;
  name: string;
  type: 'FIXED' | 'PERCENTAGE';
  value: string;
  scope: 'PRODUCT' | 'SUBSCRIPTION';
  minPurchase: string | null;
  minQuantity: number | null;
  startDate: string;
  endDate: string;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  productIds: string[];
  products: Array<{
    id: string;
    name: string;
    salesPrice: string;
  }>;
  createdAt: string;
}

interface DiscountsResponse {
  data: Discount[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export function DiscountsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null);

  const [form, setForm] = useState({
    name: '',
    type: 'PERCENTAGE' as 'FIXED' | 'PERCENTAGE',
    value: 15.0,
    scope: 'SUBSCRIPTION' as 'PRODUCT' | 'SUBSCRIPTION',
    minPurchase: '' as string | number,
    minQuantity: '' as string | number,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
    usageLimit: '' as string | number,
    isActive: true,
    productIds: [] as string[],
  });

  // Fetch products for scope multi-select
  const { data: productsData } = useQuery({
    queryKey: ['products-for-discounts'],
    queryFn: async () => {
      const res = await apiClient.get('/products?pageSize=100&isActive=true');
      return res.data?.data || [];
    },
  });

  const { data, isLoading, isError, refetch } = useQuery<DiscountsResponse>({
    queryKey: ['discounts', page, pageSize, search, typeFilter, scopeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) params.append('search', search.trim());
      if (typeFilter) params.append('type', typeFilter);
      if (scopeFilter) params.append('scope', scopeFilter);
      if (statusFilter !== '') params.append('isActive', statusFilter);

      const res = await apiClient.get<DiscountsResponse>(`/discounts?${params.toString()}`);
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const body: any = {
        name: payload.name,
        type: payload.type,
        value: payload.value,
        scope: payload.scope,
        startDate: new Date(payload.startDate).toISOString(),
        endDate: new Date(payload.endDate).toISOString(),
        isActive: payload.isActive,
      };
      if (payload.minPurchase) body.minPurchase = Number(payload.minPurchase);
      if (payload.minQuantity) body.minQuantity = Number(payload.minQuantity);
      if (payload.usageLimit) body.usageLimit = Number(payload.usageLimit);
      if (payload.scope === 'PRODUCT') body.productIds = payload.productIds;

      const res = await apiClient.post('/discounts', body);
      return res.data;
    },
    onSuccess: () => {
      success('Discount rule created', 'Automated pricing discount active.');
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
    },
    onError: (err: any) => {
      error('Creation failed', err.response?.data?.error?.message || 'Could not create discount');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: typeof form }) => {
      const body: any = {
        name: payload.name,
        type: payload.type,
        value: payload.value,
        scope: payload.scope,
        startDate: new Date(payload.startDate).toISOString(),
        endDate: new Date(payload.endDate).toISOString(),
        isActive: payload.isActive,
      };
      body.minPurchase = payload.minPurchase ? Number(payload.minPurchase) : null;
      body.minQuantity = payload.minQuantity ? Number(payload.minQuantity) : null;
      body.usageLimit = payload.usageLimit ? Number(payload.usageLimit) : null;
      if (payload.scope === 'PRODUCT') body.productIds = payload.productIds;

      const res = await apiClient.patch(`/discounts/${id}`, body);
      return res.data;
    },
    onSuccess: () => {
      success('Discount rule updated', 'Changes saved successfully.');
      setModalOpen(false);
      setSelectedDiscount(null);
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
    },
    onError: (err: any) => {
      error('Update failed', err.response?.data?.error?.message || 'Could not update discount');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/discounts/${id}`);
      return res.data;
    },
    onSuccess: (data: any) => {
      success('Discount rule updated', data.data?.message || 'Discount processed.');
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
    },
    onError: (err: any) => {
      error('Delete failed', err.response?.data?.error?.message || 'Could not delete discount');
    },
  });

  const handleOpenEdit = (d: Discount) => {
    setSelectedDiscount(d);
    setForm({
      name: d.name,
      type: d.type,
      value: parseFloat(d.value),
      scope: d.scope,
      minPurchase: d.minPurchase ? parseFloat(d.minPurchase) : '',
      minQuantity: d.minQuantity || '',
      startDate: new Date(d.startDate).toISOString().split('T')[0],
      endDate: new Date(d.endDate).toISOString().split('T')[0],
      usageLimit: d.usageLimit || '',
      isActive: d.isActive,
      productIds: d.productIds || [],
    });
    setModalOpen(true);
  };

  const discountsList = data?.data || [];
  const meta = data?.meta || { page: 1, pageSize: 10, total: 0 };

  const columns: Column<Discount>[] = [
    {
      header: 'Discount Rule',
      cell: (d) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-olive-100 border border-olive-200 text-olive-900 flex items-center justify-center font-bold text-xs">
            <Tag className="w-4 h-4 text-olive-700" />
          </div>
          <div>
            <p className="font-bold text-olive-950 text-sm">{d.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cream-200 text-olive-900 border border-cream-300">
                {d.scope}
              </span>
              {d.scope === 'PRODUCT' && (
                <span className="text-[10px] text-olive-700 font-semibold">
                  {d.products?.length || 0} product(s) linked
                </span>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Benefit Value',
      cell: (d) => (
        <span className="font-mono font-bold text-olive-950 text-sm bg-cream-100 border border-cream-300 px-2.5 py-1 rounded-md">
          {d.type === 'PERCENTAGE' ? `${d.value}% Off` : `$${d.value} Flat`}
        </span>
      ),
    },
    {
      header: 'Usage Progress',
      cell: (d) => {
        const limit = d.usageLimit;
        const used = d.usedCount || 0;
        const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;

        return (
          <div className="w-36 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-olive-800">
              <span>{used} used</span>
              <span>{limit ? `/ ${limit}` : '∞ Unlimited'}</span>
            </div>
            {limit && (
              <div className="w-full bg-cream-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-olive-700 h-1.5 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>
        );
      },
    },
    {
      header: 'Validity Period',
      cell: (d) => (
        <div className="text-xs text-olive-800 font-medium flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-olive-500" />
          <span>
            {new Date(d.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            {' → '}
            {new Date(d.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (d) => (
        <StatusBadge
          status={d.isActive ? 'ACTIVE' : 'INACTIVE'}
          label={d.isActive ? 'Active' : 'Deactivated'}
        />
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (d) => {
        if (!isAdmin) return <span className="text-xs text-olive-400 italic">Read-only</span>;
        return (
          <div className="inline-flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenEdit(d)}
              className="h-8 px-2 text-olive-800 hover:bg-olive-100 rounded-md font-semibold text-xs flex items-center gap-1"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm(`Remove or deactivate discount "${d.name}"?`)) {
                  deleteMutation.mutate(d.id);
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
        title="Discounts & Coupons"
        description="Configure automated percentage discounts, fixed vouchers, product line scopes, and track global usage limits."
        badge="Discount Engine"
        badgeIcon={Tag}
        actions={
          isAdmin && (
            <Button
              onClick={() => {
                setSelectedDiscount(null);
                setForm({
                  name: '',
                  type: 'PERCENTAGE',
                  value: 15.0,
                  scope: 'SUBSCRIPTION',
                  minPurchase: '',
                  minQuantity: '',
                  startDate: new Date().toISOString().split('T')[0],
                  endDate: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
                  usageLimit: '',
                  isActive: true,
                  productIds: [],
                });
                setModalOpen(true);
              }}
              className="bg-olive-800 hover:bg-olive-900 text-white font-semibold px-5 py-2.5 rounded-lg shadow-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Discount
            </Button>
          )
        }
      />

      <DataTable
        columns={columns}
        data={discountsList}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        search={{
          value: search,
          onChange: (val) => {
            setSearch(val);
            setPage(1);
          },
          placeholder: 'Search discount name...',
        }}
        filtersSlot={
          <>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 px-3 rounded-lg border border-cream-300 bg-cream-50/50 text-xs text-olive-950 font-medium focus:outline-none focus:border-olive-500"
            >
              <option value="">All Types</option>
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED">Fixed Amount</option>
            </select>

            <select
              value={scopeFilter}
              onChange={(e) => {
                setScopeFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 px-3 rounded-lg border border-cream-300 bg-cream-50/50 text-xs text-olive-950 font-medium focus:outline-none focus:border-olive-500"
            >
              <option value="">All Scopes</option>
              <option value="SUBSCRIPTION">Whole Subscription</option>
              <option value="PRODUCT">Specific Products</option>
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
          icon: Tag,
          title: 'No discount rules configured',
          description: 'Create promotional rules with fixed or percentage savings for invoices and plans.',
        }}
      />

      {/* CREATE / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border-2 border-olive-200 max-w-lg w-full p-6 shadow-xl relative my-8 animate-in fade-in">
            <div className="flex items-center justify-between pb-3.5 border-b border-cream-200 mb-4">
              <h3 className="font-serif font-bold text-lg text-olive-950">
                {selectedDiscount ? 'Edit Discount Rule' : 'Create Discount Rule'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (selectedDiscount) {
                  updateMutation.mutate({ id: selectedDiscount.id, payload: form });
                } else {
                  createMutation.mutate(form);
                }
              }}
              className="space-y-4"
            >
              <div>
                <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                  Rule Name *
                </Label>
                <Input
                  required
                  placeholder="e.g. VIP Launch Special 15%"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="bg-cream-50/50 border-cream-300"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                    Type *
                  </Label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                    className="w-full h-10 px-2 rounded-lg border border-cream-300 bg-cream-50/50 text-xs font-semibold text-olive-950 focus:outline-none focus:border-olive-500"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Fixed Amount ($)</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                    {form.type === 'PERCENTAGE' ? 'Percent (≤100) *' : 'Amount ($) *'}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={form.type === 'PERCENTAGE' ? 100 : undefined}
                    required
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: parseFloat(e.target.value) || 0 })}
                    className="bg-cream-50/50 border-cream-300"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                    Scope *
                  </Label>
                  <select
                    value={form.scope}
                    onChange={(e) => setForm({ ...form, scope: e.target.value as any })}
                    className="w-full h-10 px-2 rounded-lg border border-cream-300 bg-cream-50/50 text-xs font-semibold text-olive-950 focus:outline-none focus:border-olive-500"
                  >
                    <option value="SUBSCRIPTION">Whole Subscription</option>
                    <option value="PRODUCT">Selected Products</option>
                  </select>
                </div>
              </div>

              {/* Product Multi-Select (shown only for PRODUCT scope) */}
              {form.scope === 'PRODUCT' && (
                <div className="p-3.5 rounded-xl bg-cream-100/60 border border-cream-300 space-y-2">
                  <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider block">
                    Linked Products * (Select which items receive this discount)
                  </Label>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 border border-cream-300 rounded-lg p-2 bg-white">
                    {(productsData || []).map((p: any) => {
                      const isSelected = form.productIds.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            const next = isSelected
                              ? form.productIds.filter((id) => id !== p.id)
                              : [...form.productIds, p.id];
                            setForm({ ...form, productIds: next });
                          }}
                          className="flex items-center gap-2 p-1.5 rounded hover:bg-cream-50 cursor-pointer text-xs select-none"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-olive-800 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-stone-300 shrink-0" />
                          )}
                          <span className="font-semibold text-olive-950">{p.name}</span>
                          <span className="text-olive-600 font-mono text-[11px]">(${p.salesPrice})</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                    Min Purchase ($)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={form.minPurchase}
                    onChange={(e) => setForm({ ...form, minPurchase: e.target.value })}
                    className="bg-cream-50/50 border-cream-300 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                    Min Quantity
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="1"
                    value={form.minQuantity}
                    onChange={(e) => setForm({ ...form, minQuantity: e.target.value })}
                    className="bg-cream-50/50 border-cream-300 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                    Usage Limit
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={form.usageLimit}
                    onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                    className="bg-cream-50/50 border-cream-300 text-xs"
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
                    Valid Until Date *
                  </Label>
                  <Input
                    type="date"
                    required
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="bg-cream-50/50 border-cream-300"
                  />
                </div>
              </div>

              <div className="pt-1">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                  label="Discount Active"
                  description="When active, the engine checks eligibility during invoice generation"
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
                  {selectedDiscount ? 'Save Changes' : 'Create Discount'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

