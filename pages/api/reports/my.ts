import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { ReportDAO } from "@/database/models/Report.dao";
import { VoucherDAO } from "@/database/models/Voucher.dao";

/**
 * GET /api/reports/my
 * Returns the authenticated user's reports (newest first), excluding images to keep response light.
 * Also includes any vouchers issued for each report.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: "Please sign in to view your reports." });
    }

    const reports = await ReportDAO.getByUserId(userId);

    // Exclude images field to keep response light
    const reportsWithoutImages = reports.map(({ images, ...rest }) => rest);

    // Fetch vouchers for all reports in one query
    const reportIds = reports.map((r) => r.id);
    const allVouchers = await VoucherDAO.getByReportIds(reportIds);

    // Group vouchers by reportId
    const vouchersByReport: Record<string, typeof allVouchers> = {};
    for (const v of allVouchers) {
      if (v.reportId) {
        if (!vouchersByReport[v.reportId]) vouchersByReport[v.reportId] = [];
        vouchersByReport[v.reportId].push(v);
      }
    }

    const reportsWithVouchers = reportsWithoutImages.map((r) => ({
      ...r,
      vouchers: (vouchersByReport[r.id] || []).map((v) => ({
        id: v.id,
        creditType: v.creditType,
        credits: v.credits,
        status: v.status,
        expiresAt: v.expiresAt,
        createdAt: v.createdAt,
      })),
    }));

    return res.status(200).json({
      success: true,
      reports: reportsWithVouchers,
    });
  } catch (err) {
    console.error("[Reports] GET /api/reports/my error:", err);
    return res.status(500).json({ error: "Failed to fetch reports." });
  }
}
