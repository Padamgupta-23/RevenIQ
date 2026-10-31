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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Layers,
  Plus,
  Calendar,
  Eye,
  X,
  Trash2,
  Sparkles,
  Edit2,
} from 'lucide-react';

interface SubscriptionLine {
  id?: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitPrice: string;
  taxId?: string | null;
  amount: string;
  product?: {
    id: string;
    name: string;
    salesPrice: string;
  };
  variant?: {
    id: string;
    attribute: string;
    value: string;
    extraPrice: string;
  } | null;
  tax?: {
    id: string;
    name: string;
    rate: string;
  } | null;
}

interface Subscription {
  id: string;
  number: string;
  customerId: string;
  planId: string;
  templateId: string | null;
  status: 'DRAFT' | 'QUOTATION' | 'CONFIRMED' | 'ACTIVE' | 'PAUSED' | 'CLOSED';
  startDate: string;
  expiryDate: string;
  nextBillingDate: string | null;
  paymentTermDays: number;
  quotationValidUntil: string | null;
  notes: string | null;
  customer?: {
    id: string;
    name: string;
    email: string;
    company: string | null;
  };
  plan?: {
    id: string;
    name: string;
    price: string;
    billingPeriod: string;
    minQuantity: number;
    pausable: boolean;
    closable: boolean;
    renewable: boolean;
  };
  lines: SubscriptionLine[];
  createdAt: string;
}

