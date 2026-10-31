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
import { SubscriptionsPage } from './features/subscriptions/SubscriptionsPage';
import { SubscriptionDetailPage } from './features/subscriptions/SubscriptionDetailPage';
import { InvoicesPage } from './features/invoices/InvoicesPage';
import { InvoiceDetailPage } from './features/invoices/InvoiceDetailPage';
import { PaymentsPage } from './features/payments/PaymentsPage';
import { ReportsDashboardPage } from './features/reports/ReportsDashboardPage';
import { PortalSubscriptionsPage } from './features/portal/PortalSubscriptionsPage';
import { PortalInvoicesPage } from './features/portal/PortalInvoicesPage';

const queryClient = new QueryClient();

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

              {/* Catalog & Admin Modules */}
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

              {/* Subscriptions */}
              <Route
                path="/subscriptions"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                    <AppShell>
                      <SubscriptionsPage />
                    </AppShell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/subscriptions/:id"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                    <AppShell>
                      <SubscriptionDetailPage />
                    </AppShell>
                  </ProtectedRoute>
                }
              />

              {/* Invoices */}
              <Route
                path="/invoices"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                    <AppShell>
                      <InvoicesPage />
                    </AppShell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/invoices/:id"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                    <AppShell>
                      <InvoiceDetailPage />
                    </AppShell>
                  </ProtectedRoute>
                }
              />

              {/* Payments & Finance Reports */}
              <Route
                path="/payments"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                    <AppShell>
                      <PaymentsPage />
                    </AppShell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                    <AppShell>
                      <ReportsDashboardPage />
                    </AppShell>
                  </ProtectedRoute>
                }
              />

              {/* User Admin */}
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

              {/* Customer Portal */}
              <Route
                path="/portal/subscriptions"
                element={
                  <ProtectedRoute allowedRoles={['CUSTOMER']}>
                    <AppShell>
                      <PortalSubscriptionsPage />
                    </AppShell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/portal/invoices"
                element={
                  <ProtectedRoute allowedRoles={['CUSTOMER']}>
                    <AppShell>
                      <PortalInvoicesPage />
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
