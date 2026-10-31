import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import apiClient from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Layers,
  Calendar,
  User,
  AlertCircle,
  Pause,
  Play,
  RotateCw,
  XCircle,
  Check,
  Send,
  ArrowLeft,
  Edit2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

export function SubscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isAdminOrStaff = user?.role === 'ADMIN' || user?.role === 'STAFF';
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  // 1. Fetch Subscription Detail
  const { data: subData, isLoading, isError } = useQuery<{ data: any }>({
    queryKey: ['subscription-detail', id],
    queryFn: async () => {
      const res = await apiClient.get(`/subscriptions/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
  const sub = subData?.data;

  // 2. Fetch Subscription Invoices
  const { data: invoicesData } = useQuery<{ data: any[] }>({
    queryKey: ['subscription-invoices', id],
    queryFn: async () => {
      const res = await apiClient.get(`/invoices?subscriptionId=${id}`);
      return res.data;
    },
    enabled: !!id,
  });
  const invoices = invoicesData?.data || [];

  // 3. Fetch Products and Taxes for Editing
  const { data: productsData } = useQuery<{ data: any[] }>({
    queryKey: ['products-list-all'],
    queryFn: async () => {
      const res = await apiClient.get('/products?pageSize=100');
      return res.data;
    },
    enabled: !!sub,
  });
  const products = productsData?.data || [];

  const { data: taxesData } = useQuery<{ data: any[] }>({
    queryKey: ['taxes-list-all'],
    queryFn: async () => {
      const res = await apiClient.get('/taxes?pageSize=100');
      return res.data;
    },
    enabled: !!sub,
  });
  const taxes = taxesData?.data || [];

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<{
    startDate: string;
    expiryDate: string;
    paymentTermDays: number;
    quotationValidUntil?: string;
    notes: string;
    lines: {
      productId: string;
      variantId: string | null;
      quantity: number;
      taxId: string | null;
    }[];
  }>({
    startDate: '',
    expiryDate: '',
    paymentTermDays: 15,
    notes: '',
    lines: [],
  });

  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Transition Mutation
  const transitionMutation = useMutation({
    mutationFn: async (action: string) => {
      return apiClient.post(`/subscriptions/${id}/${action}`);
    },
    onSuccess: (_, action) => {
      success('Transition Executed', `Subscription state transition "${action}" succeeded.`);
      queryClient.invalidateQueries({ queryKey: ['subscription-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
    onError: (err: any, action) => {
      const msg = err.response?.data?.error?.message || `Failed to execute ${action}`;
      error('Transition Error', msg);
    },
  });

  // Update Subscription Mutation
  const updateMutation = useMutation({
    mutationFn: async (payload: typeof editForm) => {
      return apiClient.patch(`/subscriptions/${id}`, payload);
    },
    onSuccess: () => {
      success('Subscription Updated', 'Subscription changes saved to database.');
      setIsEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ['subscription-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.message || 'Failed to update subscription';
      error('Update Error', msg);
    },
  });

  const handleOpenEdit = () => {
    if (!sub) return;
    setEditForm({
      startDate: sub.startDate.split('T')[0],
      expiryDate: sub.expiryDate.split('T')[0],
      paymentTermDays: sub.paymentTermDays,
      quotationValidUntil: sub.quotationValidUntil ? sub.quotationValidUntil.split('T')[0] : '',
      notes: sub.notes || '',
      lines: sub.lines.map((l: any) => ({
        productId: l.productId,
        variantId: l.variantId || null,
        quantity: l.quantity,
        taxId: l.taxId || null,
      })),
    });
    setEditErrors({});
    setIsEditOpen(true);
  };

  const handleAddLineEdit = () => {
    if (products.length === 0) return;
    setEditForm({
      ...editForm,
      lines: [
        ...editForm.lines,
        { productId: products[0].id, variantId: null, quantity: 1, taxId: null },
      ],
    });
  };

  const handleRemoveLineEdit = (index: number) => {
    setEditForm({
      ...editForm,
      lines: editForm.lines.filter((_, i) => i !== index),
    });
  };

  const handleUpdateLineEdit = (index: number, field: string, val: any) => {
    const updated = [...editForm.lines];
    if (field === 'productId') {
      updated[index] = {
        ...updated[index],
        productId: val,
        variantId: null,
      };
    } else {
      updated[index] = {
        ...updated[index],
        [field]: val,
      };
    }
    setEditForm({ ...editForm, lines: updated });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!editForm.startDate) errs.startDate = 'Start date is required';
    if (!editForm.expiryDate) errs.expiryDate = 'Expiry date is required';
    if (new Date(editForm.expiryDate) <= new Date(editForm.startDate)) {
      errs.expiryDate = 'Expiry date must be after start date';
    }
    if (editForm.lines.length === 0) {
      errs.lines = 'At least one line item is required';
    }

    const minQty = sub?.plan?.minQuantity || 1;
    editForm.lines.forEach((line, idx) => {
      if (line.quantity < minQty) {
        errs[`line_${idx}_qty`] = `Minimum quantity for this plan is ${minQty}`;
      }
    });

    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }

    updateMutation.mutate(editForm);
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-olive-800">
        <div className="w-8 h-8 border-3 border-olive-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium">Loading subscription details...</p>
      </div>
    );
  }

  if (isError || !sub) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-rose-200">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="font-serif font-bold text-lg text-olive-950 mb-1">Subscription Not Found</h3>
        <p className="text-xs text-olive-700/80 mb-4">
          The requested subscription record does not exist or you do not have permission to view it.
        </p>
        <Link to="/subscriptions">
          <Button variant="outline" className="border-cream-300 text-olive-900">
            &larr; Back to Subscriptions
          </Button>
        </Link>
      </div>
    );
  }

  // Stepper logic
  const steps = [
    { key: 'DRAFT', label: 'Draft' },
    { key: 'QUOTATION', label: 'Quotation' },
    { key: 'CONFIRMED', label: 'Confirmed' },
    { key: 'ACTIVE', label: 'Active' },
    { key: 'CLOSED', label: 'Closed' },
  ];

  const getStepIndex = (st: string) => {
    switch (st) {
      case 'DRAFT':
        return 0;
      case 'QUOTATION':
        return 1;
      case 'CONFIRMED':
        return 2;
      case 'ACTIVE':
      case 'PAUSED':
        return 3;
      case 'CLOSED':
        return 4;
      default:
        return 0;
    }
  };

  const currentStepIndex = getStepIndex(sub.status);

  // Allowed transitions
  const canQuote = sub.status === 'DRAFT';
  const canConfirm = sub.status === 'QUOTATION' || sub.status === 'DRAFT';
  const canActivate = sub.status === 'CONFIRMED';
  const canPause = sub.status === 'ACTIVE' && sub.plan?.pausable;
  const canResume = sub.status === 'PAUSED' && sub.plan?.pausable;
  const canClose =
    sub.status !== 'CLOSED' &&
    (sub.status === 'DRAFT' ||
      sub.status === 'QUOTATION' ||
      sub.status === 'CONFIRMED' ||
      sub.plan?.closable ||
      new Date(sub.expiryDate) <= new Date());
  const canRenew =
    (sub.status === 'ACTIVE' || sub.status === 'PAUSED' || sub.status === 'CLOSED') &&
    sub.plan?.renewable;

  // Editable only in DRAFT or QUOTATION by ADMIN or STAFF
  const canEdit =
    isAdminOrStaff &&
    (sub.status === 'DRAFT' || sub.status === 'QUOTATION');

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top back navigation */}
      <div className="flex items-center gap-3">
        <Link
          to="/subscriptions"
          className="text-xs font-semibold text-olive-700 hover:text-olive-950 flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Subscriptions
        </Link>
      </div>

      {/* Main Header with Transitions & Edit */}
      <div className="p-6 md:p-8 bg-white rounded-2xl border border-cream-300 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-2xl font-bold text-olive-950">{sub.number}</span>
            <StatusBadge status={sub.status} />
            {sub.status === 'PAUSED' && (
              <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-semibold">
                Paused
              </span>
            )}
          </div>
          <p className="text-xs text-olive-700/80">
            Created on {new Date(sub.createdAt).toLocaleDateString()} &bull; Payment Term:{' '}
            {sub.paymentTermDays} days
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {canEdit && (
            <Button
              variant="outline"
              onClick={handleOpenEdit}
              className="border-olive-300 bg-white hover:bg-cream-100 text-olive-900 font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-2xs"
            >
              <Edit2 className="w-3.5 h-3.5 text-olive-700" /> Edit Subscription
            </Button>
          )}

          {canQuote && (
            <Button
              onClick={() => transitionMutation.mutate('quote')}
              disabled={transitionMutation.isPending}
              className="bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" /> Quote
            </Button>
          )}

          {canConfirm && (
            <Button
              onClick={() => transitionMutation.mutate('confirm')}
              disabled={transitionMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-sm"
            >
              <Check className="w-3.5 h-3.5" /> Confirm
            </Button>
          )}

          {canActivate && (
            <Button
              onClick={() => transitionMutation.mutate('activate')}
              disabled={transitionMutation.isPending}
              className="bg-olive-800 hover:bg-olive-900 text-white font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-sm"
            >
              <Play className="w-3.5 h-3.5" /> Activate Contract
            </Button>
          )}

          {canPause && (
            <Button
              variant="outline"
              onClick={() => transitionMutation.mutate('pause')}
              disabled={transitionMutation.isPending}
              className="border-amber-300 text-amber-900 hover:bg-amber-50 font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5"
            >
              <Pause className="w-3.5 h-3.5" /> Pause
            </Button>
          )}

          {canResume && (
            <Button
              onClick={() => transitionMutation.mutate('resume')}
              disabled={transitionMutation.isPending}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" /> Resume Contract
            </Button>
          )}

          {canRenew && (
            <Button
              variant="outline"
              onClick={() => transitionMutation.mutate('renew')}
              disabled={transitionMutation.isPending}
              className="border-olive-300 bg-white hover:bg-cream-100 text-olive-900 font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5"
            >
              <RotateCw className="w-3.5 h-3.5" /> Renew Term
            </Button>
          )}

          {canClose && (
            <Button
              variant="outline"
              onClick={() => transitionMutation.mutate('close')}
              disabled={transitionMutation.isPending}
              className="border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5"
            >
              <XCircle className="w-3.5 h-3.5" /> Close Subscription
            </Button>
          )}
        </div>
      </div>

      {/* Lifecycle Status Stepper */}
      <Card className="border border-cream-300 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-olive-800">
            Subscription Lifecycle Stepper
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative flex items-center justify-between">
            {/* Connecting Line */}
            <div className="absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 bg-cream-300 z-0" />
            <div
              className="absolute top-1/2 left-0 h-1 -translate-y-1/2 bg-olive-700 transition-all duration-500 z-0"
              style={{
                width: `${(currentStepIndex / (steps.length - 1)) * 100}%`,
              }}
            />

            {/* Stepper Nodes */}
            {steps.map((step, idx) => {
              const isPast = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;

              let nodeClasses = 'bg-white border-2 border-cream-300 text-stone-400';
              if (isPast) {
                nodeClasses = 'bg-olive-700 border-2 border-olive-700 text-white';
              } else if (isCurrent) {
                nodeClasses = 'bg-white border-3 border-olive-800 text-olive-950 ring-4 ring-olive-100';
              }

              return (
                <div key={step.key} className="relative z-10 flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${nodeClasses}`}
                  >
                    {isPast ? <Check className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span
                    className={`text-xs mt-2 font-semibold ${
                      isCurrent
                        ? 'text-olive-950 font-bold'
                        : isPast
                        ? 'text-olive-800'
                        : 'text-stone-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Subscription Details & Customer Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer Card */}
        <Card className="border border-cream-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-olive-800">
              Customer Account
            </CardTitle>
            <User className="w-4 h-4 text-olive-600" />
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="font-bold text-olive-950 block">{sub.customer?.name}</span>
              <span className="text-xs text-olive-700/80">{sub.customer?.email}</span>
            </div>
            {sub.customer?.company && (
              <p className="text-xs text-olive-800">
                <strong>Company:</strong> {sub.customer.company}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Plan Tier Card */}
        <Card className="border border-cream-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-olive-800">
              Contract Plan
            </CardTitle>
            <Layers className="w-4 h-4 text-olive-600" />
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-bold text-olive-950">{sub.plan?.name}</span>
              <span className="font-mono font-semibold text-olive-900">
                ${sub.plan?.price} / {sub.plan?.billingPeriod?.toLowerCase()}
              </span>
            </div>
            <div className="text-xs text-olive-700 space-y-0.5 pt-1">
              <p>&bull; Min Quantity: {sub.plan?.minQuantity}</p>
              <p>&bull; Pausable: {sub.plan?.pausable ? 'Yes' : 'No'}</p>
              <p>&bull; Closable: {sub.plan?.closable ? 'Yes' : 'No'}</p>
              <p>&bull; Renewable: {sub.plan?.renewable ? 'Yes' : 'No'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Billing Schedule Card */}
        <Card className="border border-cream-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-olive-800">
              Billing Dates &amp; Terms
            </CardTitle>
            <Calendar className="w-4 h-4 text-olive-600" />
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs text-olive-900">
            <p>
              <strong>Start Date:</strong> {new Date(sub.startDate).toLocaleDateString()}
            </p>
            <p>
              <strong>Expiry Date:</strong> {new Date(sub.expiryDate).toLocaleDateString()}
            </p>
            <p>
              <strong>Next Billing Date:</strong>{' '}
              {sub.nextBillingDate
                ? new Date(sub.nextBillingDate).toLocaleDateString()
                : 'Not scheduled / Inactive'}
            </p>
            {sub.quotationValidUntil && (
              <p className="text-amber-800 font-medium">
                <strong>Quote Valid Until:</strong>{' '}
                {new Date(sub.quotationValidUntil).toLocaleDateString()}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Subscription Line Items */}
      <Card className="border border-cream-300">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-olive-950">
              Contract Line Items
            </CardTitle>
            <p className="text-xs text-olive-700/80">
              Snapshot unit pricing, variants, and applied tax rates stored in database
            </p>
          </div>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenEdit}
              className="text-xs border-olive-300 text-olive-900 flex items-center gap-1.5"
            >
              <Edit2 className="w-3.5 h-3.5 text-olive-700" /> Edit Lines
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left text-xs font-bold uppercase tracking-wider text-olive-800">
                  <th className="py-2">Product &amp; Variant</th>
                  <th className="py-2 text-center">Quantity</th>
                  <th className="py-2 text-right">Unit Price</th>
                  <th className="py-2 text-right">Tax Rate</th>
                  <th className="py-2 text-right">Line Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {sub.lines.map((line: any) => (
                  <tr key={line.id}>
                    <td className="py-3">
                      <span className="font-semibold text-olive-950 block">
                        {line.product?.name}
                      </span>
                      {line.variant && (
                        <span className="text-xs text-olive-700">
                          {line.variant.attribute}: {line.variant.value} (+${line.variant.extraPrice})
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-center font-medium text-olive-900">
                      {line.quantity}
                    </td>
                    <td className="py-3 text-right font-mono text-olive-900">
                      ${line.unitPrice}
                    </td>
                    <td className="py-3 text-right text-xs text-olive-700">
                      {line.tax ? `${line.tax.name} (${line.tax.rate}%)` : 'No Tax'}
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-olive-950">
                      ${line.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Linked Invoices History */}
      <Card className="border border-cream-300">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold text-olive-950">
            Generated Invoices History
          </CardTitle>
          <span className="text-xs text-olive-700/80 font-medium">
            {invoices.length} Invoice{invoices.length !== 1 ? 's' : ''} Issued
          </span>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-xs text-stone-500 py-4 text-center">
              No invoices generated for this subscription yet. Invoices are produced automatically during daily billing runs or manual triggers.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cream-200 text-left text-xs font-bold uppercase tracking-wider text-olive-800">
                    <th className="py-2">Invoice #</th>
                    <th className="py-2">Billing Period</th>
                    <th className="py-2">Due Date</th>
                    <th className="py-2 text-right">Total</th>
                    <th className="py-2 text-right">Balance</th>
                    <th className="py-2 text-center">Status</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200">
                  {invoices.map((inv: any) => (
                    <tr key={inv.id}>
                      <td className="py-2.5 font-mono font-bold text-olive-900">
                        {inv.number}
                      </td>
                      <td className="py-2.5 text-xs text-olive-800">
                        {new Date(inv.periodStart).toLocaleDateString()} &rarr;{' '}
                        {new Date(inv.periodEnd).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 text-xs text-olive-800">
                        {new Date(inv.dueDate).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 text-right font-mono font-semibold text-olive-950">
                        ${inv.total}
                      </td>
                      <td className="py-2.5 text-right font-mono text-xs font-bold text-rose-700">
                        ${inv.balance}
                      </td>
                      <td className="py-2.5 text-center">
                        <StatusBadge
                          status={inv.isOverdue ? 'OVERDUE' : inv.status}
                          label={inv.isOverdue ? 'Overdue' : undefined}
                        />
                      </td>
                      <td className="py-2.5 text-right">
                        <Link to={`/invoices/${inv.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-olive-800">
                            Details
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Subscription Modal (Admin & Staff) */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl border border-cream-300 p-6 md:p-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-cream-200 mb-6">
              <div>
                <h3 className="font-serif font-bold text-xl text-olive-950">
                  Edit Subscription &mdash; {sub.number}
                </h3>
                <p className="text-xs text-olive-700">
                  Modify terms, lifecycle dates, and line items saved in the database
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditOpen(false)}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4 text-stone-500" />
              </Button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-6">
              {/* Dates & Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-olive-900">Start Date</Label>
                  <Input
                    type="date"
                    value={editForm.startDate}
                    onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                    className="mt-1"
                  />
                  {editErrors.startDate && (
                    <span className="text-xs text-rose-600">{editErrors.startDate}</span>
                  )}
                </div>

                <div>
                  <Label className="text-xs font-semibold text-olive-900">Expiry Date</Label>
                  <Input
                    type="date"
                    value={editForm.expiryDate}
                    onChange={(e) => setEditForm({ ...editForm, expiryDate: e.target.value })}
                    className="mt-1"
                  />
                  {editErrors.expiryDate && (
                    <span className="text-xs text-rose-600">{editErrors.expiryDate}</span>
                  )}
                </div>

                <div>
                  <Label className="text-xs font-semibold text-olive-900">Payment Term (Days)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="180"
                    value={editForm.paymentTermDays}
                    onChange={(e) =>
                      setEditForm({ ...editForm, paymentTermDays: parseInt(e.target.value, 10) || 15 })
                    }
                    className="mt-1"
                  />
                </div>
              </div>

              {sub.status === 'QUOTATION' && (
                <div>
                  <Label className="text-xs font-semibold text-olive-900">Quotation Valid Until</Label>
                  <Input
                    type="date"
                    value={editForm.quotationValidUntil || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, quotationValidUntil: e.target.value })
                    }
                    className="mt-1 max-w-xs"
                  />
                </div>
              )}

              {/* Line Items Editor */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-olive-900">
                    Line Items
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddLineEdit}
                    className="h-8 text-xs border-olive-300 text-olive-900 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Line
                  </Button>
                </div>

                {editErrors.lines && (
                  <span className="text-xs text-rose-600 block">{editErrors.lines}</span>
                )}

                <div className="space-y-3">
                  {editForm.lines.map((line, idx) => {
                    const selProd = products.find((p) => p.id === line.productId);
                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-cream-50/80 border border-cream-200 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                      >
                        {/* Product */}
                        <div className="sm:col-span-4">
                          <label className="text-[11px] font-semibold text-olive-800 block mb-1">
                            Product
                          </label>
                          <select
                            value={line.productId}
                            onChange={(e) => handleUpdateLineEdit(idx, 'productId', e.target.value)}
                            className="w-full text-xs h-9 rounded-md border border-cream-300 bg-white px-2 text-olive-950 font-medium"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (${p.salesPrice})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Variant */}
                        <div className="sm:col-span-3">
                          <label className="text-[11px] font-semibold text-olive-800 block mb-1">
                            Variant
                          </label>
                          <select
                            value={line.variantId || ''}
                            onChange={(e) =>
                              handleUpdateLineEdit(idx, 'variantId', e.target.value || null)
                            }
                            className="w-full text-xs h-9 rounded-md border border-cream-300 bg-white px-2 text-olive-950"
                          >
                            <option value="">Default (No Variant)</option>
                            {selProd?.variants?.map((v: any) => (
                              <option key={v.id} value={v.id}>
                                {v.attribute}: {v.value} (+${v.extraPrice})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Qty */}
                        <div className="sm:col-span-2">
                          <label className="text-[11px] font-semibold text-olive-800 block mb-1">
                            Qty
                          </label>
                          <Input
                            type="number"
                            min={sub.plan?.minQuantity || 1}
                            value={line.quantity}
                            onChange={(e) =>
                              handleUpdateLineEdit(
                                idx,
                                'quantity',
                                parseInt(e.target.value, 10) || 1
                              )
                            }
                            className="h-9 text-xs"
                          />
                          {editErrors[`line_${idx}_qty`] && (
                            <span className="text-[10px] text-rose-600 block">
                              {editErrors[`line_${idx}_qty`]}
                            </span>
                          )}
                        </div>

                        {/* Tax */}
                        <div className="sm:col-span-2">
                          <label className="text-[11px] font-semibold text-olive-800 block mb-1">
                            Tax
                          </label>
                          <select
                            value={line.taxId || ''}
                            onChange={(e) =>
                              handleUpdateLineEdit(idx, 'taxId', e.target.value || null)
                            }
                            className="w-full text-xs h-9 rounded-md border border-cream-300 bg-white px-2 text-olive-950"
                          >
                            <option value="">None (0%)</option>
                            {taxes.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({t.rate}%)
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Remove */}
                        <div className="sm:col-span-1 flex justify-end pt-3 sm:pt-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveLineEdit(idx)}
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

              {/* Notes */}
              <div>
                <Label className="text-xs font-semibold text-olive-900">Notes &amp; Remarks</Label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={2}
                  className="mt-1 w-full text-xs p-2.5 rounded-lg border border-cream-300 focus:outline-none focus:ring-2 focus:ring-olive-500"
                  placeholder="Optional internal remarks or customer instructions..."
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-cream-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                  className="border-cream-300 text-olive-900"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="bg-olive-800 hover:bg-olive-900 text-white font-semibold shadow-sm"
                >
                  {updateMutation.isPending ? 'Saving to Database...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
