import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  Package,
  Layers,
  Receipt,
  Tag,
  FileSpreadsheet,
  FileText,
  CreditCard,
  BarChart3,
  LogOut,
  Menu,
  X,
  UserCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const role = user?.role || 'CUSTOMER';

  // Navigation definition based on AGENTS.md sections 7 & PROMPTS.md P1-3
  const staffAndAdminNav: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'Products', href: '/products', icon: Package },
    { name: 'Plans', href: '/plans', icon: Layers },
    { name: 'Taxes', href: '/taxes', icon: Receipt },
    { name: 'Discounts', href: '/discounts', icon: Tag },
    { name: 'Templates', href: '/templates', icon: FileSpreadsheet },
    { name: 'Subscriptions', href: '/subscriptions', icon: FileText },
    { name: 'Invoices', href: '/invoices', icon: Receipt },
    { name: 'Payments', href: '/payments', icon: CreditCard },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    { name: 'Users', href: '/users', icon: UserCheck, adminOnly: true },
  ];

  const customerNav: NavItem[] = [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'My Subscriptions', href: '/portal/subscriptions', icon: FileText },
    { name: 'My Invoices', href: '/portal/invoices', icon: Receipt },
  ];

  const rawNav = role === 'CUSTOMER' ? customerNav : staffAndAdminNav;
  const navItems = rawNav.filter((item) => (item.adminOnly ? role === 'ADMIN' : true));

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-border sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-olive-100 border border-olive-200 flex items-center justify-center text-primary">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="font-serif font-bold text-lg text-foreground">RevenIQ</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg text-muted-foreground hover:bg-cream-100"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar for Desktop */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-cream-300 flex flex-col justify-between transition-transform duration-200 ease-in-out md:static md:translate-x-0',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-5 flex-1 overflow-y-auto">
          {/* Brand */}
          <div className="flex items-center gap-3 px-2 py-1 mb-8">
            <div className="w-10 h-10 rounded-xl bg-olive-100 border border-olive-200 flex items-center justify-center text-primary shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-serif font-bold text-lg text-foreground tracking-tight leading-tight">
                RevenIQ
              </h1>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-primary">
                Revenue Intelligence
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/dashboard'
                  ? location.pathname === '/dashboard' || location.pathname === '/'
                  : location.pathname.startsWith(item.href);

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-olive-100/90 text-olive-950 font-bold border-2 border-olive-300/80 shadow-2xs'
                      : 'text-olive-900/75 hover:bg-cream-100 hover:text-olive-950 font-medium'
                  )}
                >
                  <Icon className={cn('w-4 h-4', isActive ? 'text-olive-800' : 'text-olive-600')} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout at bottom of sidebar */}
        <div className="p-4 border-t border-cream-200 bg-cream-50/70">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-olive-200 border border-olive-300 text-olive-950 font-bold text-xs flex items-center justify-center shrink-0">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-olive-950 truncate">{user?.name}</p>
                <p className="text-[11px] text-olive-800/80 font-medium truncate">{user?.email}</p>
              </div>
            </div>
            <Badge
              variant={
                role === 'ADMIN' ? 'confirmed' : role === 'STAFF' ? 'active' : 'quotation'
              }
              className="text-[10px] font-bold tracking-wider px-2 py-0.5"
            >
              {role}
            </Badge>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="w-full justify-start text-xs font-semibold text-olive-800 hover:text-rose-700 hover:bg-rose-50/80 h-8 rounded-md"
          >
            <LogOut className="w-3.5 h-3.5 mr-2 text-olive-700" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}

