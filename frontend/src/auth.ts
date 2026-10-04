import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import { keycloakConfig } from "@/lib/keycloak";

// Customers sign in through Keycloak (realm "brickart", client "brickart-frontend").
// The session is a signed cookie holding who they are; nothing is stored in the
// database. The id token is kept so "Log out" can end the Keycloak session too.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Keycloak({
      clientId: keycloakConfig.clientId,
      clientSecret: keycloakConfig.clientSecret,
      issuer: keycloakConfig.issuer,
    }),
  ],
  session: { strategy: "jwt" },
  // Both the sign-in entry point and auth errors land on /login, which
  // forwards to Keycloak (or explains what went wrong).
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    jwt({ token, account }) {
      if (account?.id_token) token.idToken = account.id_token;
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.idToken = token.idToken;
      return session;
    },
  },
});
