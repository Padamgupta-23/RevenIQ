import { useAuth } from '@/lib/auth-context';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  TrendingUp,
  CreditCard,
  FileText,
  AlertCircle,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Calendar,
  Layers,
  Database,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface DashboardSummary {
  activeSubscriptionsCount: number;
  totalRevenue: string;
  invoicesCount: number;
  overdueBalance: string;
  overdueCount: number;
  mrr: string;
  customersCount?: number;
  recentInvoices: {
    id: string;
    number: string;
    customerName: string;
    total: string;
    status: 'DRAFT' | 'CONFIRMED' | 'PAID' | 'CANCELLED';
    dueDate: string;
    isOverdue: boolean;
  }[];
}

export function DashboardPage() {
  const { user } = useAuth();
  const role = user?.role || 'CUSTOMER';

  // Fetch live aggregated data from database
  const { data: summaryData, isLoading } = useQuery<{ data: DashboardSummary }>({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const res = await apiClient.get('/reports/summary');
      return res.data;
    },
    refetchInterval: 30000,
  });

  const summary = summaryData?.data;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Premium Light Olive & Cream Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cream-100 via-white to-olive-100/60 p-7 md:p-9 border-2 border-olive-200/90 shadow-sm">
        <div className="relative z-10 max-w-3xl">
          {/* Subtle Pill Tag */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-olive-100/90 border border-olive-300 text-olive-900 text-xs font-semibold mb-3.5 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-olive-700" />
            <span>Revenue Intelligence &amp; Subscription Engine</span>
          </div>

          {/* High-Contrast Bold Heading */}
          <h1 className="text-3xl md:text-4xl font-serif font-bold tracking-tight text-olive-950 mb-2.5">
            Welcome back, {user?.name || 'Valued Partner'}
          </h1>

          {/* Legible Subtitle */}
          <p className="text-olive-800/90 text-sm md:text-base leading-relaxed font-normal mb-6 max-w-2xl">
            {role === 'CUSTOMER'
              ? 'Your subscription portal is ready. Review your active tier, track billing schedules, and download invoices.'
              : 'Enterprise overview: Monitor recurring revenue, automate cycle runs, and oversee subscription lifecycles.'}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {role === 'CUSTOMER' ? (
              <>
                <Link to="/portal/subscriptions">
                  <Button className="bg-olive-800 hover:bg-olive-900 text-white font-semibold px-5 py-2.5 shadow-sm rounded-lg flex items-center gap-2">
                    <FileText className="w-4 h-4" /> My Subscriptions
                  </Button>
                </Link>
                <Link to="/portal/invoices">
                  <Button
                    variant="outline"
                    className="border-2 border-olive-300 bg-white hover:bg-cream-100 text-olive-900 font-semibold px-5 py-2.5 rounded-lg shadow-2xs"
                  >
                    <ReceiptIcon className="w-4 h-4" /> My Invoices
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/subscriptions">
                  <Button className="bg-olive-800 hover:bg-olive-900 text-white font-semibold px-5 py-2.5 shadow-sm rounded-lg flex items-center gap-2">
                    <Layers className="w-4 h-4" /> View Subscriptions
                  </Button>
                </Link>
                <Link to="/invoices">
                  <Button
                    variant="outline"
                    className="border-2 border-olive-300 bg-white hover:bg-cream-100 text-olive-900 font-semibold px-5 py-2.5 rounded-lg shadow-2xs"
                  >
                    <CreditCard className="w-4 h-4" /> Manage Invoices
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Decorative Light Aesthetic Watermark */}
        <div className="absolute right-4 bottom-2 opacity-15 pointer-events-none hidden md:block">
          <ShieldCheck className="w-48 h-48 text-olive-700" />
        </div>
      </div>

      {/* KPI Cards (Powered directly by Database) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="border border-cream-300 bg-white shadow-sm hover:border-olive-300 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-olive-900/80">
              {role === 'CUSTOMER' ? 'Active Plans' : 'Active Subscriptions'}
            </CardTitle>
            <div className="w-9 h-9 rounded-lg bg-olive-100 border border-olive-200 text-olive-800 flex items-center justify-center">
              <FileText className="w-4.5 h-4.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-olive-950">
              {isLoading ? '...' : summary?.activeSubscriptionsCount ?? 0}
            </div>
            <p className="text-xs text-olive-700 font-semibold flex items-center gap-1.5 mt-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-olive-600" /> Active contracts in database
            </p>
          </CardContent>
        </Card>

        <Card className="border border-cream-300 bg-white shadow-sm hover:border-olive-300 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-olive-900/80">
              {role === 'CUSTOMER' ? 'Total Paid' : 'Monthly Recurring (MRR)'}
            </CardTitle>
            <div className="w-9 h-9 rounded-lg bg-cream-200 border border-cream-300 text-olive-900 flex items-center justify-center">
              <TrendingUp className="w-4.5 h-4.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-olive-950">
              {isLoading
                ? '...'
                : role === 'CUSTOMER'
                ? `$${summary?.totalRevenue || '0.00'}`
                : `$${summary?.mrr || '0.00'}`}
            </div>
            <p className="text-xs text-olive-700 font-semibold flex items-center gap-1 mt-1.5">
              <ArrowUpRight className="w-3.5 h-3.5 text-olive-600" />
              {role === 'CUSTOMER' ? 'Total payments settled' : 'Normalized recurring run rate'}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-cream-300 bg-white shadow-sm hover:border-olive-300 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-olive-900/80">
              Total Invoices
            </CardTitle>
            <div className="w-9 h-9 rounded-lg bg-olive-100 border border-olive-200 text-olive-800 flex items-center justify-center">
              <CreditCard className="w-4.5 h-4.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-olive-950">
              {isLoading ? '...' : summary?.invoicesCount ?? 0}
            </div>
            <p className="text-xs text-olive-700 font-semibold flex items-center gap-1 mt-1.5">
              <Calendar className="w-3.5 h-3.5 text-olive-600" /> Cycle records generated
            </p>
          </CardContent>
        </Card>

        <Card className="border border-cream-300 bg-white shadow-sm hover:border-olive-300 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-olive-900/80">
              Overdue Balance
            </CardTitle>
            <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center">
              <AlertCircle className="w-4.5 h-4.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-olive-950">
              {isLoading ? '...' : `$${summary?.overdueBalance || '0.00'}`}
            </div>
            <p className="text-xs text-olive-700 font-semibold mt-1.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-olive-600" />
              {summary && summary.overdueCount > 0
                ? `${summary.overdueCount} invoices past due`
                : 'Zero outstanding arrears'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Invoices Live from Database */}
      {summary && summary.recentInvoices && summary.recentInvoices.length > 0 && (
        <Card className="border border-cream-300 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-olive-950">
                Recent Invoices
              </CardTitle>
              <CardDescription className="text-olive-700 font-normal">
                Latest billing cycles generated and stored in the database
              </CardDescription>
            </div>
            <Link to={role === 'CUSTOMER' ? '/portal/invoices' : '/invoices'}>
              <Button variant="ghost" size="sm" className="text-xs text-olive-800 hover:text-olive-950 flex items-center gap-1">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-cream-200">
              {summary.recentInvoices.map((inv) => (
                <div key={inv.id} className="py-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-olive-900">{inv.number}</span>
                    <span className="text-xs text-olive-700 hidden sm:inline">&bull; {inv.customerName}</span>
                    <span className="text-xs text-stone-500">Due {new Date(inv.dueDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-olive-950">${inv.total}</span>
                    <StatusBadge
                      status={inv.isOverdue ? 'OVERDUE' : (inv.status as any)}
                      label={inv.isOverdue ? 'Overdue' : undefined}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account Info Card */}
      <Card className="border border-cream-300 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-olive-950">
            Account &amp; Database Source
          </CardTitle>
          <CardDescription className="text-olive-700 font-normal">
            Real-time authentication and database persistence details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-sm">
            <div className="p-4 rounded-xl bg-cream-50 border border-cream-200">
              <span className="text-xs font-bold uppercase tracking-wider text-olive-800/80 block mb-1">
                Account Email
              </span>
              <span className="font-semibold text-olive-950 text-base">{user?.email}</span>
            </div>

            <div className="p-4 rounded-xl bg-cream-50 border border-cream-200">
              <span className="text-xs font-bold uppercase tracking-wider text-olive-800/80 block mb-1">
                Role Permissions
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge
                  variant={role === 'ADMIN' ? 'confirmed' : 'active'}
                  className="text-xs font-bold uppercase px-3 py-1"
                >
                  {role}
                </Badge>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-cream-50 border border-cream-200">
              <span className="text-xs font-bold uppercase tracking-wider text-olive-800/80 block mb-1">
                Storage &amp; Sync Engine
              </span>
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-olive-900">
                <Database className="w-4 h-4 text-olive-700" />
                Live PostgreSQL Database
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReceiptIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <path d="M12 17.5v-11" />
    </svg>
  );
}
