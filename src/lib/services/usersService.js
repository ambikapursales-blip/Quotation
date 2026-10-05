// Server-only reader for the "Users" collection in MongoDB.

import { UserModel } from "@/lib/models/User";

// Returns [{ username, password, active }] from MongoDB.
// Returns [] (never throws) when the collection is empty or read fails.
export async function getUsers() {
  try {
    const mongoUsers = await UserModel.getAll();
    if (mongoUsers && mongoUsers.length > 0) {
      return mongoUsers.map(u => ({
        username: u.username,
        password: u.password,
        active: u.active,
      }));
    }
    return [];
  } catch (error) {
    console.warn("[usersService] MongoDB read failed:", error.message);
    return [];
  }
}