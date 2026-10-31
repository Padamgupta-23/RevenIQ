import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import {
  mockReportSummary,
  mockRevenueByMonth,
  mockOverdueInvoices,
  mockRecentPayments,
  MockReportSummary,
  MockRevenueMonth,
  MockOverdueInvoice,
  MockPaymentRecord,
} from './mock';

// Change to false if running in offline mock demo mode
export const USE_REAL_API = true;

export interface ReportsFilter {
  startDate?: string;
  endDate?: string;
  status?: string;
}

export function useReportSummary(filters?: ReportsFilter) {
  return useQuery<MockReportSummary>({
    queryKey: ['report-summary', filters?.startDate, filters?.endDate, filters?.status],
    queryFn: async () => {
      if (!USE_REAL_API) {
        return mockReportSummary;
      }
      const params = new URLSearchParams();
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);
      if (filters?.status) params.append('status', filters.status);

      const res = await apiClient.get(`/reports/summary?${params.toString()}`);
      return res.data?.data;
    },
  });
}

export function useRevenueByMonth(filters?: ReportsFilter) {
  return useQuery<MockRevenueMonth[]>({
    queryKey: ['report-revenue-month', filters?.startDate, filters?.endDate],
    queryFn: async () => {
      if (!USE_REAL_API) {
        return mockRevenueByMonth;
      }
      const params = new URLSearchParams();
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);

      const res = await apiClient.get(`/reports/revenue?${params.toString()}`);
      return res.data?.data;
    },
  });
}

export function useOverdueReport(filters?: ReportsFilter) {
  return useQuery<MockOverdueInvoice[]>({
    queryKey: ['report-overdue', filters?.startDate, filters?.endDate],
    queryFn: async () => {
      if (!USE_REAL_API) {
        return mockOverdueInvoices;
      }
      const res = await apiClient.get('/reports/overdue');
      return res.data?.data;
    },
  });
}

export function useRecentPayments(limit = 10) {
  return useQuery<MockPaymentRecord[]>({
    queryKey: ['report-recent-payments', limit],
    queryFn: async () => {
      if (!USE_REAL_API) {
        return mockRecentPayments;
      }
      const res = await apiClient.get(`/payments?pageSize=${limit}`);
      return (res.data?.data || []).map((p: any) => ({
        id: p.id,
        invoiceNumber: p.invoiceNumber,
        customerName: p.customerName,
        method: p.method,
        amount: p.amount,
        paymentDate: p.paymentDate,
        note: p.note,
      }));
    },
  });
}

