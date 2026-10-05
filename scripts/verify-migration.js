/**
 * Migration Verification Script
 * 
 * Verifies that all data was migrated correctly by comparing
 * Google Sheets counts with MongoDB counts and checking data integrity.
 * 
 * Run with: node scripts/verify-migration.js
 */

require("dotenv").config({ path: ".env.local" });

const {
  readSheetRange,
  prewarmAuth,
} = require("../src/lib/services/googleSheetsClient.js");

const {
  verifyMigration,
  CustomerModel,
  PartModel,
  QuotationModel,
  FollowupHistoryModel,
  UserModel,
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

async function verifyCustomers() {
  console.log("\n🔍 Verifying Customers...");
  
  // Count from Google Sheets
  const masterRows = await readSheetRange(CUSTOMER_SHEET_TAB, null);
  let sheetsCount = 0;
  if (masterRows && masterRows.length >= 2) {
    const headers = buildHeaderMap(masterRows[0]);
    sheetsCount = masterRows.slice(1).filter(row => 
      getCellValue(row, headers, "Customer Name").trim() !== ""
    ).length;
  }

  // Count from MongoDB
  const mongoCount = await CustomerModel.count();

  console.log(`  Google Sheets: ${sheetsCount}`);
  console.log(`  MongoDB:       ${mongoCount}`);
  
  const match = sheetsCount === mongoCount;
  console.log(`  Status:        ${match ? "✅ MATCH" : "❌ MISMATCH"}`);
  
  if (!match) {
    // Find missing customers
    const mongoCustomers = await CustomerModel.getAll();
    const mongoNames = new Set(mongoCustomers.map(c => c.customerName.trim().toLowerCase()));
    
    const masterHeaders = buildHeaderMap(masterRows[0]);
    const missing = [];
    for (const row of masterRows.slice(1)) {
      const name = getCellValue(row, masterHeaders, "Customer Name").trim();
      if (name && !mongoNames.has(name.toLowerCase())) {
        missing.push(name);
      }
    }
    if (missing.length > 0) {
      console.log(`  Missing in MongoDB: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? "..." : ""}`);
    }
  }
  
  return { sheetsCount, mongoCount, match };
}

async function verifyParts() {
  console.log("\n🔍 Verifying Parts...");
  
  const rows = await readSheetRange(PARTS_SHEET_TAB, null);
  let sheetsCount = 0;
  if (rows && rows.length >= 2) {
    const headers = buildHeaderMap(rows[0]);
    sheetsCount = rows.slice(1).filter(row => 
      (getCellValue(row, headers, "Parts No") || getCellValue(row, headers, "Part No")).trim() !== ""
    ).length;
  }

  const mongoCount = await PartModel.count();

  console.log(`  Google Sheets: ${sheetsCount}`);
  console.log(`  MongoDB:       ${mongoCount}`);
  
  const match = sheetsCount === mongoCount;
  console.log(`  Status:        ${match ? "✅ MATCH" : "❌ MISMATCH"}`);
  
  return { sheetsCount, mongoCount, match };
}

async function verifyQuotations() {
  console.log("\n🔍 Verifying Quotations...");
  
  const rows = await readSheetRange(DATA_SHEET_TAB, null);
  let sheetsQuotationCount = 0;
  let sheetsLineItemCount = 0;
  
  if (rows && rows.length >= 2) {
    const headers = buildHeaderMap(rows[0]);
    const quotationNos = new Set();
    
    for (const row of rows.slice(1)) {
      const qNo = getCellValue(row, headers, "Quotation No").trim();
      if (qNo) {
        quotationNos.add(qNo);
        sheetsLineItemCount++;
      }
    }
    sheetsQuotationCount = quotationNos.size;
  }

  const mongoQuotationCount = await QuotationModel.count();
  
  // Get line item count from MongoDB
  const db = (await import("../src/lib/db/mongodb.js")).getDb;
  const database = await db();
  const mongoLineItemCount = await database.collection("quotations").aggregate([
    { $project: { itemCount: { $size: "$items" } } },
    { $group: { _id: null, total: { $sum: "$itemCount" } } }
  ]).toArray().then(r => r[0]?.total || 0);

  console.log(`  Quotations:`);
  console.log(`    Google Sheets: ${sheetsQuotationCount}`);
  console.log(`    MongoDB:       ${mongoQuotationCount}`);
  
  console.log(`  Line Items:`);
  console.log(`    Google Sheets: ${sheetsLineItemCount}`);
  console.log(`    MongoDB:       ${mongoLineItemCount}`);
  
  const quoMatch = sheetsQuotationCount === mongoQuotationCount;
  const itemMatch = sheetsLineItemCount === mongoLineItemCount;
  
  console.log(`  Quotation Status: ${quoMatch ? "✅ MATCH" : "❌ MISMATCH"}`);
  console.log(`  Line Item Status: ${itemMatch ? "✅ MATCH" : "❌ MISMATCH"}`);
  
  if (!quoMatch) {
    // Find missing quotation numbers
    const mongoQuotations = await QuotationModel.getAll();
    const mongoNos = new Set(mongoQuotations.map(q => q.quotationNo.trim()));
    
    const headers = buildHeaderMap(rows[0]);
    const missing = [];
    for (const row of rows.slice(1)) {
      const qNo = getCellValue(row, headers, "Quotation No").trim();
      if (qNo && !mongoNos.has(qNo)) {
        missing.push(qNo);
      }
    }
    // Deduplicate
    const uniqueMissing = [...new Set(missing)];
    if (uniqueMissing.length > 0) {
      console.log(`  Missing quotations: ${uniqueMissing.slice(0, 10).join(", ")}${uniqueMissing.length > 10 ? "..." : ""}`);
    }
  }
  
  return { 
    sheetsQuotationCount, 
    mongoQuotationCount, 
    sheetsLineItemCount, 
    mongoLineItemCount,
    quoMatch,
    itemMatch 
  };
}

async function verifyFollowupHistory() {
  console.log("\n🔍 Verifying Follow-up History...");
  
  const rows = await readSheetRange(FOLLOWUP_FORM_SHEET_TAB, null);
  let sheetsCount = 0;
  if (rows && rows.length >= 2) {
    const headers = buildHeaderMap(rows[0]);
    sheetsCount = rows.slice(1).filter(row => {
      for (const headerName of Object.keys(headers)) {
        if (getCellValue(row, headers, headerName).trim() !== "") {
          return true;
        }
      }
      return false;
    }).length;
  }

  const mongoCount = await FollowupHistoryModel.count();

  console.log(`  Google Sheets: ${sheetsCount}`);
  console.log(`  MongoDB:       ${mongoCount}`);
  
  const match = sheetsCount === mongoCount;
  console.log(`  Status:        ${match ? "✅ MATCH" : "❌ MISMATCH"}`);
  
  return { sheetsCount, mongoCount, match };
}

async function verifyQuotationNumbering() {
  console.log("\n🔍 Verifying Quotation Numbering Sequence...");
  
  const quotations = await QuotationModel.getAll();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  let financialYear;
  if (currentMonth >= 4) {
    financialYear = `${String(currentYear).slice(-2)}-${String(currentYear + 1).slice(-2)}`;
  } else {
    financialYear = `${String(currentYear - 1).slice(-2)}-${String(currentYear).slice(-2)}`;
  }
  
  const prefix = `DEEP/M-SPR/${financialYear}/Q`;
  
  const currentYearQuotations = quotations
    .filter(q => q.quotationNo.startsWith(prefix))
    .map(q => parseInt(q.quotationNo.replace(prefix, ""), 10))
    .filter(n => !isNaN(n))
    .sort((a, b) => b - a);
  
  if (currentYearQuotations.length > 0) {
    const maxNumber = currentYearQuotations[0];
    const nextNumber = maxNumber + 1;
    const expectedNext = `${prefix}${String(nextNumber).padStart(6, "0")}`;
    
    console.log(`  Current FY:     ${financialYear}`);
    console.log(`  Highest number: ${maxNumber}`);
    console.log(`  Next expected:  ${expectedNext}`);
    
    // Check for gaps
    const gaps = [];
    for (let i = 1; i <= maxNumber; i++) {
      if (!currentYearQuotations.includes(i)) {
        gaps.push(i);
      }
    }
    if (gaps.length > 0) {
      console.log(`  ⚠️  Gaps found: ${gaps.slice(0, 20).join(", ")}${gaps.length > 20 ? "..." : ""}`);
    } else {
      console.log(`  ✅ No gaps in sequence`);
    }
  } else {
    console.log(`  No quotations for current FY (${financialYear})`);
  }
}

async function verifyRelationships() {
  console.log("\n🔍 Verifying Relationships...");
  
  // Check all quotation items reference valid parts
  const quotations = await QuotationModel.getAll();
  const partNosInQuotations = new Set();
  
  for (const q of quotations) {
    const full = await QuotationModel.getByQuotationNo(q.quotationNo);
    if (full && full.items) {
      for (const item of full.items) {
        if (item.partNumber) {
          partNosInQuotations.add(item.partNumber.trim());
        }
      }
    }
  }
  
  const parts = await PartModel.findByPartNos(Array.from(partNosInQuotations));
  const validPartNos = new Set(parts.map(p => p.partNo.trim()));
  
  const missingParts = Array.from(partNosInQuotations).filter(p => !validPartNos.has(p));
  
  console.log(`  Unique parts referenced in quotations: ${partNosInQuotations.size}`);
  console.log(`  Valid parts found in Parts collection:  ${validPartNos.size}`);
  console.log(`  Missing parts: ${missingParts.length}`);
  
  if (missingParts.length > 0) {
    console.log(`  ❌ Missing parts: ${missingParts.slice(0, 10).join(", ")}${missingParts.length > 10 ? "..." : ""}`);
  } else {
    console.log(`  ✅ All parts valid`);
  }
  
  return { referenced: partNosInQuotations.size, valid: validPartNos.size, missing: missingParts.length };
}

async function verifyFieldCompleteness() {
  console.log("\n🔍 Verifying Field Completeness (sample check)...");
  
  const quotations = await QuotationModel.getAll();
  const sampleSize = Math.min(10, quotations.length);
  const samples = quotations.slice(0, sampleSize);
  
  const requiredFields = {
    customer: ["customerName", "contactPerson", "contactNumber", "gstNo"],
    quotation: ["division", "sourceOfEnquiry", "enquiryGeneratedBy", "quotationDate", "paymentTerms", "quotationValidity", "termsOfDelivery"],
    items: ["partNumber", "partDescription", "quantity", "unitPrice"],
    followup: ["orderStatus"],
  };
  
  let allComplete = true;
  
  for (const q of samples) {
    const full = await QuotationModel.getByQuotationNo(q.quotationNo);
    if (!full) continue;
    
    for (const [section, fields] of Object.entries(requiredFields)) {
      const obj = full[section];
      if (!obj) {
        console.log(`  ❌ ${q.quotationNo}: Missing ${section} section`);
        allComplete = false;
        continue;
      }
      for (const field of fields) {
        const value = section === "items" ? full.items[0]?.[field] : obj[field];
        if (!value || (typeof value === "string" && value.trim() === "")) {
          console.log(`  ⚠️  ${q.quotationNo}: ${section}.${field} is empty`);
        }
      }
    }
  }
  
  if (allComplete) {
    console.log(`  ✅ All required fields populated in ${sampleSize} sampled quotations`);
  }
  
  return { allComplete };
}

async function verifyUsers() {
  console.log("\n🔍 Verifying Users...");
  
  // Count from Google Sheets
  const { readSheetRange, buildHeaderMap, getCellValue } = require("../src/lib/services/googleSheetsService.js");
  const rows = await readSheetRange("Users", null);
  let sheetsCount = 0;
  if (rows && rows.length >= 2) {
    const headers = buildHeaderMap(rows[0]);
    sheetsCount = rows.slice(1).filter(row => 
      getCellValue(row, headers, "Username").trim() !== ""
    ).length;
  }

  // Count from MongoDB
  const mongoCount = await UserModel.count();

  console.log(`  Google Sheets: ${sheetsCount}`);
  console.log(`  MongoDB:       ${mongoCount}`);
  
  const match = sheetsCount === mongoCount;
  console.log(`  Status:        ${match ? "✅ MATCH" : "❌ MISMATCH"}`);
  
  return { sheetsCount, mongoCount, match };
}

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════════╗");
  console.log("║       Migration Verification Report                              ║");
  console.log("╚═══════════════════════════════════════════════════════════════════╝");

  try {
    await prewarmAuth();
    console.log("🔐 Google Sheets auth ready");

    const results = {
      users: await verifyUsers(),
      customers: await verifyCustomers(),
      parts: await verifyParts(),
      quotations: await verifyQuotations(),
      followupHistory: await verifyFollowupHistory(),
    };

    await verifyQuotationNumbering();
    await verifyRelationships();
    await verifyFieldCompleteness();

    console.log("\n╔═══════════════════════════════════════════════════════════════════╗");
    console.log("║       SUMMARY                                                    ║");
    console.log("╚═══════════════════════════════════════════════════════════════════╝");
    
    const allMatch = 
      results.users.match &&
      results.customers.match &&
      results.parts.match &&
      results.quotations.quoMatch &&
      results.quotations.itemMatch &&
      results.followupHistory.match;
    
    console.log(`\nOverall Status: ${allMatch ? "✅ ALL CHECKS PASSED" : "❌ SOME CHECKS FAILED"}`);
    
    if (!allMatch) {
      console.log("\n⚠️  Please review the mismatches above before switching to MongoDB.");
      process.exit(1);
    } else {
      console.log("\n🎉 Migration verification successful! Ready to switch APIs.");
    }

  } catch (error) {
    console.error("\n❌ Verification failed:", error);
    process.exit(1);
  }
}

main();