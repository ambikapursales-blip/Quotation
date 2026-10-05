"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/formatters";
import { useToast } from "@/hooks/useToast";
import QuotationFollowupModal from "@/components/quotations/QuotationFollowupModal";

const STATUS_BADGE_COLORS = {
  Pending: "bg-[#FEF3C7] text-[#92400E]",
  Won: "bg-[#DCFCE7] text-[#166534]",
  Loss: "bg-[#FEE2E2] text-[#991B1B]",
  Dead: "bg-[#F3F4F6] text-[#4B5563]",
  Partial: "bg-[#FFEDD5] text-[#9A3412]",
};

export default function FollowupsPage() {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("All");
  const [divisionFilter, setDivisionFilter] = useState("All");
  const [dateWiseFilter, setDateWiseFilter] = useState("All");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [viewQuotationNo, setViewQuotationNo] = useState(null);
  const [followUpQuotationNo, setFollowUpQuotationNo] = useState(null);

  const router = useRouter();
  const toast = useToast();

  const loadQuotations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (divisionFilter !== "All") params.append("division", divisionFilter);
      if (orderStatusFilter !== "All") params.append("orderStatus", orderStatusFilter);
      if (fromDate) params.append("from", fromDate);
      if (toDate) params.append("to", toDate);
      if (searchQuery) params.append("search", searchQuery);

      const res = await fetch(`/api/dashboard?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setQuotations(json.data);
      } else {
        setError(json.message || "Failed to load quotations.");
      }
    } catch (err) {
      setError(err.message || "Network error.");
    } finally {
      setLoading(false);
    }
  }, [divisionFilter, orderStatusFilter, fromDate, toDate, searchQuery]);

  useEffect(() => {
    loadQuotations();
  }, [loadQuotations]);

  // Parse quotation date (handles YYYY-MM-DD and DD/MM/YYYY)
  const parseQuotationDate = (value) => {
    if (!value) return null;
    const s = String(value).trim();
    if (!s) return null;
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      const [, y, m, d] = iso.map(Number);
      return new Date(y, m - 1, d);
    }
    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
      const [, d, m, y] = dmy.map(Number);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const parsed = new Date(y, m - 1, d);
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }
      return null;
    }
    const parsed = new Date(s);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const toDateKey = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filteredQuotations = quotations.filter((q) => {
    const qDate = parseQuotationDate(q.quotationDate);
    if (!qDate) return true;

    if (dateWiseFilter === "Today") {
      return toDateKey(qDate) === toDateKey(today);
    }
    if (dateWiseFilter === "Overdue") {
      return qDate < today && q.orderStatus === "Pending";
    }
    if (dateWiseFilter === "Upcoming") {
      return qDate > today && q.orderStatus === "Pending";
    }
    return true;
  });

  const searchFiltered = filteredQuotations.filter((q) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      q.quotationNo.toLowerCase().includes(query) ||
      q.customerName.toLowerCase().includes(query) ||
      q.contactNumber?.toLowerCase().includes(query)
    );
  });

  const openFollowUp = (quotationNo) => {
    setFollowUpQuotationNo(quotationNo);
  };

  const openView = (quotationNo) => {
    setViewQuotationNo(quotationNo);
  };

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-ink-900">Follow-ups</h1>
            <p className="text-ink-500 mt-1">Track and manage quotation follow-ups</p>
          </div>
        </div>

        {/* Search & Filters */}
        <Card className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
              <Input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={orderStatusFilter}
              onChange={(e) => setOrderStatusFilter(e.target.value)}
              options={[
                { value: "All", label: "All Status" },
                { value: "Pending", label: "Pending" },
                { value: "Won", label: "Won" },
                { value: "Loss", label: "Loss" },
                { value: "Dead", label: "Dead" },
                { value: "Partial", label: "Partial" },
              ]}
            />
            <Select
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value)}
              options={[
                { value: "All", label: "All Divisions" },
                { value: "MRS", label: "MRS" },
                { value: "PTS", label: "PTS" },
                { value: "RDT", label: "RDT" },
                { value: "CHS", label: "CHS" },
              ]}
            />
            <Select
              value={dateWiseFilter}
              onChange={(e) => setDateWiseFilter(e.target.value)}
              options={[
                { value: "All", label: "All Dates" },
                { value: "Today", label: "Today" },
                { value: "Overdue", label: "Overdue" },
                { value: "Upcoming", label: "Upcoming" },
              ]}
            />
            <div className="flex gap-2">
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                placeholder="From"
                className="w-full"
              />
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                placeholder="To"
                className="w-full"
              />
            </div>
          </div>
        </Card>

        {/* Quotations Table */}
        <Card className="overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-accent-500 border-t-transparent" />
            </div>
          )}

          {!loading && error && (
            <div className="p-4 text-center text-red-600">{error}</div>
          )}

          {!loading && !error && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-ink-50 border-b border-ink-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-ink-600">Quotation No</th>
                      <th className="px-4 py-3 text-left font-medium text-ink-600">Customer</th>
                      <th className="px-4 py-3 text-left font-medium text-ink-600">Contact</th>
                      <th className="px-4 py-3 text-left font-medium text-ink-600">Quotation Date</th>
                      <th className="px-4 py-3 text-left font-medium text-ink-600">Division</th>
                      <th className="px-4 py-3 text-left font-medium text-ink-600">Order Status</th>
                      <th className="px-4 py-3 text-right font-medium text-ink-600">Amount</th>
                      <th className="px-4 py-3 text-right font-medium text-ink-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {searchFiltered.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-ink-500">
                          No quotations found.
                        </td>
                      </tr>
                    ) : (
                      searchFiltered.map((q) => (
                        <tr key={q.quotationNo} className="hover:bg-ink-50 transition-colors">
                          <td className="px-4 py-3 text-ink-900 font-mono text-xs">{q.quotationNo}</td>
                          <td className="px-4 py-3 text-ink-900 font-medium">{q.customerName}</td>
                          <td className="px-4 py-3 text-ink-600">{q.contactNumber || "-"}</td>
                          <td className="px-4 py-3 text-ink-600">{q.quotationDate}</td>
                          <td className="px-4 py-3 text-ink-600">{q.division || "-"}</td>
                          <td className="px-4 py-3">
                            <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", STATUS_BADGE_COLORS[q.orderStatus] || "bg-gray-100 text-gray-800")}>
                              {q.orderStatus || "Pending"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-ink-900 font-medium">
                            {formatCurrency(q.totalAmount)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openView(q.quotationNo)}
                                className="text-ink-600 hover:text-ink-900"
                              >
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openFollowUp(q.quotationNo)}
                                className="text-accent-600 hover:text-accent-900"
                              >
                                Follow-up
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        {/* Modals */}
        {viewQuotationNo && (
          <QuotationDetailsModal
            quotationNo={viewQuotationNo}
            onClose={() => setViewQuotationNo(null)}
          />
        )}

        {followUpQuotationNo && (
          <QuotationFollowupModal
            quotationNo={followUpQuotationNo}
            onClose={() => setFollowUpQuotationNo(null)}
          />
        )}
      </div>
    </AppShell>
  );
}