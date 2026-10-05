/**
 * One-time Migration Script: Google Sheets → MongoDB
 * 
 * Reads ALL data from 4 Google Sheets tabs and migrates to MongoDB collections:
 * - Mastersheet → customers
 * - Products → parts
 * - Data → quotations (grouped by Quotation No)
 * - Followup Form for Quotation → followupHistory
 * 
 * Run with: node scripts/migrate-to-mongodb.js
 */

// Load environment variables
require("dotenv").config({ path: ".env.local" });

const {
  readSheetRange,
  prewarmAuth,
} = require("../src/lib/services/googleSheetsClient.js");

const {
  migrateCustomers,
  migrateParts,
  migrateQuotations,
  migrateFollowupHistory,
  migrateUsers,
  verifyMigration,
} = require("../src/lib/services/mongodbService.js");

const {
  buildHeaderMap,
  getCellValue,
  getCellNum,
} = require("../src/lib/services/googleSheetsService.js");

const { normalizeToCanonicalDate } = require("../src/lib/utils/dateUtils.js");

const CUSTOMER_SHEET_TAB = "Mastersheet";
const PARTS_SHEET_TAB = "Products";
const DATA_SHEET_TAB = "Data";
const FOLLOWUP_FORM_SHEET_TAB = "Followup Form for Quotation";
const USERS_SHEET_TAB = "Users";

// ─── CUSTOMER MIGRATION ────────────────────────────────────────────────────────

async function migrateCustomersFromSheets() {
  console.log("\n📥 Migrating Customers from Mastersheet + Data sheet history...");

  // 1. Read Mastersheet (customer master)
  const masterRows = await readSheetRange(CUSTOMER_SHEET_TAB, null);
  if (!masterRows || masterRows.length < 2) {
    console.log("  ⚠️  Mastersheet is empty or has no data rows");
    return { inserted: 0, updated: 0 };
  }

  const masterHeaders = buildHeaderMap(masterRows[0]);
  const masterData = masterRows.slice(1).map((row, i) => ({
    _id: `row-${i}`,
    customerName: getCellValue(row, masterHeaders, "Customer Name"),
    fullAddressWithGST: getCellValue(row, masterHeaders, "Full Address/GST NO."),
    fullAddress: getCellValue(row, masterHeaders, "Full Address"),
    gstNo: getCellValue(row, masterHeaders, "GST NO."),
    stateName: getCellValue(row, masterHeaders, "State Name"),
    stateCode: getCellValue(row, masterHeaders, "State code"),
  })).filter(c => c.customerName && c.customerName.trim() !== "");

  console.log(`  Found ${masterData.length} customers in Mastersheet`);

  // 2. Read Data sheet for customer history (extended fields)
  const dataRows = await readSheetRange(DATA_SHEET_TAB, null);
  let customerHistory = new Map();
  
  if (dataRows && dataRows.length >= 2) {
    const dataHeaders = buildHeaderMap(dataRows[0]);
    
    const CUSTOMER_HISTORY_COLUMN_MAP = {
      contactPerson: "Contact Person",
      contactNumber: "Contact Number",
      designation: "Designation",
      emailTo: "Email Id To",
      emailCc: "Email CC",
      location: "Location",
      userId: "User ID",
      engineerRemark: "Engineer Remark",
    };

    for (const row of dataRows.slice(1)) {
      const name = getCellValue(row, dataHeaders, "Customer Name");
      if (!name) continue;

      const key = name.trim().toLowerCase();
      const existing = customerHistory.get(key);
      
      // Get the quotation date for recency comparison
      const quotationDate = getCellValue(row, dataHeaders, "Quotation Date");
      const timestamp = getCellValue(row, dataHeaders, "Timestamp");
      
      const entry = {
        quotationDate,
        timestamp,
      };
      
      for (const [field, header] of Object.entries(CUSTOMER_HISTORY_COLUMN_MAP)) {
        entry[field] = getCellValue(row, dataHeaders, header);
      }

      // Keep the most recent entry per customer
      if (!existing || isNewerEntry(entry, existing)) {
        customerHistory.set(key, entry);
      }
    }
    console.log(`  Found extended data for ${customerHistory.size} customers in Data sheet`);
  }

  // 3. Merge history into master data
  const mergedCustomers = masterData.map(customer => {
    const key = (customer.customerName || "").trim().toLowerCase();
    const history = customerHistory.get(key);
    
    if (history) {
      for (const field of ["contactPerson", "contactNumber", "designation", "emailTo", "emailCc", "location", "userId", "engineerRemark"]) {
        if (!customer[field] || customer[field].trim() === "") {
          customer[field] = history[field] || "";
        }
      }
    }
    return customer;
  });

  console.log(`  Merged data for ${mergedCustomers.length} customers`);

  // 4. Upsert to MongoDB
  const result = await migrateCustomers(mergedCustomers);
  console.log(`  ✅ Customers migrated: ${result.inserted} inserted, ${result.updated} updated`);
  return result;
}

