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
  FileText,
  Plus,
  Edit2,
  Trash2,
  X,
  Clock,
  Package,
  AlertCircle,
} from 'lucide-react';

interface TemplateLine {
  id?: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  product?: {
    id: string;
    name: string;
    type: string;
    salesPrice: string;
  };
  variant?: {
    id: string;
    attribute: string;
    value: string;
    extraPrice: string;
  } | null;
}

interface QuotationTemplate {
  id: string;
  name: string;
  planId: string;
  validityDays: number;
  isActive: boolean;
  plan?: {
    id: string;
    name: string;
    price: string;
    billingPeriod: string;
  };
  lines: TemplateLine[];
  createdAt: string;
}

interface TemplatesResponse {
  data: QuotationTemplate[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}

interface ProductVariant {
  id: string;
  productId: string;
  attribute: string;
  value: string;
  extraPrice: string;
}

interface Product {
  id: string;
  name: string;
  type: string;
  salesPrice: string;
  isActive: boolean;
  variants?: ProductVariant[];
}

interface Plan {
  id: string;
  name: string;
  price: string;
  billingPeriod: string;
  isActive: boolean;
}

export function TemplatesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<QuotationTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuotationTemplate | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    planId: string;
    validityDays: number;
    isActive: boolean;
    lines: {
      productId: string;
      variantId: string | null;
      quantity: number;
    }[];
  }>({
    name: '',
    planId: '',
    validityDays: 30,
    isActive: true,
    lines: [],
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // 1. Fetch Templates
  const { data, isLoading } = useQuery<TemplatesResponse>({
    queryKey: ['templates', page, pageSize, search, planFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (search) params.append('search', search);
      if (planFilter) params.append('planId', planFilter);
      if (statusFilter) params.append('isActive', statusFilter);

      const res = await apiClient.get(`/templates?${params.toString()}`);
      return res.data;
    },
  });

  // 2. Fetch Plans for selection
  const { data: plansData } = useQuery<{ data: Plan[] }>({
    queryKey: ['plans-list-all'],
    queryFn: async () => {
      const res = await apiClient.get('/plans?pageSize=100');
      return res.data;
    },
  });
  const plans = plansData?.data || [];

  // 3. Fetch Products with variants for lines editor
  const { data: productsData } = useQuery<{ data: Product[] }>({
    queryKey: ['products-list-all'],
    queryFn: async () => {
      const res = await apiClient.get('/products?pageSize=100');
      return res.data;
    },
  });
  const products = productsData?.data || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (payload: typeof formData) => {
      return apiClient.post('/templates', payload);
    },
    onSuccess: () => {
      success('Template Created', 'Quotation template was added successfully.');
      setIsCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.message || 'Failed to create template';
      error('Creation Error', msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: typeof formData }) => {
      return apiClient.put(`/templates/${id}`, payload);
    },
    onSuccess: () => {
      success('Template Updated', 'Quotation template was updated successfully.');
      setEditingTemplate(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.message || 'Failed to update template';
      error('Update Error', msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClient.delete(`/templates/${id}`);
    },
    onSuccess: () => {
      success('Template Deleted', 'Quotation template has been removed.');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.message || 'Failed to delete template';
      error('Deletion Error', msg);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      planId: plans[0]?.id || '',
      validityDays: 30,
      isActive: true,
      lines: products[0]
        ? [{ productId: products[0].id, variantId: null, quantity: 1 }]
        : [],
    });
    setFormErrors({});
  };

  const openCreateDialog = () => {
    resetForm();
    if (plans.length > 0 && products.length > 0) {
      setFormData({
        name: '',
        planId: plans[0].id,
        validityDays: 30,
        isActive: true,
        lines: [{ productId: products[0].id, variantId: null, quantity: 1 }],
      });
    }
    setIsCreateOpen(true);
  };

  const openEditDialog = (t: QuotationTemplate) => {
    setEditingTemplate(t);
    setFormData({
      name: t.name,
      planId: t.planId,
      validityDays: t.validityDays,
      isActive: t.isActive,
      lines: t.lines.map((l) => ({
        productId: l.productId,
        variantId: l.variantId || null,
        quantity: l.quantity,
      })),
    });
    setFormErrors({});
  };

  const handleLineChange = (
    index: number,
    field: 'productId' | 'variantId' | 'quantity',
    value: any
  ) => {
    const updated = [...formData.lines];
    if (field === 'productId') {
      updated[index] = {
        ...updated[index],
        productId: value,
        variantId: null, // Reset variant when product changes
      };
    } else {
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
    }
    setFormData({ ...formData, lines: updated });
  };

  const addLine = () => {
    if (products.length === 0) return;
    setFormData({
      ...formData,
      lines: [
        ...formData.lines,
        { productId: products[0].id, variantId: null, quantity: 1 },
      ],
    });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length <= 1) {
      error('Validation', 'A template must have at least one line item.');
      return;
    }
    const updated = formData.lines.filter((_, i) => i !== index);
    setFormData({ ...formData, lines: updated });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errs.name = 'Name must be at least 2 characters';
    }
    if (!formData.planId) {
      errs.planId = 'Please select a plan';
    }
    if (formData.validityDays < 1) {
      errs.validityDays = 'Validity must be at least 1 day';
    }
    if (formData.lines.length === 0) {
      errs.lines = 'Template must contain at least one line item';
    }
    formData.lines.forEach((l, idx) => {
      if (!l.productId) errs[`line_${idx}_product`] = 'Product required';
      if (!l.quantity || l.quantity < 1) errs[`line_${idx}_qty`] = 'Quantity >= 1';
    });
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, payload: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  // Helper to compute line price
  const getLinePreviewPrice = (productId: string, variantId: string | null) => {
    const p = products.find((prod) => prod.id === productId);
    if (!p) return '0.00';
    let price = parseFloat(p.salesPrice) || 0;
    if (variantId && p.variants) {
      const v = p.variants.find((v) => v.id === variantId);
      if (v) price += parseFloat(v.extraPrice) || 0;
    }
    return price.toFixed(2);
  };

  const columns: Column<QuotationTemplate>[] = [
    {
      header: 'Template Blueprint',
      accessorKey: 'name',
      cell: (t) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-olive-100 border border-olive-200 text-olive-800 flex items-center justify-center font-bold">
            <FileText className="w-4 h-4 text-olive-700" />
          </div>
          <div>
            <span className="font-semibold text-olive-950 block">{t.name}</span>
            <span className="text-xs text-olive-700/80">
              Created {new Date(t.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: 'Linked Plan',
      accessorKey: 'plan',
      cell: (t) => (
        <div>
          <span className="font-medium text-olive-900 block">
            {t.plan?.name || 'Unknown Plan'}
          </span>
          <span className="text-xs text-olive-700/80 font-mono">
            ${t.plan?.price} / {t.plan?.billingPeriod?.toLowerCase()}
          </span>
        </div>
      ),
    },
    {
      header: 'Quote Validity',
      accessorKey: 'validityDays',
      cell: (t) => (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-olive-900">
          <Clock className="w-3.5 h-3.5 text-olive-600" />
          <span>{t.validityDays} Days</span>
        </div>
      ),
    },
    {
      header: 'Line Items',
      accessorKey: 'lines',
      cell: (t) => (
        <div className="max-w-xs space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-olive-900">
            <Package className="w-3.5 h-3.5 text-olive-600" />
            <span>{t.lines.length} Line item{t.lines.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {t.lines.slice(0, 2).map((l, i) => (
              <span
                key={i}
                className="inline-block px-1.5 py-0.5 text-[11px] bg-cream-100 border border-cream-300 text-olive-900 rounded font-medium"
              >
                {l.quantity}× {l.product?.name || 'Product'}
                {l.variant ? ` (${l.variant.value})` : ''}
              </span>
            ))}
            {t.lines.length > 2 && (
              <span className="text-[11px] text-olive-700 font-medium">
                +{t.lines.length - 2} more
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'isActive',
      cell: (t) => (
        <StatusBadge
          status={t.isActive ? 'ACTIVE' : 'CLOSED'}
          label={t.isActive ? 'Active' : 'Inactive'}
        />
      ),
    },
    ...(isAdmin
      ? [
          {
            header: 'Actions',
            accessorKey: 'id' as keyof QuotationTemplate,
            className: 'text-right',
            cell: (t: QuotationTemplate) => (
              <div className="flex items-center justify-end gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditDialog(t)}
                  className="h-8 w-8 p-0 text-olive-700 hover:text-olive-950 hover:bg-olive-100/70"
                  title="Edit Template"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteTarget(t)}
                  className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  title="Delete Template"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Quotation Templates"
        description="Standardize subscription offerings with reusable templates configured with plans, validity periods, and multi-product lines."
        actions={
          isAdmin && (
            <Button
              onClick={openCreateDialog}
              className="bg-olive-800 hover:bg-olive-900 text-white font-medium shadow-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create Template</span>
            </Button>
          )
        }
      />

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
          placeholder: 'Search templates by blueprint name...',
        }}
        filtersSlot={
          <>
            <select
              value={planFilter}
              onChange={(e) => {
                setPlanFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 px-3 rounded-lg border border-cream-300 bg-cream-50/50 text-xs text-olive-950 font-medium focus:outline-none focus:border-olive-500"
            >
              <option value="">All Plans</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (${p.price}/{p.billingPeriod.toLowerCase()})
                </option>
              ))}
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
              <option value="false">Inactive Only</option>
            </select>
          </>
        }
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
          icon: FileText,
          title: 'No Quotation Templates Found',
          description: 'Create your first subscription quotation blueprint to automate sales quotes.',
        }}
      />

      {/* CREATE / EDIT DIALOG */}
      {(isCreateOpen || editingTemplate) && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-cream-300 shadow-2xl max-w-2xl w-full p-6 space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-cream-200 pb-4">
              <div>
                <h2 className="text-xl font-bold font-serif text-olive-950">
                  {editingTemplate ? 'Edit Quotation Template' : 'New Quotation Template'}
                </h2>
                <p className="text-xs text-olive-700/80 mt-0.5">
                  Configure subscription blueprint parameters and itemized service lines
                </p>
              </div>
              <button
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingTemplate(null);
                }}
                className="p-1 rounded-lg text-olive-700 hover:text-olive-950 hover:bg-olive-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Template Name */}
              <div className="space-y-1.5">
                <Label htmlFor="tpl-name" className="text-xs font-semibold text-olive-900">
                  Template Name *
                </Label>
                <Input
                  id="tpl-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Enterprise Cloud ERP Blueprint"
                  className={formErrors.name ? 'border-rose-500' : ''}
                />
                {formErrors.name && (
                  <p className="text-xs text-rose-600 font-medium">{formErrors.name}</p>
                )}
              </div>

              {/* Plan Picker & Validity Days */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-plan" className="text-xs font-semibold text-olive-900">
                    Linked Plan *
                  </Label>
                  <select
                    id="tpl-plan"
                    value={formData.planId}
                    onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                    className={`w-full h-10 px-3 text-sm rounded-lg border bg-white text-olive-950 font-medium focus:ring-2 focus:ring-olive-500/20 focus:border-olive-600 transition-colors shadow-2xs ${
                      formErrors.planId ? 'border-rose-500' : 'border-cream-300'
                    }`}
                  >
                    <option value="">Select a recurring plan...</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (${p.price} / {p.billingPeriod.toLowerCase()})
                      </option>
                    ))}
                  </select>
                  {formErrors.planId && (
                    <p className="text-xs text-rose-600 font-medium">{formErrors.planId}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tpl-validity" className="text-xs font-semibold text-olive-900">
                    Quotation Validity (Days) *
                  </Label>
                  <Input
                    id="tpl-validity"
                    type="number"
                    min="1"
                    value={formData.validityDays}
                    onChange={(e) =>
                      setFormData({ ...formData, validityDays: parseInt(e.target.value) || 1 })
                    }
                    className={formErrors.validityDays ? 'border-rose-500' : ''}
                  />
                  {formErrors.validityDays && (
                    <p className="text-xs text-rose-600 font-medium">{formErrors.validityDays}</p>
                  )}
                </div>
              </div>

              {/* Status Switch */}
              <div className="flex items-center justify-between p-3.5 bg-cream-50 rounded-xl border border-cream-200">
                <div>
                  <Label htmlFor="tpl-active" className="text-sm font-semibold text-olive-950 block">
                    Active Blueprint
                  </Label>
                  <p className="text-xs text-olive-700/80">
                    Active templates can be selected when drafting quotations and subscriptions
                  </p>
                </div>
                <Switch
                  id="tpl-active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>

              {/* Dynamic Line Items Editor */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-cream-200 pb-2">
                  <div>
                    <Label className="text-sm font-bold text-olive-950 block">
                      Line Items Blueprint ({formData.lines.length})
                    </Label>
                    <p className="text-xs text-olive-700/80">
                      Specify products, variants, and quantities included by default
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addLine}
                    className="border-olive-300 text-olive-900 hover:bg-olive-100 flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </Button>
                </div>

                {formErrors.lines && (
                  <p className="text-xs text-rose-600 font-medium">{formErrors.lines}</p>
                )}

                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {formData.lines.map((line, idx) => {
                    const selProduct = products.find((p) => p.id === line.productId);
                    const variants = selProduct?.variants || [];
                    const lineUnitPrice = getLinePreviewPrice(line.productId, line.variantId);
                    const lineTotal = (parseFloat(lineUnitPrice) * line.quantity).toFixed(2);

                    return (
                      <div
                        key={idx}
                        className="p-3 bg-cream-50/70 border border-cream-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-3"
                      >
                        {/* Product Picker */}
                        <div className="flex-1 w-full sm:w-auto">
                          <label className="text-[11px] font-semibold text-olive-800 block mb-1">
                            Product
                          </label>
                          <select
                            value={line.productId}
                            onChange={(e) => handleLineChange(idx, 'productId', e.target.value)}
                            className="w-full h-9 px-2 text-xs rounded-lg border border-cream-300 bg-white text-olive-950 font-medium"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (${p.salesPrice})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Variant Picker */}
                        <div className="w-full sm:w-44">
                          <label className="text-[11px] font-semibold text-olive-800 block mb-1">
                            Variant (Optional)
                          </label>
                          <select
                            value={line.variantId || ''}
                            onChange={(e) =>
                              handleLineChange(idx, 'variantId', e.target.value || null)
                            }
                            disabled={variants.length === 0}
                            className="w-full h-9 px-2 text-xs rounded-lg border border-cream-300 bg-white text-olive-950 font-medium disabled:opacity-50"
                          >
                            <option value="">Standard (No variant)</option>
                            {variants.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.attribute}: {v.value} (+${v.extraPrice})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Quantity */}
                        <div className="w-20">
                          <label className="text-[11px] font-semibold text-olive-800 block mb-1">
                            Qty
                          </label>
                          <Input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(e) =>
                              handleLineChange(idx, 'quantity', parseInt(e.target.value) || 1)
                            }
                            className="h-9 text-xs"
                          />
                        </div>

                        {/* Subtotal Preview */}
                        <div className="w-24 text-right">
                          <label className="text-[11px] font-semibold text-olive-800 block mb-1">
                            Est. Total
                          </label>
                          <span className="text-xs font-mono font-bold text-olive-950 block pt-1.5">
                            ${lineTotal}
                          </span>
                        </div>

                        {/* Delete Line */}
                        <div className="pt-5 sm:pt-4">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLine(idx)}
                            className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            title="Remove Line"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-cream-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingTemplate(null);
                  }}
                  className="border-cream-300 text-olive-900 hover:bg-cream-100"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-olive-800 hover:bg-olive-900 text-white font-medium shadow-sm"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving Blueprint...'
                    : editingTemplate
                    ? 'Update Blueprint'
                    : 'Create Blueprint'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-cream-300 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-olive-950 text-base">Delete Template Blueprint</h3>
                <p className="text-xs text-olive-700/80">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-sm text-olive-800 leading-relaxed">
              Are you sure you want to permanently delete quotation template{' '}
              <span className="font-bold text-olive-950">"{deleteTarget.name}"</span>?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                className="border-cream-300 text-olive-900 hover:bg-cream-100"
              >
                Cancel
              </Button>
              <Button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="bg-rose-600 hover:bg-rose-700 text-white font-medium"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Template'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
