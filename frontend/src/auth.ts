import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import { keycloakConfig } from "@/lib/keycloak";

// The dashboard (port 3002) also runs Auth.js on localhost, and cookies aren't
// scoped by port — with the default names each app would read the other's
// session cookie and fail to decrypt it ("no matching decryption secret").
// So the storefront's cookies get their own names. Auth.js deep-merges these
// with its defaults, so only the names are overridden.
const secure = process.env.AUTH_URL?.startsWith("https://") ?? false;
const prefix = secure ? "__Secure-" : "";
const cookies = {
  sessionToken: { name: `${prefix}brickart.session-token` },
  callbackUrl: { name: `${prefix}brickart.callback-url` },
  csrfToken: { name: `${secure ? "__Host-" : ""}brickart.csrf-token` },
  pkceCodeVerifier: { name: `${prefix}brickart.pkce.code_verifier` },
  state: { name: `${prefix}brickart.state` },
  nonce: { name: `${prefix}brickart.nonce` },
};

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
  // Explicit, so it always agrees with the cookie prefixes above.
  useSecureCookies: secure,
  cookies,
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