function isNewerEntry(a, b) {
  const timeA = a.timestamp ? new Date(a.timestamp).getTime() : (a.quotationDate ? new Date(normalizeToCanonicalDate(a.quotationDate).split("/").reverse().join("-")).getTime() : 0);
  const timeB = b.timestamp ? new Date(b.timestamp).getTime() : (b.quotationDate ? new Date(normalizeToCanonicalDate(b.quotationDate).split("/").reverse().join("-")).getTime() : 0);
  return timeA > timeB;
}

// ─── PARTS MIGRATION ───────────────────────────────────────────────────────────

async function migratePartsFromSheets() {
  console.log("\n📥 Migrating Parts from Products sheet...");

  const rows = await readSheetRange(PARTS_SHEET_TAB, null);
  if (!rows || rows.length < 2) {
    console.log("  ⚠️  Products sheet is empty or has no data rows");
    return { inserted: 0, updated: 0 };
  }

  const headers = buildHeaderMap(rows[0]);
  const parts = rows.slice(1).map((row, i) => ({
    _id: `row-${i}`,
    partNo: getCellValue(row, headers, "Parts No") || getCellValue(row, headers, "Part No"),
    description: getCellValue(row, headers, "Description"),
    group: getCellValue(row, headers, "Group"),
    subGroup: getCellValue(row, headers, "Sub Group"),
    aRaipur: getCellNum(row, headers, "A RAIPUR"),
    bRaigarh: getCellNum(row, headers, "B RAIGARH"),
    cAmbikapur: getCellNum(row, headers, "C AMBIKAPUR"),
    dSatna: getCellNum(row, headers, "D SATNA"),
    lastPurchaseDate: getCellValue(row, headers, "Last Purchase Date"),
    applicableDate: getCellValue(row, headers, "Applicable Date"),
    standardRate: getCellNum(row, headers, "Standard Rate"),
    locationRaipur: getCellValue(row, headers, "Location A RAIPUR"),
    locationRaigarh: getCellValue(row, headers, "Location B RAIGARH"),
    locationAmbikapur: getCellValue(row, headers, "Location C AMBIKAPUR"),
    locationSatna: getCellValue(row, headers, "Location D SATNA"),
    raipurStockValue: getCellNum(row, headers, "Raipur Stock Value"),
    raigarhStockValue: getCellNum(row, headers, "Raigarh Stock Value"),
    ambikapurStockValue: getCellNum(row, headers, "Ambikapur Stock Value"),
    satnaStockValue: getCellNum(row, headers, "Satna Stock Value"),
    stockStatus: getCellValue(row, headers, "Stock Status"),
    lowStock: getCellNum(row, headers, "Low Stock"),
    outOfStock: getCellNum(row, headers, "Out of Stock"),
    inStock: getCellNum(row, headers, "In Stock"),
    minimumQty: getCellNum(row, headers, "Minimum Qty"),
    pendingOrderInHO: getCellNum(row, headers, "Pending Order In HO"),
    needToOrder: getCellNum(row, headers, "Need to Order"),
    status: getCellValue(row, headers, "Status"),
    hsnCode: getCellValue(row, headers, "HSN Code"),
    totalQty: getCellNum(row, headers, "Total Qty"),
    totalPrice: getCellNum(row, headers, "Total Price"),
  })).filter(p => p.partNo && p.partNo.trim() !== "");

  console.log(`  Found ${parts.length} parts in Products sheet`);

  const result = await migrateParts(parts);
  console.log(`  ✅ Parts migrated: ${result.inserted} inserted, ${result.updated} updated`);
  return result;
}

// ─── QUOTATION MIGRATION ───────────────────────────────────────────────────────

