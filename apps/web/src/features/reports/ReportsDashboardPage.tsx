import { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  TrendingUp,
  CreditCard,
  AlertCircle,
  Clock,
  Layers,
  ArrowUpRight,
  Filter,
  RotateCcw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  useReportSummary,
  useRevenueByMonth,
  useOverdueReport,
  useRecentPayments,
} from './useReports';
import { Link } from 'react-router-dom';

export function ReportsDashboardPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('');

  const filters = {
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    status: status || undefined,
  };

  const { data: summary, isLoading: isSummaryLoading } = useReportSummary(filters);
  const { data: revenueData, isLoading: isRevenueLoading } = useRevenueByMonth(filters);
  const { data: overdueData, isLoading: isOverdueLoading } = useOverdueReport(filters);
  const { data: paymentsData, isLoading: isPaymentsLoading } = useRecentPayments(10);

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setStatus('');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Page Header */}
      <PageHeader
        title="Finance Dashboard & Reports"
        description="Comprehensive real-time analytics covering recurring run rate (MRR), revenue collections, overdue aging, and payment audit logs."
      />

      {/* Filter Controls */}
      <Card className="border border-cream-300 bg-white shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-olive-700" />
              <span className="text-xs font-bold uppercase tracking-wider text-olive-900">
                Filters:
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <label className="text-xs text-stone-500 font-medium">From:</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 text-xs w-36"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <label className="text-xs text-stone-500 font-medium">To:</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 text-xs w-36"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <label className="text-xs text-stone-500 font-medium">Status:</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-8 text-xs rounded-md border border-cream-300 bg-white px-2.5 text-olive-950 font-medium"
              >
                <option value="">All Contracts</option>
                <option value="ACTIVE">Active Only</option>
                <option value="PAUSED">Paused</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
          </div>

          {(startDate || endDate || status) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="text-xs text-stone-600 hover:text-stone-900 flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear Filters
            </Button>
          )}
        </div>
      </Card>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Active Subscriptions */}
        <Card className="border border-cream-300 bg-white shadow-sm hover:border-olive-300 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-olive-800">
              Active Subs
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-olive-100 border border-olive-200 text-olive-800 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-olive-950">
              {isSummaryLoading ? '...' : summary?.activeSubscriptionsCount ?? 0}
            </div>
            <p className="text-[11px] text-olive-700 font-semibold mt-1 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-olive-600" /> Active contracts
            </p>
          </CardContent>
        </Card>

        {/* Monthly Recurring Revenue */}
        <Card className="border border-cream-300 bg-white shadow-sm hover:border-olive-300 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-olive-800">
              Monthly Run (MRR)
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-cream-200 border border-cream-300 text-olive-900 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-olive-950">
              {isSummaryLoading ? '...' : `$${summary?.mrr || '0.00'}`}
            </div>
            <p className="text-[11px] text-olive-700 font-semibold mt-1 flex items-center gap-1">
              Normalized monthly run
            </p>
          </CardContent>
        </Card>

        {/* Revenue Collected */}
        <Card className="border border-cream-300 bg-white shadow-sm hover:border-olive-300 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-olive-800">
              Collected
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-800 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-800">
              {isSummaryLoading ? '...' : `$${summary?.revenueCollected || '0.00'}`}
            </div>
            <p className="text-[11px] text-emerald-700 font-semibold mt-1">
              Total settled receipts
            </p>
          </CardContent>
        </Card>

        {/* Outstanding Receivables */}
        <Card className="border border-cream-300 bg-white shadow-sm hover:border-olive-300 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-olive-800">
              Outstanding
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-900">
              {isSummaryLoading ? '...' : `$${summary?.outstandingTotal || '0.00'}`}
            </div>
            <p className="text-[11px] text-amber-700 font-semibold mt-1">
              Confirmed uncollected
            </p>
          </CardContent>
        </Card>

        {/* Overdue Amount & Count */}
        <Card className="border border-cream-300 bg-white shadow-sm hover:border-rose-300 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-rose-800">
              Overdue
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-rose-100 border border-rose-200 text-rose-800 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-700">
              {isSummaryLoading ? '...' : `$${summary?.overdueTotal || '0.00'}`}
            </div>
            <p className="text-[11px] text-rose-600 font-semibold mt-1">
              {summary ? `${summary.overdueCount} accounts past due` : 'Arrears'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue By Month Chart (Recharts) */}
      <Card className="border border-cream-300 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold text-olive-950">
            Revenue Trend by Month
          </CardTitle>
          <CardDescription className="text-xs text-olive-700">
            Historical settlement volume grouped chronologically
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full pt-2">
            {isRevenueLoading ? (
              <div className="h-full flex items-center justify-center text-xs text-stone-500">
                Loading revenue trend...
              </div>
            ) : revenueData && revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EBE5D3" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#475731', fontSize: 12 }}
                    stroke="#CEBE9A"
                  />
                  <YAxis
                    tick={{ fill: '#475731', fontSize: 12 }}
                    stroke="#CEBE9A"
                    tickFormatter={(val) => `$${val}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FAF8F2',
                      borderColor: '#D3DCC5',
                      borderRadius: '8px',
                      color: '#181E11',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [`$${val}`, 'Revenue']}
                  />
                  <Bar dataKey="revenue" fill="#5A6F3F" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-stone-500">
                No revenue records available for the selected period.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dual Tables: Overdue Invoices & Recent Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue Invoices Table */}
        <Card className="border border-cream-300 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold text-olive-950 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600" /> Overdue Invoices
              </CardTitle>
              <CardDescription className="text-xs text-stone-500">
                Accounts exceeding payment term due dates
              </CardDescription>
            </div>
            <Link to="/invoices">
              <Button variant="ghost" size="sm" className="text-xs text-olive-800">
                View All &rarr;
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isOverdueLoading ? (
              <p className="text-xs text-stone-500 py-6 text-center">Loading overdue accounts...</p>
            ) : overdueData && overdueData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-cream-200 text-left font-bold uppercase tracking-wider text-olive-800">
                      <th className="py-2">Invoice #</th>
                      <th className="py-2">Customer</th>
                      <th className="py-2">Due Date</th>
                      <th className="py-2 text-right">Balance Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-200">
                    {overdueData.slice(0, 6).map((inv) => (
                      <tr key={inv.id} className="hover:bg-cream-50/50">
                        <td className="py-2.5 font-mono font-bold text-olive-900">
                          <Link to={`/invoices/${inv.id}`} className="hover:underline">
                            {inv.number}
                          </Link>
                        </td>
                        <td className="py-2.5 font-medium text-olive-950">
                          {inv.customerName}
                        </td>
                        <td className="py-2.5 text-rose-700 font-semibold">
                          {new Date(inv.dueDate).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 text-right font-mono font-bold text-rose-700">
                          ${inv.balance}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-stone-500 py-6 text-center">
                All confirmed invoices are within payment terms! Zero overdue accounts.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent Payments Table */}
        <Card className="border border-cream-300 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold text-olive-950 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-700" /> Recent Payments
              </CardTitle>
              <CardDescription className="text-xs text-stone-500">
                Latest customer transaction settlements
              </CardDescription>
            </div>
            <Link to="/payments">
              <Button variant="ghost" size="sm" className="text-xs text-olive-800">
                View Ledger &rarr;
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isPaymentsLoading ? (
              <p className="text-xs text-stone-500 py-6 text-center">Loading transactions...</p>
            ) : paymentsData && paymentsData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-cream-200 text-left font-bold uppercase tracking-wider text-olive-800">
                      <th className="py-2">Date</th>
                      <th className="py-2">Invoice #</th>
                      <th className="py-2">Method</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-200">
                    {paymentsData.slice(0, 6).map((p) => (
                      <tr key={p.id} className="hover:bg-cream-50/50">
                        <td className="py-2.5 text-stone-600">
                          {new Date(p.paymentDate).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 font-mono font-bold text-olive-900">
                          {p.invoiceNumber}
                        </td>
                        <td className="py-2.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-olive-100 text-olive-800 border border-olive-200">
                            {p.method}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-mono font-bold text-emerald-800">
                          ${p.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-stone-500 py-6 text-center">
                No payment transactions recorded yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
