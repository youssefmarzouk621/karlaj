"use server";

import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { keycloakConfig } from "@/lib/keycloak";

/** Ends the local session and the Keycloak one, then returns to the homepage. */
export async function federatedLogout(): Promise<void> {
  const session = await auth();
  await signOut({ redirect: false });

  const url = new URL(`${keycloakConfig.issuer}/protocol/openid-connect/logout`);
  url.searchParams.set("client_id", keycloakConfig.clientId);
  url.searchParams.set("post_logout_redirect_uri", `${process.env.AUTH_URL}/`);
  if (session?.idToken) url.searchParams.set("id_token_hint", session.idToken);
  redirect(url.toString());
}
