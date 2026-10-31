import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './lib/auth-context';
import { ToastProvider } from './components/ui/toast';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './features/auth/LoginPage';
import { SignupPage } from './features/auth/SignupPage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { ForbiddenPage } from './pages/ForbiddenPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { UsersPage } from './features/users/UsersPage';
import { CustomersPage } from './features/users/CustomersPage';
import { ProductsPage } from './features/catalog/ProductsPage';
import { PlansPage } from './features/catalog/PlansPage';
import { TaxesPage } from './features/catalog/TaxesPage';
import { DiscountsPage } from './features/catalog/DiscountsPage';
import { TemplatesPage } from './features/catalog/TemplatesPage';

const queryClient = new QueryClient();

function ModulePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-4">
      <div className="border-b border-cream-200 pb-4">
        <h2 className="text-2xl font-serif font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="p-12 text-center border-2 border-dashed border-cream-300 rounded-xl bg-white/50">
        <p className="text-sm font-medium text-muted-foreground">
          {title} module ready for person assignment per AGENTS.md.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Auth Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Protected App Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Navigate to="/dashboard" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <AppShell>
                      <DashboardPage />
                    </AppShell>
                  </ProtectedRoute>
                }
              />

              {/* Module routes */}
              <Route
                path="/customers"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                    <AppShell>
                      <CustomersPage />
                    </AppShell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/products"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                    <AppShell>
                      <ProductsPage />
                    </AppShell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/plans"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                    <AppShell>
                      <PlansPage />
                    </AppShell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/taxes"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                    <AppShell>
                      <TaxesPage />
                    </AppShell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/discounts"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                    <AppShell>
                      <DiscountsPage />
                    </AppShell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/templates"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                    <AppShell>
                      <TemplatesPage />
                    </AppShell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/subscriptions"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                    <AppShell>
                      <ModulePlaceholder
                        title="Subscriptions"
                        description="Manage active contracts, pause, resume, close, and renew transitions."
                      />
                    </AppShell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/invoices"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                    <AppShell>
                      <ModulePlaceholder
                        title="Invoices & Billing"
                        description="Recurring invoices, payment terms, and automated overdue tracking."
                      />
                    </AppShell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payments"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                    <AppShell>
                      <ModulePlaceholder
                        title="Payments"
                        description="Record and reconcile customer payments against invoices."
                      />
                    </AppShell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                    <AppShell>
                      <ModulePlaceholder
                        title="Finance Reports & Analytics"
                        description="MRR metrics, overdue aging, and monthly revenue collection charts."
                      />
                    </AppShell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/users"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AppShell>
                      <UsersPage />
                    </AppShell>
                  </ProtectedRoute>
                }
              />

              {/* Portal Routes for CUSTOMER */}
              <Route
                path="/portal/subscriptions"
                element={
                  <ProtectedRoute allowedRoles={['CUSTOMER']}>
                    <AppShell>
                      <ModulePlaceholder
                        title="My Subscriptions"
                        description="View and manage your active subscriptions and renewals."
                      />
                    </AppShell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/portal/invoices"
                element={
                  <ProtectedRoute allowedRoles={['CUSTOMER']}>
                    <AppShell>
                      <ModulePlaceholder
                        title="My Invoices"
                        description="Review past invoices, receipts, and payment confirmations."
                      />
                    </AppShell>
                  </ProtectedRoute>
                }
              />

              {/* Error Pages */}
              <Route path="/403" element={<ForbiddenPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
