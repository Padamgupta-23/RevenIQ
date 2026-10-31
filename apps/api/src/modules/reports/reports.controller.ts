import { Request, Response } from 'express';
import { ok } from '../../lib/response.js';
import * as reportsService from './reports.service.js';
import { ReportsFilterInput } from './reports.schemas.js';

export async function getDashboardSummaryHandler(req: Request, res: Response) {
  const filters: ReportsFilterInput = req.query as any;
  const summary = await reportsService.getDashboardSummary(filters, req.user!);
  ok(res, summary);
}

export async function getOverdueReportHandler(req: Request, res: Response) {
  const filters: ReportsFilterInput = req.query as any;
  const overdue = await reportsService.getOverdueReport(filters, req.user!);
  ok(res, overdue);
}

export async function getRevenueReportHandler(req: Request, res: Response) {
  const filters: ReportsFilterInput = req.query as any;
  const revenue = await reportsService.getRevenueByMonthReport(filters, req.user!);
  ok(res, revenue);
}

export async function getSubscriptionsReportHandler(req: Request, res: Response) {
  const filters: ReportsFilterInput = req.query as any;
  const breakdown = await reportsService.getSubscriptionsReport(filters, req.user!);
  ok(res, breakdown);
}