async function migrateQuotationsFromSheets() {
  console.log("\n📥 Migrating Quotations from Data sheet...");

  const rows = await readSheetRange(DATA_SHEET_TAB, null);
  if (!rows || rows.length < 2) {
    console.log("  ⚠️  Data sheet is empty or has no data rows");
    return { inserted: 0 };
  }

  const headers = buildHeaderMap(rows[0]);
  const dataRows = rows.slice(1);

  // Group rows by Quotation No
  const quotationGroups = new Map();
  
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const quotationNo = getCellValue(row, headers, "Quotation No");
    if (!quotationNo) continue;

    if (!quotationGroups.has(quotationNo)) {
      quotationGroups.set(quotationNo, {
        quotationNo,
        rows: [],
        firstRowIndex: i,
      });
    }
    quotationGroups.get(quotationNo).rows.push({ row, sheetRowIndex: i + 1 });
  }

  console.log(`  Found ${quotationGroups.size} unique quotations`);

  // Transform each group into a quotation document
  const quotations = [];
  for (const [quotationNo, group] of quotationGroups) {
    const firstRow = group.rows[0].row;
    
    // Build customer object
    const customer = {
      customerName: getCellValue(firstRow, headers, "Customer Name"),
      fullAddressGst: getCellValue(firstRow, headers, "Full Address with GST"),
      fullAddress: getCellValue(firstRow, headers, "Full Address"),
      gstNo: getCellValue(firstRow, headers, "GST NO"),
      stateName: getCellValue(firstRow, headers, "State Name"),
      stateCode: getCellValue(firstRow, headers, "State Code"),
      contactPerson: getCellValue(firstRow, headers, "Contact Person"),
      contactNumber: getCellValue(firstRow, headers, "Contact Number"),
      designation: getCellValue(firstRow, headers, "Designation"),
      emailTo: getCellValue(firstRow, headers, "Email Id To"),
      emailCc: getCellValue(firstRow, headers, "Email CC"),
      location: getCellValue(firstRow, headers, "Location"),
      userId: getCellValue(firstRow, headers, "User ID"),
      engineerRemark: getCellValue(firstRow, headers, "Engineer Remark"),
    };

    // Build quotation info
    const quotation = {
      division: getCellValue(firstRow, headers, "Division"),
      sourceOfEnquiry: getCellValue(firstRow, headers, "Source Of Enquiry"),
      enquiryGeneratedBy: getCellValue(firstRow, headers, "Enquiry Generated by"),
      quotationDate: normalizeToCanonicalDate(getCellValue(firstRow, headers, "Quotation Date")),
      validity: getCellValue(firstRow, headers, "Validity"),
      partyReferenceNumber: getCellValue(firstRow, headers, "Partyref No."),
      partyReferenceDate: normalizeToCanonicalDate(getCellValue(firstRow, headers, "Partyref Dt.")),
      paymentTerms: getCellValue(firstRow, headers, "Payment Terms"),
      quotationValidity: getCellValue(firstRow, headers, "Quotation Validity"),
      termsOfDelivery: getCellValue(firstRow, headers, "Terms Of Delivery"),
      quotationFollowUpBy: getCellValue(firstRow, headers, "Quotation Followup by"),
      reviseNumber: "",
    };

    // Build items
    const items = group.rows.map(({ row }) => ({
      partNumber: getCellValue(row, headers, "Part Number"),
      partDescription: getCellValue(row, headers, "Part Descriptions"),
      hsnCode: getCellValue(row, headers, "HSN Code"),
      uom: getCellValue(row, headers, "UOM") || "Nos",
      gstRate: getCellValue(row, headers, "GST Rate") || "18",
      quantity: getCellNum(row, headers, "Quantity"),
      unitPrice: getCellNum(row, headers, "Unit Price"),
      otherRate: getCellNum(row, headers, "Other Rate"),
      discount: getCellNum(row, headers, "Disc."),
      availability: getCellValue(row, headers, "Availability"),
      priceWef: getCellValue(row, headers, "Price (w.e.f)"),
      liveStock: getCellValue(row, headers, "Live Stock"),
    }));

    // Build followup object
    const followup = {
      numberOfFollowup: getCellNum(firstRow, headers, "Number of Followup"),
      orderFollowUpSummary: getCellValue(firstRow, headers, "Order Follow-up Summary"),
      nextFollowupDate: normalizeToCanonicalDate(getCellValue(firstRow, headers, "Next Followup date")),
      nextFollowupStatus: getCellValue(firstRow, headers, "Next followup Status"),
      orderStatus: getCellValue(firstRow, headers, "Order Status") || "Pending",
      orderReceivedDate: normalizeToCanonicalDate(getCellValue(firstRow, headers, "Order received Date")),
      remarkForOrderReceived: getCellValue(firstRow, headers, "Remark for Order Received"),
      orderNumber: getCellValue(firstRow, headers, "Order Number"),
      orderDate: normalizeToCanonicalDate(getCellValue(firstRow, headers, "Order Date")),
      orderVerificationStatus: getCellValue(firstRow, headers, "Order Verification Status"),
      attachedPaymentReceipt: getCellValue(firstRow, headers, "Attached Payment Receipt"),
      dueDays: getCellValue(firstRow, headers, "Due Days"),
      prefilledForm: getCellValue(firstRow, headers, "Prefilled Form"),
      prefilledFormUrl: getCellValue(firstRow, headers, "Prefilled Form URL"),
    };

    // Get timestamp from first row
    const timestamp = getCellValue(firstRow, headers, "Timestamp");
    const createdAt = timestamp ? new Date(timestamp) : new Date();

    quotations.push({
      quotationNo,
      customer,
      quotation,
      items,
      followup,
      createdAt,
      updatedAt: new Date(),
    });
  }

  console.log(`  Prepared ${quotations.length} quotation documents`);

  const result = await migrateQuotations(quotations);
  console.log(`  ✅ Quotations migrated: ${result.inserted} inserted`);
  return result;
}

