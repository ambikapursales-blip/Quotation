/**
 * Part Model
 * Stores parts master data with stock and pricing
 */

import { getDb } from "@/lib/db/mongodb";
import { ObjectId } from "mongodb";

const COLLECTION = "parts";

/**
 * Transform a MongoDB document to the application's part format
 */
function toAppPart(doc) {
  return {
    _id: doc._id.toString(),
    partNo: doc.partNo || "",
    description: doc.description || "",
    group: doc.group || "",
    subGroup: doc.subGroup || "",
    aRaipur: doc.aRaipur || 0,
    bRaigarh: doc.bRaigarh || 0,
    cAmbikapur: doc.cAmbikapur || 0,
    dSatna: doc.dSatna || 0,
    lastPurchaseDate: doc.lastPurchaseDate || "",
    applicableDate: doc.applicableDate || "",
    standardRate: doc.standardRate || 0,
    locationRaipur: doc.locationRaipur || "",
    locationRaigarh: doc.locationRaigarh || "",
    locationAmbikapur: doc.locationAmbikapur || "",
    locationSatna: doc.locationSatna || "",
    raipurStockValue: doc.raipurStockValue || 0,
    raigarhStockValue: doc.raigarhStockValue || 0,
    ambikapurStockValue: doc.ambikapurStockValue || 0,
    satnaStockValue: doc.satnaStockValue || 0,
    stockStatus: doc.stockStatus || "",
    lowStock: doc.lowStock || 0,
    outOfStock: doc.outOfStock || 0,
    inStock: doc.inStock || 0,
    minimumQty: doc.minimumQty || 0,
    pendingOrderInHO: doc.pendingOrderInHO || 0,
    needToOrder: doc.needToOrder || 0,
    status: doc.status || "",
    hsnCode: doc.hsnCode || "",
    totalQty: doc.totalQty || 0,
    totalPrice: doc.totalPrice || 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Transform application part data to MongoDB document
 */
function toMongoPart(data, isUpdate = false) {
  const now = new Date();
  const doc = {
    partNo: data.partNo?.trim() || "",
    description: data.description?.trim() || "",
    group: data.group?.trim() || "",
    subGroup: data.subGroup?.trim() || "",
    aRaipur: Number(data.aRaipur) || 0,
    bRaigarh: Number(data.bRaigarh) || 0,
    cAmbikapur: Number(data.cAmbikapur) || 0,
    dSatna: Number(data.dSatna) || 0,
    lastPurchaseDate: data.lastPurchaseDate?.trim() || "",
    applicableDate: data.applicableDate?.trim() || "",
    standardRate: Number(data.standardRate) || 0,
    locationRaipur: data.locationRaipur?.trim() || "",
    locationRaigarh: data.locationRaigarh?.trim() || "",
    locationAmbikapur: data.locationAmbikapur?.trim() || "",
    locationSatna: data.locationSatna?.trim() || "",
    raipurStockValue: Number(data.raipurStockValue) || 0,
    raigarhStockValue: Number(data.raigarhStockValue) || 0,
    ambikapurStockValue: Number(data.ambikapurStockValue) || 0,
    satnaStockValue: Number(data.satnaStockValue) || 0,
    stockStatus: data.stockStatus?.trim() || "",
    lowStock: Number(data.lowStock) || 0,
    outOfStock: Number(data.outOfStock) || 0,
    inStock: Number(data.inStock) || 0,
    minimumQty: Number(data.minimumQty) || 0,
    pendingOrderInHO: Number(data.pendingOrderInHO) || 0,
    needToOrder: Number(data.needToOrder) || 0,
    status: data.status?.trim() || "",
    hsnCode: data.hsnCode?.trim() || "",
    totalQty: Number(data.totalQty) || 0,
    totalPrice: Number(data.totalPrice) || 0,
  };

  if (!isUpdate) {
    doc.createdAt = now;
  }
  doc.updatedAt = now;

  return doc;
}

export const PartModel = {
  /**
   * Get all parts
   */
  async getAll() {
    const db = await getDb();
    const docs = await db
      .collection(COLLECTION)
      .find({ partNo: { $ne: "" } })
      .sort({ partNo: 1 })
      .toArray();
    return docs.map(toAppPart);
  },

  /**
   * Search parts by part number (prefix match)
   */
  async search(query) {
    if (!query || !query.trim()) return [];
    const q = query.trim().toLowerCase().replace(/\s+/g, "");

    const db = await getDb();
    // For prefix search, we need to match normalized part numbers
    // Since we can't easily do normalized prefix match in MongoDB,
    // we'll fetch candidates and filter in memory
    const docs = await db
      .collection(COLLECTION)
      .find({ partNo: { $ne: "" } })
      .limit(200)
      .toArray();

    const results = [];
    for (const doc of docs) {
      const partNoNormalized = (doc.partNo || "").toLowerCase().replace(/\s+/g, "");
      if (partNoNormalized.startsWith(q)) {
        results.push(toAppPart(doc));
        if (results.length >= 100) break;
      }
    }
    return results;
  },

  /**
   * Get part by MongoDB _id
   */
  async getById(id) {
    const db = await getDb();
    const doc = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });
    return doc ? toAppPart(doc) : null;
  },

  /**
   * Get part by part number (exact match)
   */
  async getByPartNo(partNo) {
    const db = await getDb();
    const doc = await db.collection(COLLECTION).findOne({
      partNo: { $regex: new RegExp(`^${partNo.trim()}$`, "i") },
    });
    return doc ? toAppPart(doc) : null;
  },

  /**
   * Create a new part
   */
  async create(data) {
    const db = await getDb();
    const doc = toMongoPart(data);
    const result = await db.collection(COLLECTION).insertOne(doc);
    return { ...doc, _id: result.insertedId.toString() };
  },

  /**
   * Update part by _id
   */
  async updateById(id, data) {
    const db = await getDb();
    const doc = toMongoPart(data, true);
    const result = await db.collection(COLLECTION).findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: doc },
      { returnDocument: "after" }
    );
    return result ? toAppPart(result) : null;
  },

  /**
   * Delete part by _id (soft delete - clear fields)
   */
  async deleteById(id) {
    const db = await getDb();
    const emptyDoc = {
      partNo: "",
      description: "",
      group: "",
      subGroup: "",
      aRaipur: 0,
      bRaigarh: 0,
      cAmbikapur: 0,
      dSatna: 0,
      lastPurchaseDate: "",
      applicableDate: "",
      standardRate: 0,
      locationRaipur: "",
      locationRaigarh: "",
      locationAmbikapur: "",
      locationSatna: "",
      raipurStockValue: 0,
      raigarhStockValue: 0,
      ambikapurStockValue: 0,
      satnaStockValue: 0,
      stockStatus: "",
      lowStock: 0,
      outOfStock: 0,
      inStock: 0,
      minimumQty: 0,
      pendingOrderInHO: 0,
      needToOrder: 0,
      status: "",
      hsnCode: "",
      totalQty: 0,
      totalPrice: 0,
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
   * Get part count
   */
  async count() {
    const db = await getDb();
    return db.collection(COLLECTION).countDocuments({ partNo: { $ne: "" } });
  },

  /**
   * Bulk upsert parts (for migration)
   * Uses partNo as the unique key for upsert
   */
  async bulkUpsert(parts) {
    const db = await getDb();
    const operations = parts.map((p) => ({
      updateOne: {
        filter: { partNo: p.partNo?.trim() },
        update: { $set: toMongoPart(p) },
        upsert: true,
      },
    }));

    if (operations.length === 0) return { inserted: 0, updated: 0 };

    const result = await db.collection(COLLECTION).bulkWrite(operations, { ordered: false });
    return { inserted: result.upsertedCount, updated: result.modifiedCount };
  },

  /**
   * Find parts by part numbers array (for migration verification)
   */
  async findByPartNos(partNos) {
    const db = await getDb();
    const docs = await db
      .collection(COLLECTION)
      .find({ partNo: { $in: partNos } })
      .toArray();
    return docs.map(toAppPart);
  },
};