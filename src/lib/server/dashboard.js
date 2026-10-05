// Shared server-side dashboard data loader. Both the dashboard aggregation
// route and the drill-down route consume the SAME filtered dataset, so a
// drill-down opened from a filtered dashboard always pages over exactly the
// records the visible KPIs/charts were computed from. Never mix the two
// sources.
//
// MongoDB version - uses mongodbService for data access.

import { loadDashboardQuotations as loadDashboardQuotationsFromMongo } from "@/lib/services/mongodbService";
import { parseQuotationDate, toDateKey, startOfWeek } from "@/lib/utils/dateUtils";

export const PENDING_STATUS = "Pending";

export function normalizeOrderStatus(raw) {
  const v = String(raw || "").trim();
  return v ? v : PENDING_STATUS;
}

// Enrich + filter exactly like /api/dashboard so drill-downs always operate on
// the same records as the visible dashboard figures.
export async function loadDashboardQuotations(filters = {}) {
  // Use MongoDB service to get filtered quotations
  const { list } = await loadDashboardQuotationsFromMongo(filters);
  
  // The MongoDB service already returns quotations with sourceOfEnquiry and parsedDate
  // but we need to ensure the shape matches what the dashboard expects
  const enriched = list.map((q) => ({
    ...q,
    sourceOfEnquiry: q.sourceOfEnquiry || "",
    parsedDate: q.parsedDate || parseQuotationDate(q.quotationDate),
    engineer: q.engineer || "",
  }));

  let filteredList = enriched;

  if (filters.division) {
    filteredList = filteredList.filter((q) => (q.division || "").trim() === filters.division);
  }

  if (filters.orderStatus) {
    filteredList = filteredList.filter((q) => normalizeOrderStatus(q.orderStatus) === filters.orderStatus);
  }

  if (filters.enquiryGeneratedBy) {
    filteredList = filteredList.filter((q) => (q.engineer || "").trim() === filters.enquiryGeneratedBy);
  }

  // Date range filtering uses inclusive day bounds, matching /api/dashboard and
  // the quotations list page.
  let dateRange = { from: null, to: null };
  if (filters.from) dateRange.from = parseQuotationDate(filters.from);
  if (filters.to) dateRange.to = parseQuotationDate(filters.to);

  if (dateRange.from || dateRange.to) {
    filteredList = filteredList.filter((q) => {
      if (!q.parsedDate) return false;
      if (dateRange.from && q.parsedDate < dateRange.from) return false;
      if (dateRange.to && q.parsedDate > dateRange.to) return false;
      return true;
    });
  }

  // Return detailMap as empty Map for compatibility (not needed with MongoDB structure)
  const detailMap = new Map();
  return { list: filteredList, enriched, detailMap };
}

// Lightweight record shape shared by every drill-down page response.
export function toDrilldownRecord(q) {
  const parsed = q.parsedDate;
  return {
    quotationNo: q.quotationNo,
    customerName: q.customerName,
    contactNumber: q.contactNumber,
    quotationDate: q.quotationDate,
    dateKey: parsed ? toDateKey(parsed) : "",
    weekKey: parsed ? toDateKey(startOfWeek(parsed)) : "",
    monthKey: parsed ? `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}` : "",
    quarterKey: parsed ? `${parsed.getFullYear()}-Q${Math.floor(parsed.getMonth() / 3) + 1}` : "",
    division: (q.division || "").trim() || "Unspecified",
    engineer: (q.engineer || "").trim() || "Unspecified",
    sourceOfEnquiry: q.sourceOfEnquiry || "Unspecified",
    orderStatus: normalizeOrderStatus(q.orderStatus),
    itemCount: Number(q.itemCount) || 0,
    totalAmount: Number(q.totalAmount) || 0,
  };
}