// ─── FOLLOWUP HISTORY MIGRATION ────────────────────────────────────────────────

async function migrateFollowupHistoryFromSheets() {
  console.log("\n📥 Migrating Follow-up History from Followup Form for Quotation sheet...");

  const rows = await readSheetRange(FOLLOWUP_FORM_SHEET_TAB, null);
  if (!rows || rows.length < 2) {
    console.log("  ⚠️  Followup Form sheet is empty or has no data rows");
    return { inserted: 0 };
  }

  const headers = buildHeaderMap(rows[0]);
  const records = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const record = {};
    let hasAnyValue = false;

    for (const headerName of Object.keys(headers)) {
      const value = getCellValue(row, headers, headerName);
      record[headerName] = value;
      if (value !== "") hasAnyValue = true;
    }

    if (!hasAnyValue) continue;

    // Map to expected format
    records.push({
      quotationNo: record["Quotation No"] || "",
      timestamp: record["Timestamp"] || "",
      submissionType: record["Submission Type"] || "",
      nextFollowupDate: record["Next Followup Date"] || "",
      followupStatus: record["Followup Status"] || "",
      followupRemark: record["Followup Remark"] || "",
      orderStatus: record["Order Status"] || "",
      attachOrderPDF: record["Attach Order PDF"] || "",
      orderReceivedDate: record["Order Received date"] || "",
      remarkForOrder: record["Remark for Order"] || "",
      orderNumber: record["Order Number"] || "",
      orderDate: record["Order Date"] || "",
      orderVerificationStatus: record["Order Verification Status"] || "",
      attachedPaymentReceipt: record["Attached Payment Receipt"] || "",
      dueDays: record["Due Days"] || "",
      prefilledForm: record["Prefilled Form"] || "",
      prefilledFormUrl: record["Prefilled Form URL"] || "",
    });
  }

  console.log(`  Found ${records.length} follow-up history records`);

  const result = await migrateFollowupHistory(records);
  console.log(`  ✅ Follow-up history migrated: ${result.inserted} inserted`);
  return result;
}

// ─── USERS MIGRATION ────────────────────────────────────────────────────────────

async function migrateUsersFromSheets() {
  console.log("\n📥 Migrating Users from Users sheet...");

  const rows = await readSheetRange(USERS_SHEET_TAB, null);
  if (!rows || rows.length < 2) {
    console.log("  ⚠️  Users sheet is empty or has no data rows");
    return { inserted: 0, updated: 0 };
  }

  const headers = buildHeaderMap(rows[0]);
  
  function parseActive(value) {
    if (typeof value === "boolean") return value;
    const s = String(value || "").trim().toUpperCase();
    return s === "TRUE" || s === "YES" || s === "1";
  }

  const users = rows.slice(1).map((row, i) => ({
    username: getCellValue(row, headers, "Username"),
    password: getCellValue(row, headers, "Password"),
    active: parseActive(getCellValue(row, headers, "Active")),
    role: "user",
  })).filter(u => u.username && u.username.trim() !== "");

  console.log(`  Found ${users.length} users in Users sheet`);

  const result = await migrateUsers(users);
  console.log(`  ✅ Users migrated: ${result.inserted} inserted, ${result.updated} updated`);
  return result;
}

// ─── MAIN MIGRATION ────────────────────────────────────────────────────────────

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════════╗");
  console.log("║       Google Sheets → MongoDB Migration Script                   ║");
  console.log("╚═══════════════════════════════════════════════════════════════════╝");

  try {
    // Warm up Google Sheets auth
    console.log("\n🔐 Warming up Google Sheets authentication...");
    await prewarmAuth();
    console.log("  ✅ Auth ready");

    // Run migrations in order
    await migrateUsersFromSheets();
    await migrateCustomersFromSheets();
    await migratePartsFromSheets();
    await migrateQuotationsFromSheets();
    await migrateFollowupHistoryFromSheets();

    // Verify
    console.log("\n🔍 Verifying migration...");
    const verification = await verifyMigration();
    console.log("\n📊 Migration Verification Results:");
    console.log(`  Customers:       ${verification.customers}`);
    console.log(`  Parts:           ${verification.parts}`);
    console.log(`  Quotations:      ${verification.quotations}`);
    console.log(`  Followup History: ${verification.followupHistory}`);

    console.log("\n✅ Migration completed successfully!");
    console.log("\n📋 Next steps:");
    console.log("  1. Update API routes to use mongodbService");
    console.log("  2. Update server.mjs to preload MongoDB");
    console.log("  3. Test the application");
    console.log("  4. Run verification script again after testing");

  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
}

main();