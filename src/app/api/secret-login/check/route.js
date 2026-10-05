import { NextResponse } from "next/server";

/**
 * GET /api/secret-login/check
 * 
 * Checks if the secret login feature is enabled.
 * Returns { enabled: true/false }
 * 
 * This endpoint is public and used by the client to determine
 * if the secret login page should be accessible.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const enabled = process.env.ENABLE_SECRET_LOGIN === "true" && 
                  process.env.SECRET_LOGIN_KEY && 
                  process.env.SECRET_LOGIN_KEY.length > 0;

  return NextResponse.json({ 
    success: true, 
    enabled 
  });
}