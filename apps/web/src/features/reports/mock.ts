export interface MockReportSummary {
  activeSubscriptionsCount: number;
  revenueCollected: string;
  outstandingTotal: string;
  invoicesCount: number;
  overdueCount: number;
  overdueTotal: string;
  mrr: string;
}

export interface MockRevenueMonth {
  month: string;
  revenue: string;
  count: number;
}

export interface MockOverdueInvoice {
  id: string;
  number: string;
  customerName: string;
  customerEmail: string;
  dueDate: string;
  total: string;
  amountPaid: string;
  balance: string;
}

export interface MockPaymentRecord {
  id: string;
  invoiceNumber: string;
  customerName: string;
  method: string;
  amount: string;
  paymentDate: string;
  note: string | null;
}

export const mockReportSummary: MockReportSummary = {
  activeSubscriptionsCount: 185,
  revenueCollected: '42550.00',
  outstandingTotal: '6450.00',
  invoicesCount: 1324,
  overdueCount: 22,
  overdueTotal: '2324.00',
  mrr: '17449.00',
};

export const mockRevenueByMonth: MockRevenueMonth[] = [
  { month: '2026-05', revenue: '8200.00', count: 18 },
  { month: '2026-06', revenue: '12400.00', count: 26 },
  { month: '2026-07', revenue: '16800.00', count: 35 },
  { month: '2026-08', revenue: '22100.00', count: 48 },
  { month: '2026-09', revenue: '31500.00', count: 64 },
  { month: '2026-10', revenue: '42550.00', count: 85 },
];

export const mockOverdueInvoices: MockOverdueInvoice[] = [
  {
    id: 'inv-od-1',
    number: 'INV-000412',
    customerName: 'Acme Global Corp',
    customerEmail: 'billing@acmeglobal.com',
    dueDate: '2026-10-15',
    total: '1200.00',
    amountPaid: '0.00',
    balance: '1200.00',
  },
  {
    id: 'inv-od-2',
    number: 'INV-000445',
    customerName: 'Nexus Tech Labs',
    customerEmail: 'finance@nexustech.io',
    dueDate: '2026-10-20',
    total: '850.00',
    amountPaid: '200.00',
    balance: '650.00',
  },
  {
    id: 'inv-od-3',
    number: 'INV-000488',
    customerName: 'Strata Cloud Systems',
    customerEmail: 'accounts@stratacloud.com',
    dueDate: '2026-10-25',
    total: '474.00',
    amountPaid: '0.00',
    balance: '474.00',
  },
];

export const mockRecentPayments: MockPaymentRecord[] = [
  {
    id: 'pay-1',
    invoiceNumber: 'INV-000501',
    customerName: 'Acme Global Corp',
    method: 'CARD',
    amount: '1200.00',
    paymentDate: '2026-10-31',
    note: 'Auto-debit recurring renewal',
  },
  {
    id: 'pay-2',
    invoiceNumber: 'INV-000499',
    customerName: 'HyperScale AI',
    method: 'BANK_TRANSFER',
    amount: '2400.00',
    paymentDate: '2026-10-30',
    note: 'Wire transfer ref #WT-88412',
  },
  {
    id: 'pay-3',
    invoiceNumber: 'INV-000495',
    customerName: 'Aura Design Co',
    method: 'UPI',
    amount: '350.00',
    paymentDate: '2026-10-29',
    note: 'Instant UPI settlement',
  },
];

