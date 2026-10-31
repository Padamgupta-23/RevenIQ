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
  Calendar,
  User,
  AlertCircle,
  Check,
  Mail,
  Printer,
  XCircle,
  ArrowLeft,
  X,
  DollarSign,
} from 'lucide-react';

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isAdminOrStaff = user?.role === 'ADMIN' || user?.role === 'STAFF';
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  // Payment modal state
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payForm, setPayForm] = useState({
    method: 'CARD',
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    note: '',
  });

  // 1. Fetch Invoice Details
  const { data: invData, isLoading, isError } = useQuery<{ data: any }>({
    queryKey: ['invoice-detail', id],
    queryFn: async () => {
      const res = await apiClient.get(`/invoices/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
  const inv = invData?.data;

  // 2. Fetch Payments for this invoice
  const { data: paymentsData } = useQuery<{ data: any[] }>({
    queryKey: ['invoice-payments', id],
    queryFn: async () => {
      const res = await apiClient.get(`/payments/invoice/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
  const payments = paymentsData?.data || [];

  // Mutations
  const confirmMutation = useMutation({
    mutationFn: async () => apiClient.post(`/invoices/${id}/confirm`),
    onSuccess: () => {
      success('Invoice Confirmed', 'Invoice marked as confirmed in database.');
      queryClient.invalidateQueries({ queryKey: ['invoice-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.message || 'Failed to confirm invoice';
      error('Confirm Error', msg);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => apiClient.post(`/invoices/${id}/cancel`),
    onSuccess: () => {
      success('Invoice Cancelled', 'Invoice cancelled successfully.');
      queryClient.invalidateQueries({ queryKey: ['invoice-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.message || 'Failed to cancel invoice';
      error('Cancel Error', msg);
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => apiClient.post(`/invoices/${id}/send`),
    onSuccess: () => {
      success('Invoice Dispatched', 'Summary email transmitted to customer.');
      queryClient.invalidateQueries({ queryKey: ['invoice-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.message || 'Failed to send invoice';
      error('Send Error', msg);
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async (payload: typeof payForm) => {
      return apiClient.post('/payments', {
        invoiceId: id,
        ...payload,
      });
    },
    onSuccess: () => {
      success('Payment Recorded', 'Payment transaction logged to database.');
      setIsPayModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['invoice-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['invoice-payments', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.message || 'Failed to record payment';
      error('Payment Error', msg);
    },
  });

  const handleOpenPayModal = () => {
    if (!inv) return;
    setPayForm({
      method: 'CARD',
      amount: inv.balance || '0.00',
      paymentDate: new Date().toISOString().split('T')[0],
      note: '',
    });
    setIsPayModalOpen(true);
  };

  const handlePrint = async () => {
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
      const res = await apiClient.get(`/invoices/${id}/print`, {
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

  if (isLoading) {
    return (
      <div className="p-12 text-center text-olive-800">
        <div className="w-8 h-8 border-3 border-olive-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium">Loading invoice details...</p>
      </div>
    );
  }

  if (isError || !inv) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-rose-200">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="font-serif font-bold text-lg text-olive-950 mb-1">Invoice Not Found</h3>
        <p className="text-xs text-olive-700/80 mb-4">
          The requested invoice record could not be loaded.
        </p>
        <Link to="/invoices">
          <Button variant="outline" className="border-cream-300 text-olive-900">
            &larr; Back to Invoices
          </Button>
        </Link>
      </div>
    );
  }

  const canConfirm = inv.status === 'DRAFT' && isAdminOrStaff;
  const canCancel = (inv.status === 'DRAFT' || inv.status === 'CONFIRMED') && isAdminOrStaff;
  const canSend = inv.status !== 'CANCELLED' && isAdminOrStaff;
  const canPay =
    inv.status === 'CONFIRMED' &&
    parseFloat(inv.balance) > 0 &&
    isAdminOrStaff;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top back navigation */}
      <div className="flex items-center gap-3">
        <Link
          to="/invoices"
          className="text-xs font-semibold text-olive-700 hover:text-olive-950 flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Invoices
        </Link>
      </div>

      {/* Main Header with Action Buttons */}
      <div className="p-6 md:p-8 bg-white rounded-2xl border border-cream-300 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-2xl font-bold text-olive-950">{inv.number}</span>
            <StatusBadge
              status={inv.isOverdue ? 'OVERDUE' : inv.status}
              label={inv.isOverdue ? 'Overdue' : undefined}
            />
          </div>
          <p className="text-xs text-olive-700/80">
            Issued {new Date(inv.issueDate).toLocaleDateString()} &bull; Due{' '}
            {new Date(inv.dueDate).toLocaleDateString()}
            {inv.sentAt && (
              <span className="ml-2 text-olive-800 font-semibold">
                &bull; Sent {new Date(inv.sentAt).toLocaleDateString()}
              </span>
            )}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {canPay && (
            <Button
              onClick={handleOpenPayModal}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-sm"
            >
              <DollarSign className="w-3.5 h-3.5" /> Record Payment
            </Button>
          )}

          {canConfirm && (
            <Button
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-sm"
            >
              <Check className="w-3.5 h-3.5" /> Confirm Invoice
            </Button>
          )}

          {canSend && (
            <Button
              variant="outline"
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
              className="border-olive-300 bg-white hover:bg-cream-100 text-olive-900 font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5 text-olive-600" />
              <span>{sendMutation.isPending ? 'Sending...' : 'Send via Email'}</span>
            </Button>
          )}

          <Button
            variant="outline"
            onClick={handlePrint}
            className="border-olive-300 bg-white hover:bg-cream-100 text-olive-900 font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5 text-olive-600" />
            <span>Print / Download</span>
          </Button>

          {canCancel && (
            <Button
              variant="outline"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5"
            >
              <XCircle className="w-3.5 h-3.5" /> Cancel Invoice
            </Button>
          )}
        </div>
      </div>

      {/* Customer & Period Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border border-cream-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-olive-800">
              Customer Account
            </CardTitle>
            <User className="w-4 h-4 text-olive-600" />
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <span className="font-bold text-olive-950 block">{inv.customer?.name}</span>
            <span className="text-xs text-olive-700/80 block">{inv.customer?.email}</span>
            {inv.customer?.company && (
              <span className="text-xs text-olive-800 block">
                <strong>Company:</strong> {inv.customer.company}
              </span>
            )}
          </CardContent>
        </Card>

        <Card className="border border-cream-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-olive-800">
              Subscription Reference
            </CardTitle>
            <Calendar className="w-4 h-4 text-olive-600" />
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Link
              to={`/subscriptions/${inv.subscriptionId}`}
              className="font-mono font-bold text-olive-900 hover:underline block"
            >
              {inv.subscription?.number || 'Subscription Details'}
            </Link>
            {inv.subscription?.plan && (
              <span className="text-xs text-olive-700 block">
                Plan: {inv.subscription.plan.name}
              </span>
            )}
          </CardContent>
        </Card>

        <Card className="border border-cream-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-olive-800">
              Billing Schedule
            </CardTitle>
            <Calendar className="w-4 h-4 text-olive-600" />
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs text-olive-900">
            <p>
              <strong>Period:</strong> {new Date(inv.periodStart).toLocaleDateString()} &rarr;{' '}
              {new Date(inv.periodEnd).toLocaleDateString()}
            </p>
            <p>
              <strong>Payment Due:</strong> {new Date(inv.dueDate).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Itemized Lines */}
      <Card className="border border-cream-300">
        <CardHeader>
          <CardTitle className="text-base font-bold text-olive-950">
            Itemized Invoicing Lines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left text-xs font-bold uppercase tracking-wider text-olive-800">
                  <th className="py-2.5">Line Description</th>
                  <th className="py-2.5 text-center">Qty</th>
                  <th className="py-2.5 text-right">Unit Price</th>
                  <th className="py-2.5 text-right">Tax Rate</th>
                  <th className="py-2.5 text-right">Line Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {inv.lines?.map((line: any) => (
                  <tr key={line.id}>
                    <td className="py-3 font-medium text-olive-950">
                      {line.description}
                    </td>
                    <td className="py-3 text-center text-olive-900">{line.quantity}</td>
                    <td className="py-3 text-right font-mono text-olive-900">
                      ${line.unitPrice}
                    </td>
                    <td className="py-3 text-right text-xs text-olive-700">
                      {line.taxRate}% (${line.taxAmount})
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-olive-950">
                      ${line.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Breakdown */}
          <div className="flex justify-end pt-6 border-t border-cream-200 mt-4">
            <div className="w-80 space-y-2 text-sm">
              <div className="flex justify-between text-olive-800">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold">${inv.subtotal}</span>
              </div>
              <div className="flex justify-between text-olive-700">
                <span>Discounts Applied:</span>
                <span className="font-mono font-semibold text-olive-800">
                  -${inv.discountTotal}
                </span>
              </div>
              <div className="flex justify-between text-olive-800">
                <span>Taxes &amp; Levies:</span>
                <span className="font-mono font-semibold">+${inv.taxTotal}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-olive-950 pt-2 border-t border-cream-300">
                <span>Total Amount:</span>
                <span className="font-mono">${inv.total}</span>
              </div>
              <div className="flex justify-between text-emerald-800 font-medium">
                <span>Amount Paid:</span>
                <span className="font-mono">-${inv.amountPaid}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-rose-700 pt-2 border-t border-cream-300">
                <span>Balance Due:</span>
                <span className="font-mono">${inv.balance}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Transactions Logged in Database */}
      <Card className="border border-cream-300">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-olive-950">
              Payment Transactions
            </CardTitle>
            <p className="text-xs text-olive-700/80">
              Audit trail of payments recorded in database for this invoice
            </p>
          </div>
          {canPay && (
            <Button
              size="sm"
              onClick={handleOpenPayModal}
              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs flex items-center gap-1.5"
            >
              <DollarSign className="w-3.5 h-3.5" /> Record Payment
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-xs text-stone-500 py-3 text-center">
              No payments recorded for this invoice yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cream-200 text-left text-xs font-bold uppercase tracking-wider text-olive-800">
                    <th className="py-2">Date</th>
                    <th className="py-2">Method</th>
                    <th className="py-2 text-right">Amount</th>
                    <th className="py-2">Recorded By</th>
                    <th className="py-2">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200">
                  {payments.map((p: any) => (
                    <tr key={p.id}>
                      <td className="py-2.5 text-xs text-olive-900">
                        {new Date(p.paymentDate).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 text-xs font-semibold text-olive-800">
                        {p.method}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-emerald-800">
                        ${p.amount}
                      </td>
                      <td className="py-2.5 text-xs text-stone-600">
                        {p.recordedBy?.name || 'Staff'}
                      </td>
                      <td className="py-2.5 text-xs text-stone-500">
                        {p.note || '&mdash;'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record Payment Dialog */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-cream-300 p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-cream-200 mb-4">
              <div>
                <h3 className="font-serif font-bold text-lg text-olive-950">Record Payment</h3>
                <p className="text-xs text-olive-700">
                  Apply payment to {inv.number} &bull; Balance: ${inv.balance}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPayModalOpen(false)}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4 text-stone-500" />
              </Button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                recordPaymentMutation.mutate(payForm);
              }}
              className="space-y-4"
            >
              <div>
                <Label className="text-xs font-semibold text-olive-900">Payment Amount ($)</Label>
                <Input
                  type="text"
                  value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                  placeholder="0.00"
                  className="mt-1 font-mono font-bold"
                  required
                />
                <span className="text-[11px] text-stone-500">
                  Maximum allowable: ${inv.balance}
                </span>
              </div>

              <div>
                <Label className="text-xs font-semibold text-olive-900">Payment Method</Label>
                <select
                  value={payForm.method}
                  onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
                  className="mt-1 w-full text-xs h-9 rounded-md border border-cream-300 bg-white px-2.5 text-olive-950 font-medium"
                >
                  <option value="CARD">Credit / Debit Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer / Wire</option>
                  <option value="UPI">UPI Instant Pay</option>
                  <option value="CHEQUE">Cheque / Demand Draft</option>
                  <option value="CASH">Cash</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-olive-900">Payment Date</Label>
                <Input
                  type="date"
                  value={payForm.paymentDate}
                  onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })}
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-olive-900">Note / Reference</Label>
                <textarea
                  value={payForm.note}
                  onChange={(e) => setPayForm({ ...payForm, note: e.target.value })}
                  rows={2}
                  className="mt-1 w-full text-xs p-2 rounded-lg border border-cream-300 focus:outline-none focus:ring-2 focus:ring-olive-500"
                  placeholder="Transaction reference ID or bank memo..."
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-cream-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPayModalOpen(false)}
                  className="border-cream-300 text-olive-900 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={recordPaymentMutation.isPending}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-sm"
                >
                  {recordPaymentMutation.isPending ? 'Logging Payment...' : 'Confirm Payment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
