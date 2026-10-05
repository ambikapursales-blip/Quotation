/**
 * User Model
 * Stores authentication users
 */

import { getDb } from "@/lib/db/mongodb";
import { ObjectId } from "mongodb";

const COLLECTION = "users";

function toAppUser(doc) {
  return {
    _id: doc._id.toString(),
    username: doc.username || "",
    password: doc.password || "", // Store hashed in production
    active: doc.active === true,
    role: doc.role || "user",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toMongoUser(data, isUpdate = false) {
  const now = new Date();
  const doc = {
    username: data.username?.trim() || "",
    password: data.password?.trim() || "",
    active: data.active === true,
    role: data.role?.trim() || "user",
  };

  if (!isUpdate) {
    doc.createdAt = now;
  }
  doc.updatedAt = now;

  return doc;
}

export const UserModel = {
  async getAll() {
    const db = await getDb();
    const docs = await db.collection(COLLECTION).find({}).sort({ username: 1 }).toArray();
    return docs.map(toAppUser);
  },

  async getByUsername(username) {
    const db = await getDb();
    const doc = await db.collection(COLLECTION).findOne({
      username: { $regex: new RegExp(`^${username.trim()}$`, "i") },
    });
    return doc ? toAppUser(doc) : null;
  },

  async getById(id) {
    const db = await getDb();
    const doc = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });
    return doc ? toAppUser(doc) : null;
  },

  async getFirstActive() {
    const db = await getDb();
    const doc = await db.collection(COLLECTION).findOne({ active: true }, { sort: { username: 1 } });
    return doc ? toAppUser(doc) : null;
  },

  async create(data) {
    const db = await getDb();
    const doc = toMongoUser(data);
    const result = await db.collection(COLLECTION).insertOne(doc);
    return { ...doc, _id: result.insertedId.toString() };
  },

  async updateById(id, data) {
    const db = await getDb();
    const doc = toMongoUser(data, true);
    const result = await db.collection(COLLECTION).findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: doc },
      { returnDocument: "after" }
    );
    return result ? toAppUser(result) : null;
  },

  async deleteById(id) {
    const db = await getDb();
    const result = await db.collection(COLLECTION).findOneAndDelete(
      { _id: new ObjectId(id) }
    );
    return !!result;
  },

  async count() {
    const db = await getDb();
    return db.collection(COLLECTION).countDocuments({});
  },

  async bulkUpsert(users) {
    const db = await getDb();
    const operations = users.map((u) => ({
      updateOne: {
        filter: { username: u.username?.trim() },
        update: { $set: toMongoUser(u) },
        upsert: true,
      },
    }));

    if (operations.length === 0) return { inserted: 0, updated: 0 };

    const result = await db.collection(COLLECTION).bulkWrite(operations, { ordered: false });
    return { inserted: result.upsertedCount, updated: result.modifiedCount };
  },
};