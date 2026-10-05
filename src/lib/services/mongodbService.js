/**
 * MongoDB Service Layer
 * 
 * Main service layer for all database operations.
 */

import { CustomerModel } from "@/lib/models/Customer";
import { PartModel } from "@/lib/models/Part";
import { QuotationModel } from "@/lib/models/Quotation";
import { FollowupHistoryModel } from "@/lib/models/FollowupHistory";
import { UserModel } from "@/lib/models/User";
import { normalizeToCanonicalDate } from "@/lib/utils/dateUtils";

// ─── CACHE ─────────────────────────────────────────────────────────────────────
// Legacy cache variables (kept for API compatibility, not used with MongoDB)

let customersCache = null;
let partsCache = null;
let customerHistoryCache = null;

// ─── CUSTOMER OPERATIONS ───────────────────────────────────────────────────────

export async function getAllCustomers() {
  return CustomerModel.getAll();
}

export async function searchCustomers(query) {
  const results = await CustomerModel.search(query);
  return results.map((c) => ({
    customer: c,
    rank: c.customerName.toLowerCase().startsWith(query.toLowerCase()) ? 0 : 1,
    length: c.customerName.length,
    sortKey: c.customerName.toLowerCase(),
  })).sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.length !== b.length) return a.length - b.length;
    return a.sortKey.localeCompare(b.sortKey);
  }).slice(0, 25).map((r) => r.customer);
}

export async function getCustomerByRowIndex(index) {
  // Not applicable for MongoDB - kept for compatibility
  const customers = await getAllCustomers();
  return customers[index] || null;
}

export async function createCustomer(data) {
  const customer = await CustomerModel.create(data);
  return {
    _id: customer._id,
    customerName: customer.customerName,
    fullAddressWithGST: customer.fullAddressWithGST,
    fullAddress: customer.fullAddress,
    gstNo: customer.gstNo,
    stateName: customer.stateName,
    stateCode: customer.stateCode,
  };
}

export async function updateCustomerByRowIndex(index, data) {
  // Not directly applicable - use update by ID instead
  // This is kept for API compatibility but not used in new flow
  return null;
}

export async function deleteCustomerByRowIndex(index) {
  // Not directly applicable
  return false;
}

// ─── CUSTOMER ID-BASED OPERATIONS (for new API routes) ───────────────────────────

export async function getCustomerById(id) {
  return CustomerModel.getById(id);
}

export async function updateCustomerById(id, data) {
  return CustomerModel.updateById(id, data);
}

export async function deleteCustomerById(id) {
  return CustomerModel.deleteById(id);
}

// ─── PART OPERATIONS ───────────────────────────────────────────────────────────

export async function getAllParts() {
  return PartModel.getAll();
}

export async function searchParts(query) {
  return PartModel.search(query);
}

export async function getPartByRowIndex(index) {
  const parts = await getAllParts();
  return parts[index] || null;
}

export async function createPart(data) {
  const part = await PartModel.create(data);
  return {
    _id: part._id,
    partNo: part.partNo,
    description: part.description,
    group: part.group,
    subGroup: part.subGroup,
    aRaipur: part.aRaipur,
    bRaigarh: part.bRaigarh,
    cAmbikapur: part.cAmbikapur,
    dSatna: part.dSatna,
    lastPurchaseDate: part.lastPurchaseDate,
    applicableDate: part.applicableDate,
    standardRate: part.standardRate,
    locationRaipur: part.locationRaipur,
    locationRaigarh: part.locationRaigarh,
    locationAmbikapur: part.locationAmbikapur,
    locationSatna: part.locationSatna,
    raipurStockValue: part.raipurStockValue,
    raigarhStockValue: part.raigarhStockValue,
    ambikapurStockValue: part.ambikapurStockValue,
    satnaStockValue: part.satnaStockValue,
    stockStatus: part.stockStatus,
    lowStock: part.lowStock,
    outOfStock: part.outOfStock,
    inStock: part.inStock,
    minimumQty: part.minimumQty,
    pendingOrderInHO: part.pendingOrderInHO,
    needToOrder: part.needToOrder,
    status: part.status,
    hsnCode: part.hsnCode,
    totalQty: part.totalQty,
    totalPrice: part.totalPrice,
  };
}