interface SubscriptionsResponse {
  data: Subscription[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export function SubscriptionsPage() {
  const { user } = useAuth();
  const isAdminOrStaff = user?.role === 'ADMIN' || user?.role === 'STAFF';
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // Form State for Manual Creation
  const [formData, setFormData] = useState<{
    customerId: string;
    planId: string;
    startDate: string;
    expiryDate: string;
    paymentTermDays: number;
    notes: string;
    lines: {
      productId: string;
      variantId: string | null;
      quantity: number;
      taxId: string | null;
    }[];
  }>({
    customerId: '',
    planId: '',
    startDate: new Date().toISOString().split('T')[0],
    expiryDate: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
    paymentTermDays: 15,
    notes: '',
    lines: [],
  });

  // Template Form State
  const [templateForm, setTemplateForm] = useState({
    templateId: '',
    customerId: '',
    startDate: new Date().toISOString().split('T')[0],
    expiryDate: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
    paymentTermDays: 15,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // 1. Fetch Subscriptions
  const { data, isLoading } = useQuery<SubscriptionsResponse>({
    queryKey: ['subscriptions', page, pageSize, search, statusFilter, planFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (planFilter) params.append('planId', planFilter);

      const res = await apiClient.get(`/subscriptions?${params.toString()}`);
      return res.data;
    },
  });

  // 2. Fetch Customers
  const { data: customersData } = useQuery<{ data: any[] }>({
    queryKey: ['customers-list-all'],
    queryFn: async () => {
      const res = await apiClient.get('/users?role=CUSTOMER&pageSize=100');
      return res.data;
    },
  });
  const customers = customersData?.data || [];

  // 3. Fetch Plans
  const { data: plansData } = useQuery<{ data: any[] }>({
    queryKey: ['plans-list-all'],
    queryFn: async () => {
      const res = await apiClient.get('/plans?pageSize=100');
      return res.data;
    },
  });
  const plans = plansData?.data || [];

  // 4. Fetch Products
  const { data: productsData } = useQuery<{ data: any[] }>({
    queryKey: ['products-list-all'],
    queryFn: async () => {
      const res = await apiClient.get('/products?pageSize=100');
      return res.data;
    },
  });
  const products = productsData?.data || [];

  // 5. Fetch Templates
  const { data: templatesData } = useQuery<{ data: any[] }>({
    queryKey: ['templates-list-active'],
    queryFn: async () => {
      const res = await apiClient.get('/templates?isActive=true&pageSize=100');
      return res.data;
    },
  });
  const templates = templatesData?.data || [];

  // Create Subscription Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: typeof formData) => {
      return apiClient.post('/subscriptions', payload);
    },
    onSuccess: () => {
      success('Subscription Created', 'New subscription draft created successfully.');
      setIsCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.message || 'Failed to create subscription';
      error('Creation Error', msg);
    },
  });

  // Create From Template Mutation
  const templateMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post(`/subscriptions/from-template/${templateForm.templateId}`, {
        customerId: templateForm.customerId,
        startDate: templateForm.startDate,
        expiryDate: templateForm.expiryDate,
        paymentTermDays: templateForm.paymentTermDays,
      });
    },
    onSuccess: () => {
      success('Quotation Created', 'Subscription quotation generated from template.');
      setIsTemplateModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.message || 'Failed to create from template';
      error('Template Error', msg);
    },
  });

  const resetForm = () => {
    setFormData({
      customerId: customers[0]?.id || '',
      planId: plans[0]?.id || '',
      startDate: new Date().toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
      paymentTermDays: 15,
      notes: '',
      lines: products[0]
        ? [{ productId: products[0].id, variantId: null, quantity: 1, taxId: null }]
        : [],
    });
    setFormErrors({});
  };

  const openCreateDialog = () => {
    resetForm();
    if (customers.length > 0 && plans.length > 0 && products.length > 0) {
      setFormData({
        customerId: customers[0].id,
        planId: plans[0].id,
        startDate: new Date().toISOString().split('T')[0],
        expiryDate: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
        paymentTermDays: 15,
        notes: '',
        lines: [
          {
            productId: products[0].id,
            variantId: null,
            quantity: plans[0].minQuantity || 1,
            taxId: products[0].taxId || null,
          },
        ],
      });
    }
    setIsCreateOpen(true);
  };

  const handleLineChange = (
    index: number,
    field: 'productId' | 'variantId' | 'quantity',
    value: any
  ) => {
    const updated = [...formData.lines];
    if (field === 'productId') {
      const selProd = products.find((p) => p.id === value);
      updated[index] = {
        ...updated[index],
        productId: value,
        variantId: null,
        taxId: selProd?.taxId || null,
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
    const selPlan = plans.find((p) => p.id === formData.planId);
    setFormData({
      ...formData,
      lines: [
        ...formData.lines,
        {
          productId: products[0].id,
          variantId: null,
          quantity: selPlan?.minQuantity || 1,
          taxId: products[0].taxId || null,
        },
      ],
    });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length <= 1) {
      error('Validation', 'A subscription must have at least one line item.');
      return;
    }
    const updated = formData.lines.filter((_, i) => i !== index);
    setFormData({ ...formData, lines: updated });
  };

  // Live calculation of line and totals
  const selectedPlan = plans.find((p) => p.id === formData.planId);
  const minQty = selectedPlan?.minQuantity || 1;

  let liveSubtotal = 0;
  formData.lines.forEach((line) => {
    const prod = products.find((p) => p.id === line.productId);
    let unit = parseFloat(prod?.salesPrice || '0');
    if (line.variantId && prod?.variants) {
      const v = prod.variants.find((v: any) => v.id === line.variantId);
      if (v) unit += parseFloat(v.extraPrice || '0');
    }
    liveSubtotal += unit * (line.quantity || 1);
  });

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.customerId) errs.customerId = 'Customer is required';
    if (!formData.planId) errs.planId = 'Plan is required';
    if (!formData.startDate) errs.startDate = 'Start date is required';
    if (!formData.expiryDate) errs.expiryDate = 'Expiry date is required';
    if (new Date(formData.expiryDate) <= new Date(formData.startDate)) {
      errs.expiryDate = 'Expiry date must be after start date';
    }
    if (formData.lines.length === 0) errs.lines = 'At least one line item is required';

    formData.lines.forEach((line, idx) => {
      if (line.quantity < minQty) {
        errs[`line_${idx}_qty`] = `Min quantity is ${minQty}`;
      }
    });

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate(formData);
  };

  const columns: Column<Subscription>[] = [
    {
      header: 'Subscription #',
      accessorKey: 'number',
      cell: (sub) => (
        <Link
          to={`/subscriptions/${sub.id}`}
          className="font-mono font-bold text-olive-900 hover:text-olive-700 hover:underline flex items-center gap-1.5"
        >
          <Layers className="w-3.5 h-3.5 text-olive-600" />
          <span>{sub.number}</span>
        </Link>
      ),
    },
    {
      header: 'Customer',
      accessorKey: 'customer',
      cell: (sub) => (
        <div>
          <span className="font-semibold text-olive-950 block">
            {sub.customer?.name || 'Unknown Customer'}
          </span>
          <span className="text-xs text-olive-700/80">{sub.customer?.email}</span>
        </div>
      ),
    },
    {
      header: 'Plan Tier',
      accessorKey: 'plan',
      cell: (sub) => (
        <div>
          <span className="font-medium text-olive-900 block">
            {sub.plan?.name || 'Unknown Plan'}
          </span>
          <span className="text-xs text-olive-700 font-mono">
            ${sub.plan?.price} / {sub.plan?.billingPeriod?.toLowerCase()}
          </span>
        </div>
      ),
    },
    {
      header: 'Period & Expiry',
      accessorKey: 'startDate',
      cell: (sub) => (
        <div className="text-xs text-olive-900">
          <div className="flex items-center gap-1 font-medium">
            <Calendar className="w-3.5 h-3.5 text-olive-600" />
            <span>{new Date(sub.startDate).toLocaleDateString()}</span>
            <span className="text-stone-400">&rarr;</span>
            <span>{new Date(sub.expiryDate).toLocaleDateString()}</span>
          </div>
          {sub.nextBillingDate && (
            <span className="text-[11px] text-olive-700 block mt-0.5">
              Next cycle: {new Date(sub.nextBillingDate).toLocaleDateString()}
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
      header: 'Actions',
      accessorKey: 'id',
      className: 'text-right',
      cell: (sub) => (
        <div className="flex items-center justify-end gap-1.5">
          <Link to={`/subscriptions/${sub.id}`}>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-olive-800 hover:text-olive-950 hover:bg-olive-100 flex items-center gap-1"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">View</span>
            </Button>
          </Link>
          {isAdminOrStaff && (sub.status === 'DRAFT' || sub.status === 'QUOTATION') && (
            <Link to={`/subscriptions/${sub.id}`}>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs border-olive-300 text-olive-900 hover:bg-cream-100 flex items-center gap-1"
                title="Edit Draft/Quotation"
              >
                <Edit2 className="w-3.5 h-3.5 text-olive-700" />
                <span>Edit</span>
              </Button>
            </Link>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Subscriptions & Contracts"
        description="Oversee subscription lifecycles, configure tiered recurring terms, and manage active customer accounts."
        actions={
          isAdminOrStaff && (
            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                onClick={() => {
                  if (templates.length > 0 && customers.length > 0) {
                    setTemplateForm({
                      templateId: templates[0].id,
                      customerId: customers[0].id,
                      startDate: new Date().toISOString().split('T')[0],
                      expiryDate: new Date(Date.now() + 365 * 86400000)
                        .toISOString()
                        .split('T')[0],
                      paymentTermDays: 15,
                    });
                  }
                  setIsTemplateModalOpen(true);
                }}
                className="border-olive-300 bg-white hover:bg-cream-100 text-olive-900 font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-olive-600" />
                <span>From Template</span>
              </Button>

              <Button
                onClick={openCreateDialog}
                className="bg-olive-800 hover:bg-olive-900 text-white font-semibold px-4 py-2.5 rounded-lg shadow-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>New Subscription</span>
              </Button>
            </div>
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
          <option value="QUOTATION">Quotation</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="CLOSED">Closed</option>
        </select>

        <select
          value={planFilter}
          onChange={(e) => {
            setPlanFilter(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 text-sm rounded-lg border border-cream-300 bg-white text-olive-950 font-medium focus:ring-2 focus:ring-olive-500/20 focus:border-olive-600 transition-colors shadow-2xs"
        >
          <option value="">All Plans</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
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
          placeholder: 'Search subscriptions by number or customer...',
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
          icon: Layers,
          title: 'No Subscriptions Found',
          description: 'Create your first subscription or generate one from a quotation template.',
        }}
      />

      {/* CREATE SUBSCRIPTION MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-cream-300 shadow-2xl max-w-2xl w-full p-6 space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-cream-200 pb-4">
              <div>
                <h2 className="text-xl font-bold font-serif text-olive-950">
                  New Subscription Contract
                </h2>
                <p className="text-xs text-olive-700/80 mt-0.5">
                  Configure customer, plan parameters, and itemized service lines
                </p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-lg text-olive-700 hover:text-olive-950 hover:bg-olive-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Customer & Plan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-olive-900">
                    Customer Account *
                  </Label>
                  <select
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                    className="w-full h-10 px-3 text-sm rounded-lg border border-cream-300 bg-white text-olive-950 font-medium"
                  >
                    <option value="">Select customer...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.email})
                      </option>
                    ))}
                  </select>
                  {formErrors.customerId && (
                    <p className="text-xs text-rose-600 font-medium">{formErrors.customerId}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-olive-900">
                    Recurring Plan *
                  </Label>
                  <select
                    value={formData.planId}
                    onChange={(e) => {
                      const newPlanId = e.target.value;
                      const sel = plans.find((p) => p.id === newPlanId);
                      setFormData({
                        ...formData,
                        planId: newPlanId,
                        lines: formData.lines.map((l) => ({
                          ...l,
                          quantity: Math.max(l.quantity, sel?.minQuantity || 1),
                        })),
                      });
                    }}
                    className="w-full h-10 px-3 text-sm rounded-lg border border-cream-300 bg-white text-olive-950 font-medium"
                  >
                    <option value="">Select plan...</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (${p.price} / {p.billingPeriod.toLowerCase()}, min {p.minQuantity})
                      </option>
                    ))}
                  </select>
                  {formErrors.planId && (
                    <p className="text-xs text-rose-600 font-medium">{formErrors.planId}</p>
                  )}
                </div>
              </div>

              {/* Dates & Payment Term */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-olive-900">Start Date *</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                  {formErrors.startDate && (
                    <p className="text-xs text-rose-600 font-medium">{formErrors.startDate}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-olive-900">Expiry Date *</Label>
                  <Input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  />
                  {formErrors.expiryDate && (
                    <p className="text-xs text-rose-600 font-medium">{formErrors.expiryDate}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-olive-900">Payment Term</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.paymentTermDays}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        paymentTermDays: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>

              {/* Lines Editor */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-cream-200 pb-2">
                  <div>
                    <Label className="text-sm font-bold text-olive-950 block">
                      Subscription Line Items
                    </Label>
                    <span className="text-xs text-olive-700/80">
                      Minimum quantity per line for selected plan: {minQty}
                    </span>
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

                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {formData.lines.map((line, idx) => {
                    const selProduct = products.find((p) => p.id === line.productId);
                    const variants = selProduct?.variants || [];
                    let unitPrice = parseFloat(selProduct?.salesPrice || '0');
                    if (line.variantId && variants.length > 0) {
                      const v = variants.find((v: any) => v.id === line.variantId);
                      if (v) unitPrice += parseFloat(v.extraPrice || '0');
                    }
                    const lineTotal = (unitPrice * line.quantity).toFixed(2);

                    return (
                      <div
                        key={idx}
                        className="p-3 bg-cream-50/70 border border-cream-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-3"
                      >
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

                        <div className="w-full sm:w-40">
                          <label className="text-[11px] font-semibold text-olive-800 block mb-1">
                            Variant
                          </label>
                          <select
                            value={line.variantId || ''}
                            onChange={(e) =>
                              handleLineChange(idx, 'variantId', e.target.value || null)
                            }
                            disabled={variants.length === 0}
                            className="w-full h-9 px-2 text-xs rounded-lg border border-cream-300 bg-white text-olive-950 font-medium disabled:opacity-50"
                          >
                            <option value="">Standard</option>
                            {variants.map((v: any) => (
                              <option key={v.id} value={v.id}>
                                {v.value} (+${v.extraPrice})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="w-20">
                          <label className="text-[11px] font-semibold text-olive-800 block mb-1">
                            Qty (min {minQty})
                          </label>
                          <Input
                            type="number"
                            min={minQty}
                            value={line.quantity}
                            onChange={(e) =>
                              handleLineChange(
                                idx,
                                'quantity',
                                parseInt(e.target.value) || minQty
                              )
                            }
                            className="h-9 text-xs"
                          />
                        </div>

                        <div className="w-24 text-right">
                          <label className="text-[11px] font-semibold text-olive-800 block mb-1">
                            Line Total
                          </label>
                          <span className="text-xs font-mono font-bold text-olive-950 block pt-1.5">
                            ${lineTotal}
                          </span>
                        </div>

                        <div className="pt-5 sm:pt-4">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLine(idx)}
                            className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total preview */}
              <div className="p-3 bg-cream-100 rounded-xl flex items-center justify-between border border-cream-200">
                <span className="text-xs font-semibold text-olive-900">
                  Estimated Subtotal per Cycle:
                </span>
                <span className="text-base font-bold font-mono text-olive-950">
                  ${liveSubtotal.toFixed(2)}
                </span>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-cream-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  className="border-cream-300 text-olive-900 hover:bg-cream-100"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-olive-800 hover:bg-olive-900 text-white font-semibold"
                >
                  {createMutation.isPending ? 'Creating Draft...' : 'Create Subscription'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE FROM TEMPLATE MODAL */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-cream-300 shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-cream-200 pb-3">
              <div>
                <h3 className="font-serif font-bold text-lg text-olive-950">
                  Create From Quotation Template
                </h3>
                <p className="text-xs text-olive-700/80">
                  Instantly deploy a pre-packaged blueprint as a customer quotation
                </p>
              </div>
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="p-1 rounded-lg text-olive-700 hover:text-olive-950"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-olive-900">
                  Select Blueprint Template *
                </Label>
                <select
                  value={templateForm.templateId}
                  onChange={(e) =>
                    setTemplateForm({ ...templateForm, templateId: e.target.value })
                  }
                  className="w-full h-10 px-3 text-sm rounded-lg border border-cream-300 bg-white text-olive-950 font-medium"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.lines?.length || 0} items &bull; {t.validityDays}d validity)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-olive-900">
                  Target Customer *
                </Label>
                <select
                  value={templateForm.customerId}
                  onChange={(e) =>
                    setTemplateForm({ ...templateForm, customerId: e.target.value })
                  }
                  className="w-full h-10 px-3 text-sm rounded-lg border border-cream-300 bg-white text-olive-950 font-medium"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-olive-900">Start Date</Label>
                  <Input
                    type="date"
                    value={templateForm.startDate}
                    onChange={(e) =>
                      setTemplateForm({ ...templateForm, startDate: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-olive-900">Expiry Date</Label>
                  <Input
                    type="date"
                    value={templateForm.expiryDate}
                    onChange={(e) =>
                      setTemplateForm({ ...templateForm, expiryDate: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-cream-200">
              <Button
                variant="outline"
                onClick={() => setIsTemplateModalOpen(false)}
                className="border-cream-300 text-olive-900 hover:bg-cream-100"
              >
                Cancel
              </Button>
              <Button
                onClick={() => templateMutation.mutate()}
                disabled={templateMutation.isPending || !templateForm.templateId}
                className="bg-olive-800 hover:bg-olive-900 text-white font-semibold"
              >
                {templateMutation.isPending ? 'Generating...' : 'Generate Quotation'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
