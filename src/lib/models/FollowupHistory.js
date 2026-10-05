/**
 * Followup History Model
 * Append-only log of all follow-up and order status submissions
 */

import { getDb } from "@/lib/db/mongodb";
import { ObjectId } from "mongodb";

const COLLECTION = "followupHistory";

/**
 * Transform a MongoDB document to the application's followup history format
 */
function toAppFollowupRecord(doc) {
  return {
    _id: doc._id.toString(),
    Timestamp: doc.timestamp ? doc.timestamp.toISOString() : "",
    "Quotation No": doc.quotationNo || "",
    "Submission Type": doc.submissionType || "",
    "Next Followup Date": doc.nextFollowupDate || "",
    "Followup Status": doc.followupStatus || "",
    "Followup Remark": doc.followupRemark || "",
    "Order Status": doc.orderStatus || "",
    "Attach Order PDF": doc.attachOrderPDF || "",
    "Order Received date": doc.orderReceivedDate || "",
    "Remark for Order": doc.remarkForOrder || "",
    "Order Number": doc.orderNumber || "",
    "Order Date": doc.orderDate || "",
    "Order Verification Status": doc.orderVerificationStatus || "",
    "Attached Payment Receipt": doc.attachedPaymentReceipt || "",
    "Due Days": doc.dueDays || "",
    "Prefilled Form": doc.prefilledForm || "",
    "Prefilled Form URL": doc.prefilledFormUrl || "",
    __sheetRow: doc._id.toString(), // For compatibility
  };
}

/**
 * Transform application followup data to MongoDB document
 */
function toMongoFollowupRecord(data) {
  return {
    quotationNo: data.quotationNo?.trim() || "",
    timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
    submissionType: data.submissionType?.trim() || "",
    nextFollowupDate: data.nextFollowupDate?.trim() || "",
    followupStatus: data.followupStatus?.trim() || "",
    followupRemark: data.followupRemark?.trim() || "",
    orderStatus: data.orderStatus?.trim() || "",
    attachOrderPDF: data.attachOrderPDF?.trim() || "",
    orderReceivedDate: data.orderReceivedDate?.trim() || "",
    remarkForOrder: data.remarkForOrder?.trim() || "",
    orderNumber: data.orderNumber?.trim() || "",
    orderDate: data.orderDate?.trim() || "",
    orderVerificationStatus: data.orderVerificationStatus?.trim() || "",
    attachedPaymentReceipt: data.attachedPaymentReceipt?.trim() || "",
    dueDays: data.dueDays?.trim() || "",
    prefilledForm: data.prefilledForm?.trim() || "",
    prefilledFormUrl: data.prefilledFormUrl?.trim() || "",
    createdAt: new Date(),
  };
}

export const FollowupHistoryModel = {
  /**
   * Get all followup history records (newest first)
   */
  async getAll() {
    const db = await getDb();
    const docs = await db
      .collection(COLLECTION)
      .find({})
      .sort({ timestamp: -1 })
      .toArray();
    return docs.map(toAppFollowupRecord);
  },

  /**
   * Get followup history for a specific quotation
   */
  async getByQuotationNo(quotationNo) {
    const db = await getDb();
    const docs = await db
      .collection(COLLECTION)
      .find({ quotationNo })
      .sort({ timestamp: -1 })
      .toArray();
    return docs.map(toAppFollowupRecord);
  },

  /**
   * Get current pending follow-up records (one per quotation)
   */
  async getCurrentPending() {
    const db = await getDb();
    const docs = await db
      .collection(COLLECTION)
      .find({
        submissionType: "Next Follow-up",
        followupStatus: "Pending",
      })
      .sort({ timestamp: -1 })
      .toArray();

    // Get the latest pending per quotation
    const currentByQuotation = new Map();
    for (const doc of docs) {
      const qNo = doc.quotationNo;
      if (!currentByQuotation.has(qNo)) {
        currentByQuotation.set(qNo, toAppFollowupRecord(doc));
      }
    }

    // Sort by next followup date ascending
    const current = Array.from(currentByQuotation.values());
    current.sort((a, b) => {
      const dateA = a["Next Followup Date"] ? new Date(a["Next Followup Date"].split("/").reverse().join("-")) : null;
      const dateB = b["Next Followup Date"] ? new Date(b["Next Followup Date"].split("/").reverse().join("-")) : null;
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA - dateB;
    });

    return current;
  },

  /**
   * Append a new followup history record
   */
  async append(data) {
    const db = await getDb();
    const doc = toMongoFollowupRecord(data);
    const result = await db.collection(COLLECTION).insertOne(doc);
    return { ...doc, _id: result.insertedId.toString() };
  },

  /**
   * Update followup status for pending records of a quotation
   * (Mark as Completed when new follow-up or order status is added)
   */
  async completePendingFollowups(quotationNo) {
    const db = await getDb();
    const result = await db.collection(COLLECTION).updateMany(
      {
        quotationNo,
        submissionType: "Next Follow-up",
        followupStatus: "Pending",
      },
      { $set: { followupStatus: "Completed" } }
    );
    return result.modifiedCount;
  },

  /**
   * Get followup count
   */
  async count() {
    const db = await getDb();
    return db.collection(COLLECTION).countDocuments({});
  },

  /**
   * Bulk insert followup history (for migration)
   */
  async bulkInsert(records) {
    const db = await getDb();
    if (records.length === 0) return { inserted: 0 };

    const docs = records.map(toMongoFollowupRecord);
    const result = await db.collection(COLLECTION).insertMany(docs, { ordered: false });
    return { inserted: result.insertedCount };
  },

  /**
   * Find followup records by quotation numbers (for verification)
   */
  async findByQuotationNos(quotationNos) {
    const db = await getDb();
    const docs = await db
      .collection(COLLECTION)
      .find({ quotationNo: { $in: quotationNos } })
      .toArray();
    return docs.map(toAppFollowupRecord);
  },

  /**
   * Get distinct next followup dates (for dashboard filter options)
   */
  async getDistinctNextFollowupDates() {
    const db = await getDb();
    const dates = await db.collection(COLLECTION).distinct("nextFollowupDate");
    return dates.filter((d) => d && d.trim() !== "").sort();
  },
};