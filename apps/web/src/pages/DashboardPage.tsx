import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  CreditCard,
  FileText,
  AlertCircle,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export function DashboardPage() {
  const { user } = useAuth();
  const role = user?.role || 'CUSTOMER';

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-olive-800 via-primary to-olive-900 p-8 text-white shadow-premium">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-cream-200 text-xs font-medium mb-4 border border-white/15">
            <Sparkles className="w-3.5 h-3.5 text-cream-300" />
            <span>Revenue Intelligence &amp; Subscription Engine</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold tracking-tight text-cream-50 mb-2">
            Welcome back, {user?.name}
          </h1>
          <p className="text-cream-200 text-sm md:text-base leading-relaxed opacity-90">
            {role === 'CUSTOMER'
              ? 'Manage your subscriptions, view invoices, and track billing cycles directly from your portal.'
              : 'Monitor revenue flow, run scheduled billing, track overdue accounts, and manage subscriptions with precision.'}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {role === 'CUSTOMER' ? (
              <>
                <Link to="/portal/subscriptions">
                  <Button className="bg-white hover:bg-cream-100 text-olive-900 font-semibold shadow-sm">
                    My Subscriptions
                  </Button>
                </Link>
                <Link to="/portal/invoices">
                  <Button variant="outline" className="border-white/30 text-white hover:bg-white/10">
                    My Invoices
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/subscriptions">
                  <Button className="bg-white hover:bg-cream-100 text-olive-900 font-semibold shadow-sm">
                    View Subscriptions
                  </Button>
                </Link>
                <Link to="/invoices">
                  <Button variant="outline" className="border-white/30 text-white hover:bg-white/10">
                    Manage Invoices
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Subtle Decorative Background Rings */}
        <div className="absolute -right-10 -bottom-10 w-80 h-80 bg-white/5 rounded-full pointer-events-none blur-2xl" />
        <div className="absolute right-40 top-0 w-48 h-48 bg-cream-400/10 rounded-full pointer-events-none blur-xl" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="border border-cream-300 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {role === 'CUSTOMER' ? 'Active Plans' : 'Active Subscriptions'}
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-olive-100 text-primary flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {role === 'CUSTOMER' ? '1' : '24'}
            </div>
            <p className="text-xs text-olive-700 font-medium flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> All systems healthy
            </p>
          </CardContent>
        </Card>

        <Card className="border border-cream-300 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {role === 'CUSTOMER' ? 'Total Paid' : 'Monthly Recurring (MRR)'}
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-cream-200 text-olive-900 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {role === 'CUSTOMER' ? '$1,450.00' : '$28,450.00'}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-olive-600" />
              <span>Normalized across cycles</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border border-cream-300 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Invoices
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-olive-50 text-olive-700 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {role === 'CUSTOMER' ? '3' : '142'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Up to date</p>
          </CardContent>
        </Card>

        <Card className="border border-cream-300 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Overdue Balance
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">$0.00</div>
            <p className="text-xs text-olive-700 font-medium mt-1">Zero outstanding arrears</p>
          </CardContent>
        </Card>
      </div>

      {/* Account Info Card */}
      <Card className="border border-cream-300">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Security &amp; Account Details</CardTitle>
          <CardDescription>
            Account metadata and role privileges assigned to your current session
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div className="p-4 rounded-xl bg-cream-50 border border-cream-200">
              <span className="text-xs font-medium text-muted-foreground block mb-1">
                Account Email
              </span>
              <span className="font-semibold text-foreground">{user?.email}</span>
            </div>

            <div className="p-4 rounded-xl bg-cream-50 border border-cream-200">
              <span className="text-xs font-medium text-muted-foreground block mb-1">
                Role &amp; Permissions
              </span>
              <Badge variant={role === 'ADMIN' ? 'confirmed' : 'active'} className="mt-0.5">
                {role}
              </Badge>
            </div>

            <div className="p-4 rounded-xl bg-cream-50 border border-cream-200">
              <span className="text-xs font-medium text-muted-foreground block mb-1">
                Authentication Status
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-olive-800">
                <span className="w-2 h-2 rounded-full bg-olive-500 animate-pulse" />
                Active Session (httpOnly JWT)
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