export async function updatePartByRowIndex(index, data) {
  return null;
}

export async function deletePartByRowIndex(index) {
  return false;
}

// ─── PART ID-BASED OPERATIONS (for new API routes) ──────────────────────────────

export async function getPartById(id) {
  return PartModel.getById(id);
}

export async function updatePartById(id, data) {
  return PartModel.updateById(id, data);
}

export async function deletePartById(id) {
  return PartModel.deleteById(id);
}

// ─── QUOTATION OPERATIONS ──────────────────────────────────────────────────────

const DEFAULT_UOM = "Nos";
const DEFAULT_GST_RATE = 18;

function toSheetDate(value) {
  if (value === undefined || value === null) return "";
  const s = String(value).trim();
  if (!s) return "";
  // Ensure DD/MM/YYYY format
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }
  return s;
}

function toSheetTimestamp(value) {
  if (value === undefined || value === null) return "";
  const s = String(value).trim();
  if (!s) return "";
  const date = new Date(s);
  if (isNaN(date.getTime())) return s;
  // Format as DD/MM/YYYY HH:mm:ss (IST)
  const pad = (n) => String(n).padStart(2, "0");
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffset);
  return `${pad(istDate.getUTCDate())}/${pad(istDate.getUTCMonth() + 1)}/${istDate.getUTCFullYear()} ${pad(istDate.getUTCHours())}:${pad(istDate.getUTCMinutes())}:${pad(istDate.getUTCSeconds())}`;
}

function calcSubAmount(item) {
  const qty = typeof item.quantity === "string" ? parseFloat(item.quantity) : item.quantity;
  const price = typeof item.unitPrice === "string" ? parseFloat(item.unitPrice) : item.unitPrice;
  return (qty || 0) * (price || 0);
}

function calcBasicTotal(item) {
  const qty = typeof item.quantity === "string" ? parseFloat(item.quantity) : item.quantity;
  const price = typeof item.unitPrice === "string" ? parseFloat(item.unitPrice) : item.unitPrice;
  const other = typeof item.otherRate === "string" ? parseFloat(item.otherRate) : item.otherRate;
  return (qty || 0) * ((price || 0) + (other || 0));
}

import { computeLineTotal, computeGstAmount } from "@/lib/utils/formatters";
import { toNumber } from "@/lib/utils/formatters";

export async function buildQuotationRows(quotation, { quotationId, createdAt }) {
  const { customer, quotation: info, items } = quotation;
  
  return items.map((item) => ({
    Timestamp: toSheetTimestamp(createdAt),
    "Customer Name": customer.customerName,
    "Full Address with GST": customer.fullAddressGst,
    "Full Address": customer.fullAddress || "",
    "GST NO": customer.gstNo || "",
    "State Name": customer.stateName || "",
    "State Code": customer.stateCode || "",
    "Contact Person": customer.contactPerson,
    "Contact Number": customer.contactNumber,
    Designation: customer.designation,
    "Email Id To": customer.emailTo,
    "Email CC": customer.emailCc,
    Location: customer.location,
    "User ID": customer.userId,
    "Engineer Remark": customer.engineerRemark,
    Division: info.division,
    "Source Of Enquiry": info.sourceOfEnquiry,
    "Enquiry Generated by": info.enquiryGeneratedBy,
    "Quotation No": quotationId,
    Validity: info.quotationValidity,
    "Quotation Date": toSheetDate(info.quotationDate),
    "Partyref No.": info.partyReferenceNumber,
    "Partyref Dt.": toSheetDate(info.partyReferenceDate),
    "Payment Terms": info.paymentTerms,
    "Quotation Validity": info.quotationValidity,
    "Terms Of Delivery": info.termsOfDelivery,
    "Quotation Followup by": info.quotationFollowUpBy,
    "Part Number": item.partNumber,
    "Part Descriptions": item.partDescription,
    "HSN Code": item.hsnCode || "",
    UOM: DEFAULT_UOM,
    "GST Rate": String(DEFAULT_GST_RATE),
    Quantity: item.quantity,
    "Unit Price": item.unitPrice,
    "Other Rate": item.otherRate,
    "Disc.": item.discount,
    "Sub Amount": calcSubAmount(item),
    "Total Amount": computeLineTotal(item),
    "Basic Total Amount": calcBasicTotal(item),
    Availability: item.availability,
    "Price (w.e.f)": toSheetDate(item.priceWef),
    "Live Stock": item.liveStock,
    "GST Amount": computeGstAmount(item, DEFAULT_GST_RATE),
  }));
}

