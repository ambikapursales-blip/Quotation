import { NextResponse } from "next/server";
import { getUserById, updateUserById, deleteUserById } from "@/lib/services/mongodbService";
import { getSessionUser, unauthorizedResponse } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { success: false, message: "User ID is required." },
        { status: 400 }
      );
    }

    const user = await getUserById(id);

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("[users/[id]] Error:", error.message);
    return NextResponse.json(
      { success: false, message: "Failed to fetch user." },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
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

  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { success: false, message: "User ID is required." },
        { status: 400 }
      );
    }

    // Prevent username change if it would cause a conflict
    if (body.username) {
      const existingUser = await getUserById(id);
      if (!existingUser) {
        return NextResponse.json(
          { success: false, message: "User not found." },
          { status: 404 }
        );
      }
      if (body.username.toLowerCase() !== existingUser.username.toLowerCase()) {
        // Check if new username already exists
        const { getAllUsers } = await import("@/lib/services/mongodbService");
        const allUsers = await getAllUsers();
        if (allUsers.some((u) => u.username.toLowerCase() === body.username.trim().toLowerCase() && u._id !== id)) {
          return NextResponse.json(
            { success: false, message: "Username already exists." },
            { status: 409 }
          );
        }
      }
    }

    const update = {};
    const fields = [
      "username",
      "password",
      "fullName",
      "email",
      "role",
      "active",
    ];
    for (const f of fields) {
      if (body[f] !== undefined) {
        if (typeof body[f] === "string") {
          update[f] = body[f].trim();
        } else {
          update[f] = body[f];
        }
      }
    }

    if (update.username !== undefined && !update.username) {
      return NextResponse.json(
        { success: false, message: "Username is required." },
        { status: 422 }
      );
    }

    const updatedUser = await updateUserById(id, update);

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, message: "User not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "User updated successfully.",
      data: updatedUser,
    });
  } catch (error) {
    console.error("[users/PUT] Error:", error.message);
    return NextResponse.json(
      { success: false, message: "Failed to update user." },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  const user = await getSessionUser();
  if (!user) return unauthorizedResponse();

  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { success: false, message: "User ID is required." },
        { status: 400 }
      );
    }

    const existing = await getUserById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "User not found." },
        { status: 404 }
      );
    }

    await deleteUserById(id);

    return NextResponse.json({
      success: true,
      message: "User deleted successfully.",
    });
  } catch (error) {
    console.error("[users/DELETE] Error:", error.message);
    return NextResponse.json(
      { success: false, message: "Failed to delete user." },
      { status: 500 }
    );
  }
}