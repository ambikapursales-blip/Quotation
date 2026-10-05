/**
 * Quotation Model
 * One document per quotation with embedded line items and follow-up workflow fields
 */

import { getDb } from "@/lib/db/mongodb";
import { ObjectId } from "mongodb";
import { DEFAULT_UOM, DEFAULT_GST_RATE } from "@/lib/constants/quotationOptions";
import { computeLineTotal, computeGstAmount } from "@/lib/utils/formatters";
import { toNumber } from "@/lib/utils/formatters";

const COLLECTION = "quotations";

/**
 * Transform a MongoDB document to the application's quotation format
 */
function toAppQuotation(doc) {
  return {
    quotationNo: doc.quotationNo,
    customer: doc.customer || {},
    quotation: doc.quotation || {},
    followup: doc.followup || {},
    items: (doc.items || []).map((item) => ({
      partNumber: item.partNumber,
      description: item.partDescription,
      hsnCode: item.hsnCode,
      uom: item.uom,
      gstRate: item.gstRate,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      otherRate: item.otherRate,
      discount: item.discount,
      availability: item.availability,
      priceWef: item.priceWef,
      liveStock: item.liveStock,
      total: item.totalAmount,
    })),
    totals: doc.totals || { itemCount: 0, subtotal: 0, grandTotal: 0 },
    _id: doc._id.toString(),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Build quotation items from form data
 */
function buildQuotationItems(items, customer, quotationInfo, createdAt) {
  return items.map((item) => {
    const subAmount = toNumber(item.quantity) * toNumber(item.unitPrice);
    const basicTotal = toNumber(item.quantity) * (toNumber(item.unitPrice) + toNumber(item.otherRate));
    const totalAmount = computeLineTotal(item);
    const gstAmount = computeGstAmount(item, DEFAULT_GST_RATE);

    return {
      partNumber: item.partNumber || "",
      partDescription: item.partDescription || "",
      hsnCode: item.hsnCode || "",
      uom: DEFAULT_UOM,
      gstRate: String(DEFAULT_GST_RATE),
      quantity: toNumber(item.quantity),
      unitPrice: toNumber(item.unitPrice),
      otherRate: toNumber(item.otherRate),
      discount: toNumber(item.discount),
      availability: item.availability || "",
      priceWef: item.priceWef || "",
      liveStock: item.liveStock || "",
      // Computed fields
      subAmount,
      totalAmount,
      basicTotalAmount: basicTotal,
      gstAmount,
    };
  });
}

/**
 * Build followup object from form data
 */
function buildFollowupObject(existingFollowup = {}, updates = {}) {
  return {
    numberOfFollowup: updates.numberOfFollowup !== undefined ? Number(updates.numberOfFollowup) : (existingFollowup.numberOfFollowup || 0),
    orderFollowUpSummary: updates.orderFollowUpSummary !== undefined ? updates.orderFollowUpSummary : (existingFollowup.orderFollowUpSummary || ""),
    nextFollowupDate: updates.nextFollowupDate !== undefined ? updates.nextFollowupDate : (existingFollowup.nextFollowupDate || ""),
    nextFollowupStatus: updates.nextFollowupStatus !== undefined ? updates.nextFollowupStatus : (existingFollowup.nextFollowupStatus || ""),
    orderStatus: updates.orderStatus !== undefined ? updates.orderStatus : (existingFollowup.orderStatus || "Pending"),
    orderReceivedDate: updates.orderReceivedDate !== undefined ? updates.orderReceivedDate : (existingFollowup.orderReceivedDate || ""),
    remarkForOrderReceived: updates.remarkForOrderReceived !== undefined ? updates.remarkForOrderReceived : (existingFollowup.remarkForOrderReceived || ""),
    orderNumber: updates.orderNumber !== undefined ? updates.orderNumber : (existingFollowup.orderNumber || ""),
    orderDate: updates.orderDate !== undefined ? updates.orderDate : (existingFollowup.orderDate || ""),
    orderVerificationStatus: updates.orderVerificationStatus !== undefined ? updates.orderVerificationStatus : (existingFollowup.orderVerificationStatus || ""),
    attachedPaymentReceipt: updates.attachedPaymentReceipt !== undefined ? updates.attachedPaymentReceipt : (existingFollowup.attachedPaymentReceipt || ""),
    dueDays: updates.dueDays !== undefined ? updates.dueDays : (existingFollowup.dueDays || ""),
    prefilledForm: updates.prefilledForm !== undefined ? updates.prefilledForm : (existingFollowup.prefilledForm || ""),
    prefilledFormUrl: updates.prefilledFormUrl !== undefined ? updates.prefilledFormUrl : (existingFollowup.prefilledFormUrl || ""),
  };
}

/**
 * Calculate totals from items
 */
function calculateTotals(items) {
  const subtotal = items.reduce((sum, item) => sum + (toNumber(item.quantity) * toNumber(item.unitPrice)), 0);
  const grandTotal = items.reduce((sum, item) => sum + item.totalAmount, 0);
  return {
    itemCount: items.length,
    subtotal,
    grandTotal,
  };
}

export const QuotationModel = {
  /**
   * Get all quotations (for list view) - returns summary only
   */
  async getAll() {
    const db = await getDb();
    const docs = await db
      .collection(COLLECTION)
      .find({})
      .sort({ quotationNo: -1 })
      .project({
        quotationNo: 1,
        "customer.customerName": 1,
        "customer.contactNumber": 1,
        quotationDate: 1,
        division: 1,
        "quotation.enquiryGeneratedBy": 1,
        "followup.numberOfFollowup": 1,
        "followup.orderStatus": 1,
        itemCount: 1,
        "totals.grandTotal": 1,
        totals: 1,
      })
      .toArray();

    return docs.map((doc) => ({
      quotationNo: doc.quotationNo,
      customerName: doc.customer?.customerName || "",
      contactNumber: doc.customer?.contactNumber || "",
      quotationDate: doc.quotationDate || "",
      division: doc.division || "",
      engineer: doc.quotation?.enquiryGeneratedBy || "",
      numberOfFollowup: doc.followup?.numberOfFollowup || 0,
      orderStatus: doc.followup?.orderStatus || "Pending",
      itemCount: doc.totals?.itemCount || doc.itemCount || 0,
      totalAmount: doc.totals?.grandTotal || 0,
    }));
  },

  /**
   * Get quotation by quotation number (full detail)
   */
  async getByQuotationNo(quotationNo) {
    const db = await getDb();
    const doc = await db.collection(COLLECTION).findOne({ quotationNo });
    return doc ? toAppQuotation(doc) : null;
  },

  /**
   * Get quotations for dashboard with filters
   */
  async getDashboardQuotations(filters = {}) {
    const db = await getDb();
    const query = {};

    if (filters.division) {
      query.division = filters.division;
    }
    if (filters.orderStatus) {
      query["followup.orderStatus"] = filters.orderStatus;
    }
    if (filters.enquiryGeneratedBy) {
      query["quotation.enquiryGeneratedBy"] = filters.enquiryGeneratedBy;
    }
    if (filters.from || filters.to) {
      query.quotationDate = {};
      if (filters.from) {
        // Parse DD/MM/YYYY to compare
        query.quotationDate.$gte = filters.from;
      }
      if (filters.to) {
        query.quotationDate.$lte = filters.to;
      }
    }

    const docs = await db
      .collection(COLLECTION)
      .find(query)
      .sort({ quotationNo: -1 })
      .toArray();

    return docs.map((doc) => ({
      quotationNo: doc.quotationNo,
      customerName: doc.customer?.customerName || "",
      contactNumber: doc.customer?.contactNumber || "",
      quotationDate: doc.quotationDate || "",
      division: doc.division || "",
      engineer: doc.quotation?.enquiryGeneratedBy || "",
      orderStatus: doc.followup?.orderStatus || "Pending",
      itemCount: doc.totals?.itemCount || 0,
      totalAmount: doc.totals?.grandTotal || 0,
      sourceOfEnquiry: doc.quotation?.sourceOfEnquiry || "",
      parsedDate: doc.quotationDate ? new Date(doc.quotationDate.split("/").reverse().join("-")) : null,
    }));
  },

  /**
   * Create a new quotation
   */
  async create(quotationData, meta) {
    const db = await getDb();
    const { quotationId, createdAt } = meta;

    const items = buildQuotationItems(
      quotationData.items,
      quotationData.customer,
      quotationData.quotation,
      createdAt
    );

    const doc = {
      quotationNo: quotationId,
      customer: {
        customerName: quotationData.customer.customerName || "",
        fullAddressGst: quotationData.customer.fullAddressGst || "",
        fullAddress: quotationData.customer.fullAddress || "",
        gstNo: quotationData.customer.gstNo || "",
        stateName: quotationData.customer.stateName || "",
        stateCode: quotationData.customer.stateCode || "",
        contactPerson: quotationData.customer.contactPerson || "",
        contactNumber: quotationData.customer.contactNumber || "",
        designation: quotationData.customer.designation || "",
        emailTo: quotationData.customer.emailTo || "",
        emailCc: quotationData.customer.emailCc || "",
        location: quotationData.customer.location || "",
        userId: quotationData.customer.userId || "",
        engineerRemark: quotationData.customer.engineerRemark || "",
      },
      quotation: {
        division: quotationData.quotation.division || "",
        sourceOfEnquiry: quotationData.quotation.sourceOfEnquiry || "",
        enquiryGeneratedBy: quotationData.quotation.enquiryGeneratedBy || "",
        quotationDate: quotationData.quotation.quotationDate || "",
        validity: quotationData.quotation.validity || "",
        partyReferenceNumber: quotationData.quotation.partyReferenceNumber || "",
        partyReferenceDate: quotationData.quotation.partyReferenceDate || "",
        paymentTerms: quotationData.quotation.paymentTerms || "",
        quotationValidity: quotationData.quotation.quotationValidity || "",
        termsOfDelivery: quotationData.quotation.termsOfDelivery || "",
        quotationFollowUpBy: quotationData.quotation.quotationFollowUpBy || "",
        reviseNumber: quotationData.quotation.reviseNumber || "",
      },
      items,
      followup: {
        numberOfFollowup: 0,
        orderFollowUpSummary: "",
        nextFollowupDate: "",
        nextFollowupStatus: "",
        orderStatus: "Pending",
        orderReceivedDate: "",
        remarkForOrderReceived: "",
        orderNumber: "",
        orderDate: "",
        orderVerificationStatus: "",
        attachedPaymentReceipt: "",
        dueDays: "",
        prefilledForm: "",
        prefilledFormUrl: "",
      },
      totals: calculateTotals(items),
      createdAt: new Date(createdAt),
      updatedAt: new Date(),
    };

    const result = await db.collection(COLLECTION).insertOne(doc);
    return { ...doc, _id: result.insertedId.toString() };
  },

  /**
   * Update quotation by quotation number
   */
  async updateByQuotationNo(quotationNo, quotationData) {
    const db = await getDb();

    const existing = await db.collection(COLLECTION).findOne({ quotationNo });
    if (!existing) return null;

    const items = buildQuotationItems(
      quotationData.items,
      quotationData.customer,
      quotationData.quotation,
      existing.createdAt
    );

    const updateDoc = {
      customer: {
        customerName: quotationData.customer.customerName || "",
        fullAddressGst: quotationData.customer.fullAddressGst || "",
        fullAddress: quotationData.customer.fullAddress || "",
        gstNo: quotationData.customer.gstNo || "",
        stateName: quotationData.customer.stateName || "",
        stateCode: quotationData.customer.stateCode || "",
        contactPerson: quotationData.customer.contactPerson || "",
        contactNumber: quotationData.customer.contactNumber || "",
        designation: quotationData.customer.designation || "",
        emailTo: quotationData.customer.emailTo || "",
        emailCc: quotationData.customer.emailCc || "",
        location: quotationData.customer.location || "",
        userId: quotationData.customer.userId || "",
        engineerRemark: quotationData.customer.engineerRemark || "",
      },
      quotation: {
        division: quotationData.quotation.division || "",
        sourceOfEnquiry: quotationData.quotation.sourceOfEnquiry || "",
        enquiryGeneratedBy: quotationData.quotation.enquiryGeneratedBy || "",
        quotationDate: quotationData.quotation.quotationDate || "",
        validity: quotationData.quotation.validity || "",
        partyReferenceNumber: quotationData.quotation.partyReferenceNumber || "",
        partyReferenceDate: quotationData.quotation.partyReferenceDate || "",
        paymentTerms: quotationData.quotation.paymentTerms || "",
        quotationValidity: quotationData.quotation.quotationValidity || "",
        termsOfDelivery: quotationData.quotation.termsOfDelivery || "",
        quotationFollowUpBy: quotationData.quotation.quotationFollowUpBy || "",
        reviseNumber: quotationData.quotation.reviseNumber || "",
      },
      items,
      totals: calculateTotals(items),
      updatedAt: new Date(),
    };

    const result = await db.collection(COLLECTION).findOneAndUpdate(
      { quotationNo },
      { $set: updateDoc },
      { returnDocument: "after" }
    );

    if (!result) return null;

    return {
      success: true,
      quotationNo,
      rowsWritten: items.length,
      rowsAppended: 0,
      rowsCleared: 0,
    };
  },

  /**
   * Update follow-up fields in quotation (for next follow-up)
   */
  async updateFollowupFields(quotationNo, fieldUpdates) {
    const db = await getDb();
    const existing = await db.collection(COLLECTION).findOne({ quotationNo });
    if (!existing) return { success: false, reason: "not-found" };

    const followup = buildFollowupObject(existing.followup, fieldUpdates);

    const result = await db.collection(COLLECTION).findOneAndUpdate(
      { quotationNo },
      { $set: { followup, updatedAt: new Date() } },
      { returnDocument: "after" }
    );

    return { success: true, quotationNo, rowsUpdated: 1 };
  },

  /**
   * Update order status fields in quotation
   */
  async updateOrderStatusFields(quotationNo, fieldUpdates, isClosing) {
    const db = await getDb();
    const existing = await db.collection(COLLECTION).findOne({ quotationNo });
    if (!existing) return { success: false, reason: "not-found" };

    const followup = buildFollowupObject(existing.followup, fieldUpdates);

    // Clear follow-up workflow mirrors if closing
    if (isClosing) {
      followup.orderFollowUpSummary = "";
      followup.nextFollowupDate = "";
      followup.nextFollowupStatus = "";
    }

    const result = await db.collection(COLLECTION).findOneAndUpdate(
      { quotationNo },
      { $set: { followup, updatedAt: new Date() } },
      { returnDocument: "after" }
    );

    return { success: true, quotationNo, rowsUpdated: 1 };
  },

  /**
   * Generate next sequential quotation number
   */
  async generateNextQuotationNumber() {
    const db = await getDb();

    // Get current financial year (April to March)
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12

    let financialYear;
    if (month >= 4) {
      financialYear = `${String(year).slice(-2)}-${String(year + 1).slice(-2)}`;
    } else {
      financialYear = `${String(year - 1).slice(-2)}-${String(year).slice(-2)}`;
    }

    const prefix = `DEEP/M-SPR/${financialYear}/Q`;

    const doc = await db
      .collection(COLLECTION)
      .find({ quotationNo: { $regex: `^${prefix}` } })
      .sort({ quotationNo: -1 })
      .limit(1)
      .toArray();

    let maxNumber = 0;
    if (doc.length > 0) {
      const numberPart = doc[0].quotationNo.replace(prefix, "");
      const number = parseInt(numberPart, 10);
      if (!isNaN(number) && number > maxNumber) {
        maxNumber = number;
      }
    }

    const nextNumber = maxNumber + 1;
    const paddedNumber = String(nextNumber).padStart(6, "0");

    return `${prefix}${paddedNumber}`;
  },

  /**
   * Get quotation count
   */
  async count() {
    const db = await getDb();
    return db.collection(COLLECTION).countDocuments({});
  },

  /**
   * Bulk insert quotations (for migration)
   */
  async bulkInsert(quotations) {
    const db = await getDb();
    if (quotations.length === 0) return { inserted: 0 };

    const result = await db.collection(COLLECTION).insertMany(quotations, { ordered: false });
    return { inserted: result.insertedCount };
  },

  /**
   * Find quotations by quotation numbers (for verification)
   */
  async findByQuotationNos(quotationNos) {
    const db = await getDb();
    const docs = await db
      .collection(COLLECTION)
      .find({ quotationNo: { $in: quotationNos } })
      .toArray();
    return docs.map(toAppQuotation);
  },

  /**
   * Get distinct divisions
   */
  async getDistinctDivisions() {
    const db = await getDb();
    return db.collection(COLLECTION).distinct("division");
  },

  /**
   * Get distinct order statuses
   */
  async getDistinctOrderStatuses() {
    const db = await getDb();
    return db.collection(COLLECTION).distinct("followup.orderStatus");
  },

  /**
   * Get distinct engineers
   */
  async getDistinctEngineers() {
    const db = await getDb();
    return db.collection(COLLECTION).distinct("quotation.enquiryGeneratedBy");
  },
};