export async function appendQuotation(quotation, meta) {
  const result = await QuotationModel.create(quotation, meta);
  return { rowsWritten: quotation.items.length };
}

export async function updateQuotationByNo(quotationNo, quotation) {
  const result = await QuotationModel.updateByQuotationNo(quotationNo, quotation);
  return result;
}

export async function loadQuotations() {
  const quotations = await QuotationModel.getAll();
  
  // Build detailMap for compatibility
  const detailMap = new Map();
  for (const q of quotations) {
    // We need to fetch full details for detailMap
    const full = await QuotationModel.getByQuotationNo(q.quotationNo);
    if (full) {
      detailMap.set(q.quotationNo, full.items.map((item, idx) => ({
        ...item,
        _customer: full.customer,
        _quotation: full.quotation,
        _followup: full.followup,
      })));
    }
  }
  
  return { quotations, detailMap };
}

export async function getQuotations() {
  const { quotations } = await loadQuotations();
  return quotations;
}

export async function generateNextQuotationNumber() {
  return QuotationModel.generateNextQuotationNumber();
}

export async function getQuotationByNo(quotationNo) {
  return QuotationModel.getByQuotationNo(quotationNo);
}

// ─── QUOTATION FOLLOW-UP HISTORY ───────────────────────────────────────────────

export async function buildFollowupFormRow(data) {
  // Not needed for MongoDB - kept for compatibility
  return [];
}

export async function appendQuotationFollowupRecord(data) {
  const result = await FollowupHistoryModel.append(data);
  return {
    rowsWritten: 1,
    quotationNo: data.quotationNo || "",
    submissionType: data.submissionType || "",
  };
}

export async function readFollowupFormRecords() {
  return FollowupHistoryModel.getAll();
}

export async function getQuotationFollowupHistory(quotationNo) {
  return FollowupHistoryModel.getByQuotationNo(quotationNo);
}

export async function getCurrentPendingFollowupRecords() {
  return FollowupHistoryModel.getCurrentPending();
}

export async function updateQuotationDataFieldsByNo(quotationNo, buildFieldValues) {
  // This is used by follow-up/order-status updates
  // We need to read current, build updates, and write back
  const quotation = await QuotationModel.getByQuotationNo(quotationNo);
  if (!quotation) return { success: false, reason: "not-found" };

  // Build field values from the callback
  // The callback expects (rows, headers, targetRowIndices) but we don't have those
  // Instead, we'll pass a mock that returns the field values directly
  const mockRows = [];
  const mockHeaders = {};
  const mockIndices = [0];
  const fieldValues = buildFieldValues(mockRows, mockHeaders, mockIndices);

  // Determine which update to perform based on fieldValues
  if (fieldValues["Order Status"] !== undefined) {
    const isClosing = ["Won", "Loss", "Dead", "Partial"].includes(fieldValues["Order Status"]);
    return QuotationModel.updateOrderStatusFields(quotationNo, fieldValues, isClosing);
  } else {
    return QuotationModel.updateFollowupFields(quotationNo, fieldValues);
  }
}

export async function completePendingFollowupsForQuotation(quotationNo) {
  return FollowupHistoryModel.completePendingFollowups(quotationNo);
}

const CLOSING_ORDER_STATUSES = new Set(["Won", "Loss", "Dead", "Partial"]);

