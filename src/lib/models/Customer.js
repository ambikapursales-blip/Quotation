/**
 * Customer Model
 * Stores customer master data + extended fields from quotation history
 */

import { getDb } from "@/lib/db/mongodb";
import { ObjectId } from "mongodb";

const COLLECTION = "customers";

/**
 * Transform a MongoDB document to the application's customer format
 */
function toAppCustomer(doc) {
  return {
    _id: doc._id.toString(),
    customerName: doc.customerName || "",
    fullAddressWithGST: doc.fullAddressWithGST || "",
    fullAddress: doc.fullAddress || "",
    gstNo: doc.gstNo || "",
    stateName: doc.stateName || "",
    stateCode: doc.stateCode || "",
    // Extended fields from Data sheet history
    contactPerson: doc.contactPerson || "",
    contactNumber: doc.contactNumber || "",
    designation: doc.designation || "",
    emailTo: doc.emailTo || "",
    emailCc: doc.emailCc || "",
    location: doc.location || "",
    userId: doc.userId || "",
    engineerRemark: doc.engineerRemark || "",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Transform application customer data to MongoDB document
 */
function toMongoCustomer(data, isUpdate = false) {
  const now = new Date();
  const doc = {
    customerName: data.customerName?.trim() || "",
    fullAddressWithGST: data.fullAddressWithGST?.trim() || "",
    fullAddress: data.fullAddress?.trim() || "",
    gstNo: data.gstNo?.trim() || "",
    stateName: data.stateName?.trim() || "",
    stateCode: data.stateCode?.trim() || "",
    contactPerson: data.contactPerson?.trim() || "",
    contactNumber: data.contactNumber?.trim() || "",
    designation: data.designation?.trim() || "",
    emailTo: data.emailTo?.trim() || "",
    emailCc: data.emailCc?.trim() || "",
    location: data.location?.trim() || "",
    userId: data.userId?.trim() || "",
    engineerRemark: data.engineerRemark?.trim() || "",
  };

  if (!isUpdate) {
    doc.createdAt = now;
  }
  doc.updatedAt = now;

  return doc;
}

export const CustomerModel = {
  /**
   * Get all customers (for dashboard/master data)
   */
  async getAll() {
    const db = await getDb();
    const docs = await db
      .collection(COLLECTION)
      .find({})
      .sort({ customerName: 1 })
      .toArray();
    return docs.map(toAppCustomer);
  },

  /**
   * Search customers by name or GST number
   */
  async search(query) {
    if (!query || !query.trim()) return [];
    const q = query.trim();
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    const db = await getDb();
    const docs = await db
      .collection(COLLECTION)
      .find({
        $or: [{ customerName: regex }, { gstNo: regex }],
      })
      .sort({ customerName: 1 })
      .limit(25)
      .toArray();
    return docs.map(toAppCustomer);
  },

  /**
   * Get customer by MongoDB _id
   */
  async getById(id) {
    const db = await getDb();
    const doc = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });
    return doc ? toAppCustomer(doc) : null;
  },

  /**
   * Get customer by customer name (case-insensitive)
   */
  async getByName(name) {
    const db = await getDb();
    const doc = await db.collection(COLLECTION).findOne({
      customerName: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });
    return doc ? toAppCustomer(doc) : null;
  },

  /**
   * Create a new customer
   */
  async create(data) {
    const db = await getDb();
    const doc = toMongoCustomer(data);
    const result = await db.collection(COLLECTION).insertOne(doc);
    return { ...doc, _id: result.insertedId.toString() };
  },

  /**
   * Update customer by _id
   */
  async updateById(id, data) {
    const db = await getDb();
    const doc = toMongoCustomer(data, true);
    const result = await db.collection(COLLECTION).findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: doc },
      { returnDocument: "after" }
    );
    return result ? toAppCustomer(result) : null;
  },

  /**
   * Delete customer by _id (soft delete - clear fields)
   */
  async deleteById(id) {
    const db = await getDb();
    const emptyDoc = {
      customerName: "",
      fullAddressWithGST: "",
      fullAddress: "",
      gstNo: "",
      stateName: "",
      stateCode: "",
      contactPerson: "",
      contactNumber: "",
      designation: "",
      emailTo: "",
      emailCc: "",
      location: "",
      userId: "",
      engineerRemark: "",
      updatedAt: new Date(),
    };
    const result = await db.collection(COLLECTION).findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: emptyDoc },
      { returnDocument: "after" }
    );
    return !!result;
  },

  /**
   * Get customer count
   */
  async count() {
    const db = await getDb();
    return db.collection(COLLECTION).countDocuments({ customerName: { $ne: "" } });
  },

  /**
   * Bulk upsert customers (for migration)
   * Uses customerName as the unique key for upsert
   */
  async bulkUpsert(customers) {
    const db = await getDb();
    const operations = customers.map((c) => ({
      updateOne: {
        filter: { customerName: c.customerName?.trim() },
        update: { $set: toMongoCustomer(c) },
        upsert: true,
      },
    }));

    if (operations.length === 0) return { inserted: 0, updated: 0 };

    const result = await db.collection(COLLECTION).bulkWrite(operations, { ordered: false });
    return { inserted: result.upsertedCount, updated: result.modifiedCount };
  },

  /**
   * Find customers by names array (for migration verification)
   */
  async findByNames(names) {
    const db = await getDb();
    const docs = await db
      .collection(COLLECTION)
      .find({ customerName: { $in: names } })
      .toArray();
    return docs.map(toAppCustomer);
  },
};