import { auth } from "@/auth";
import { keycloakConfig } from "@/lib/keycloak";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  const idToken = session?.idToken;

  // Clear Auth.js session cookies
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (
      cookie.name.startsWith("authjs.") ||
      cookie.name.startsWith("__Secure-authjs.")
    ) {
      cookieStore.delete(cookie.name);
    }
  }

  const logoutUrl = new URL(
    `${keycloakConfig.issuer}/protocol/openid-connect/logout`
  );

  if (idToken) {
    logoutUrl.searchParams.set("id_token_hint", idToken);
  }

  // Always pass client_id so Keycloak can end the session even without id_token_hint
  logoutUrl.searchParams.set("client_id", keycloakConfig.clientId);
  logoutUrl.searchParams.set(
    "post_logout_redirect_uri",
    process.env.AUTH_URL + "/login"
  );

  return NextResponse.redirect(logoutUrl.toString());
}
