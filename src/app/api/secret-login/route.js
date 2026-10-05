import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { UserModel } from "@/lib/models/User";

/**
 * POST /api/secret-login
 * 
 * Creates an authenticated session using a secret key.
 * Only works when ENABLE_SECRET_LOGIN=true and SECRET_LOGIN_KEY is configured.
 * 
 * Body:
 * - secretKey: The configured SECRET_LOGIN_KEY
 * - userId (optional): MongoDB _id of the user to log in as
 * 
 * On success, sets the auth cookie and returns user info.
 */
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0, must-revalidate" };

function getString(value) {
  return typeof value === "string" ? value : "";
}

export async function POST(request) {
  // Check if feature is enabled
  const enabled = process.env.ENABLE_SECRET_LOGIN === "true" && 
                  process.env.SECRET_LOGIN_KEY && 
                  process.env.SECRET_LOGIN_KEY.length > 0;

  if (!enabled) {
    return NextResponse.json(
      { success: false, message: "Secret login is not enabled" },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Request body must be valid JSON." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const secretKey = getString(body?.secretKey).trim();
  const userId = getString(body?.userId).trim();

  // Verify secret key
  if (secretKey !== process.env.SECRET_LOGIN_KEY) {
    // Generic error - don't reveal whether key was wrong
    return NextResponse.json(
      { success: false, message: "Invalid credentials" },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  // Find the user to log in as
  let user = null;

  if (userId) {
    // Try to find user by ID
    user = await UserModel.getById(userId);
  }

  if (!user) {
    // Fall back to first active user
    user = await UserModel.getFirstActive();
  }

  if (!user) {
    return NextResponse.json(
      { success: false, message: "No active user found" },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  if (!user.active) {
    return NextResponse.json(
      { success: false, message: "Selected user is not active" },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  // Create session token
  const token = createSessionToken({ username: user.username, active: true });

  const response = NextResponse.json(
    {
      success: true,
      message: "Secret login successful",
      user: { username: user.username, active: true },
    },
    { headers: NO_STORE_HEADERS }
  );

  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());

  return response;
}