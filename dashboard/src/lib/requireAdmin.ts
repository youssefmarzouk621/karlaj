import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/keycloak";

/**
 * Guard for API route handlers. The middleware only attaches the session — it
 * doesn't reject anonymous requests — so a handler that changes public content
 * must check for the admin role itself, like the dashboard layout does for pages.
 * Returns a 401/403 response to send back, or null when the caller is an admin.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isAdmin(session.user.roles)) {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }
  return null;
}
