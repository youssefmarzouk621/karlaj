"use server";

import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { keycloakConfig } from "@/lib/keycloak";

export async function federatedLogout(): Promise<void> {
  const session = await auth();

  await signOut({ redirect: false });

  const logoutUrl = new URL(
    `${keycloakConfig.issuer}/protocol/openid-connect/logout`
  );
  logoutUrl.searchParams.set("client_id", keycloakConfig.clientId);
  logoutUrl.searchParams.set(
    "post_logout_redirect_uri",
    process.env.AUTH_URL + "/login"
  );
  if (session?.idToken) {
    logoutUrl.searchParams.set("id_token_hint", session.idToken);
  }

  redirect(logoutUrl.toString());
}
