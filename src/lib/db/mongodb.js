/**
 * MongoDB Connection Singleton
 * 
 * Provides a single cached MongoDB client and database instance
 * across all serverless function invocations (Next.js App Router).
 * Uses globalThis to share the connection pool in development.
 */

import { MongoClient } from "mongodb";

// Lazy initialization - only read env vars at runtime, not during build
function getConfig() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || "quotation_db";
  
  if (!uri) {
    throw new Error(
      "Missing MONGODB_URI environment variable. Please add it to your .env.local file."
    );
  }
  return { uri, dbName };
}

let cachedClient = null;
let cachedDb = null;

// In development, use globalThis to preserve the connection across hot reloads
if (process.env.NODE_ENV !== "production") {
  if (!globalThis._mongoClient) {
    globalThis._mongoClient = null;
  }
  if (!globalThis._mongoDb) {
    globalThis._mongoDb = null;
  }
  cachedClient = globalThis._mongoClient;
  cachedDb = globalThis._mongoDb;
}

export async function connectToDatabase() {
  // Return cached connection if available
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const { uri, dbName } = getConfig();
  
  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    minPoolSize: 0,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4, // IPv4
  });

  await client.connect();
  const db = client.db(dbName);

  // Cache for reuse
  cachedClient = client;
  cachedDb = db;

  if (process.env.NODE_ENV !== "production") {
    globalThis._mongoClient = client;
    globalThis._mongoDb = db;
  }

  console.log(`[MongoDB] Connected to database: ${dbName}`);
  return { client, db };
}

export async function getDb() {
  const { db } = await connectToDatabase();
  return db;
}

export async function closeDatabaseConnection() {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
    if (process.env.NODE_ENV !== "production") {
      globalThis._mongoClient = null;
      globalThis._mongoDb = null;
    }
    console.log("[MongoDB] Connection closed");
  }
}

/**
 * Initialize indexes for all collections.
 * Call this once at application startup.
 */
export async function initializeIndexes() {
  const db = await getDb();

  // Customers collection indexes
  await db.collection("customers").createIndexes([
    { key: { customerName: 1 }, name: "idx_customer_name" },
    { key: { gstNo: 1 }, name: "idx_customer_gst", sparse: true },
    { key: { stateName: 1 }, name: "idx_customer_state" },
    { key: { createdAt: -1 }, name: "idx_customer_created" },
  ]);

  // Parts collection indexes
  await db.collection("parts").createIndexes([
    { key: { partNo: 1 }, name: "idx_part_no", unique: true },
    { key: { description: "text", partNo: "text" }, name: "idx_part_text_search" },
    { key: { group: 1 }, name: "idx_part_group" },
    { key: { subGroup: 1 }, name: "idx_part_subgroup" },
    { key: { hsnCode: 1 }, name: "idx_part_hsn", sparse: true },
    { key: { status: 1 }, name: "idx_part_status" },
    { key: { createdAt: -1 }, name: "idx_part_created" },
  ]);

  // Quotations collection indexes
  await db.collection("quotations").createIndexes([
    { key: { quotationNo: 1 }, name: "idx_quotation_no", unique: true },
    { key: { "customer.customerName": 1 }, name: "idx_quotation_customer" },
    { key: { quotationDate: 1 }, name: "idx_quotation_date" },
    { key: { division: 1 }, name: "idx_quotation_division" },
    { key: { "followup.orderStatus": 1 }, name: "idx_quotation_order_status" },
    { key: { "followup.nextFollowupDate": 1 }, name: "idx_quotation_next_followup" },
    { key: { "followup.nextFollowupStatus": 1 }, name: "idx_quotation_followup_status" },
    { key: { createdAt: -1 }, name: "idx_quotation_created" },
    { key: { "items.partNumber": 1 }, name: "idx_quotation_part_number" },
    { key: { "customer.gstNo": 1 }, name: "idx_quotation_customer_gst", sparse: true },
  ]);

  // Followup History collection indexes
  await db.collection("followupHistory").createIndexes([
    { key: { quotationNo: 1, timestamp: -1 }, name: "idx_followup_quotation_time" },
    { key: { quotationNo: 1, submissionType: 1 }, name: "idx_followup_quotation_type" },
    { key: { timestamp: -1 }, name: "idx_followup_time" },
    { key: { submissionType: 1 }, name: "idx_followup_type" },
    { key: { followupStatus: 1 }, name: "idx_followup_status" },
  ]);

  // Users collection indexes (if using MongoDB for users)
  await db.collection("users").createIndexes([
    { key: { username: 1 }, name: "idx_user_username", unique: true },
    { key: { active: 1 }, name: "idx_user_active" },
  ]);

  console.log("[MongoDB] All indexes initialized");
  return true;
}