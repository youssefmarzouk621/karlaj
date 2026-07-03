import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import { keycloakConfig } from "@/lib/keycloak";
import { extractRealmRoles } from "@/lib/jwt";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Keycloak({
      clientId: keycloakConfig.clientId,
      clientSecret: keycloakConfig.clientSecret,
      issuer: keycloakConfig.issuer,
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, account }) {
      if (account?.access_token) {
        token.roles = extractRealmRoles(account.access_token);
      }
      if (account?.id_token) {
        token.idToken = account.id_token;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.roles = token.roles ?? [];
      session.idToken = token.idToken;
      return session;
    },
  },
});