export async function updateQuotationNextFollowup(quotationNo, data) {
  const currentQuotation = await getQuotationByNo(quotationNo);
  if (!currentQuotation) {
    return { success: false, reason: "not-found" };
  }

  const currentOrderStatus = String(currentQuotation.followup?.orderStatus || "").trim();
  if (CLOSING_ORDER_STATUSES.has(currentOrderStatus)) {
    return { success: false, reason: "closed", orderStatus: currentOrderStatus };
  }

  const timestamp = new Date().toISOString();

  const dataResult = await updateQuotationDataFieldsByNo(quotationNo, () => {
    const currentCount = currentQuotation.followup?.numberOfFollowup || 0;
    return {
      "Next Followup date": toSheetDate(data.nextFollowupDate || ""),
      "Order Follow-up Summary": data.followupRemark || "",
      "Next followup Status": "Pending",
      "Number of Followup": String(currentCount + 1),
    };
  });

  if (!dataResult.success) return dataResult;

  try {
    await completePendingFollowupsForQuotation(quotationNo);

    const history = await appendQuotationFollowupRecord({
      timestamp,
      quotationNo,
      submissionType: "Next Follow-up",
      nextFollowupDate: data.nextFollowupDate || "",
      followupStatus: "Pending",
      followupRemark: data.followupRemark || "",
    });
    return { success: true, data: dataResult, history };
  } catch (error) {
    console.error("[updateQuotationNextFollowup] Data updated but history write failed:", error);
    return { success: false, reason: "history-failed" };
  }
}

export async function updateQuotationOrderStatus(quotationNo, data) {
  const timestamp = new Date().toISOString();

  const isClosing = CLOSING_ORDER_STATUSES.has(String(data.orderStatus || "").trim());

  const dataResult = await updateQuotationDataFieldsByNo(quotationNo, () => {
    const fields = {
      "Order Status": data.orderStatus || "",
      "Order Number": data.orderNumber || "",
      "Order received Date": toSheetDate(data.orderReceivedDate || ""),
      "Remark for Order Received": data.remarkForOrder || "",
    };
    if (isClosing) {
      fields["Order Follow-up Summary"] = "";
      fields["Next Followup date"] = "";
      fields["Next followup Status"] = "";
    }
    return fields;
  });

  if (!dataResult.success) return dataResult;

  try {
    if (isClosing) {
      await completePendingFollowupsForQuotation(quotationNo);
    }

    const history = await appendQuotationFollowupRecord({
      timestamp,
      quotationNo,
      submissionType: "Order Status",
      orderStatus: data.orderStatus || "",
      orderNumber: data.orderNumber || "",
      orderReceivedDate: data.orderReceivedDate || "",
      remarkForOrder: data.remarkForOrder || "",
    });
    return { success: true, data: dataResult, history };
  } catch (error) {
    console.error("[updateQuotationOrderStatus] Data updated but history append failed:", error);
    return { success: false, reason: "history-failed" };
  }
}

// ─── DASHBOARD SUPPORT ─────────────────────────────────────────────────────────

export async function loadDashboardQuotations(filters = {}) {
  const list = await QuotationModel.getDashboardQuotations(filters);
  return { list, enriched: list, detailMap: new Map() };
}

// ─── MIGRATION HELPERS ─────────────────────────────────────────────────────────

export async function migrateCustomers(customers) {
  return CustomerModel.bulkUpsert(customers);
}

export async function migrateParts(parts) {
  return PartModel.bulkUpsert(parts);
}

export async function migrateQuotations(quotations) {
  return QuotationModel.bulkInsert(quotations);
}

export async function migrateFollowupHistory(records) {
  return FollowupHistoryModel.bulkInsert(records);
}

export async function verifyMigration() {
  const customerCount = await CustomerModel.count();
  const partCount = await PartModel.count();
  const quotationCount = await QuotationModel.count();
  const followupCount = await FollowupHistoryModel.count();
  
  return {
    customers: customerCount,
    parts: partCount,
    quotations: quotationCount,
    followupHistory: followupCount,
  };
}

// ─── USER OPERATIONS ────────────────────────────────────────────────────────────

export async function getAllUsers() {
  return UserModel.getAll();
}

export async function getUserByUsername(username) {
  return UserModel.getByUsername(username);
}

export async function getUserById(id) {
  return UserModel.getById(id);
}

export async function getFirstActiveUser() {
  return UserModel.getFirstActive();
}

export async function createUser(data) {
  return UserModel.create(data);
}

export async function updateUserById(id, data) {
  return UserModel.updateById(id, data);
}

export async function deleteUserById(id) {
  return UserModel.deleteById(id);
}

export async function migrateUsers(users) {
  return UserModel.bulkUpsert(users);
}