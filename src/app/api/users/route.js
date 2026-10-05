import { NextResponse } from "next/server";
import { getAllUsers, createUser } from "@/lib/services/mongodbService";
import { getSessionUser, unauthorizedResponse } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));
    const search = (searchParams.get("search") || "").trim();
    const sortBy = searchParams.get("sortBy") || "username";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1;
    const roleFilter = (searchParams.get("role") || "").trim();
    const statusFilter = (searchParams.get("status") || "").trim();

    let users = await getAllUsers();

    if (search) {
      const lower = search.toLowerCase();
      users = users.filter(
        (u) =>
          u.username.toLowerCase().includes(lower) ||
          (u.fullName || "").toLowerCase().includes(lower) ||
          (u.email || "").toLowerCase().includes(lower)
      );
    }

    if (roleFilter) {
      users = users.filter((u) => (u.role || "User").toLowerCase() === roleFilter.toLowerCase());
    }

    if (statusFilter) {
      const active = statusFilter.toLowerCase() === "active";
      users = users.filter((u) => u.active === active);
    }

    const sortableFields = ["username", "role", "active", "createdAt"];
    const sortField = sortableFields.includes(sortBy) ? sortBy : "username";

    users.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = (bVal || "").toLowerCase();
        if (aVal < bVal) return -1 * sortOrder;
        if (aVal > bVal) return 1 * sortOrder;
        return 0;
      }
      if (aVal instanceof Date) {
        aVal = aVal.getTime();
        bVal = bVal instanceof Date ? bVal.getTime() : 0;
        return (aVal - bVal) * sortOrder;
      }
      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
      return (aVal - bVal) * sortOrder;
    });

    const total = users.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const paginated = users.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      success: true,
      data: paginated,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    });
  } catch (error) {
    console.error("[users/GET] Error:", error.message);
    return NextResponse.json(
      { success: false, message: "Failed to fetch users.", data: [], total: 0, page: 1, limit: 25, totalPages: 0, hasNext: false, hasPrevious: false },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) return unauthorizedResponse();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (!body.username || !body.username.trim()) {
    return NextResponse.json(
      { success: false, message: "Username is required." },
      { status: 422 }
    );
  }

  if (!body.password || !body.password.trim()) {
    return NextResponse.json(
      { success: false, message: "Password is required." },
      { status: 422 }
    );
  }

  // Check if username already exists
  const existingUsers = await getAllUsers();
  if (existingUsers.some((u) => u.username.toLowerCase() === body.username.trim().toLowerCase())) {
    return NextResponse.json(
      { success: false, message: "Username already exists." },
      { status: 409 }
    );
  }

  try {
    const doc = {
      username: body.username.trim(),
      password: body.password, // In production, hash this!
      fullName: (body.fullName || "").trim(),
      email: (body.email || "").trim(),
      role: (body.role || "User").trim(),
      active: body.active !== false,
    };

    const newUser = await createUser(doc);

    return NextResponse.json(
      {
        success: true,
        message: "User created successfully.",
        data: newUser,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[users/POST] Error:", error.message);
    return NextResponse.json(
      { success: false, message: "Failed to create user." },
      { status: 500 }
    );
  }
}