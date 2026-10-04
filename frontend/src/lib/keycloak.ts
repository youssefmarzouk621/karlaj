// Keycloak settings for customer sign-in (see docs/keycloak-auth.md).
export const keycloakConfig = {
  issuer: process.env.AUTH_KEYCLOAK_ISSUER!,
  clientId: process.env.AUTH_KEYCLOAK_ID!,
  clientSecret: process.env.AUTH_KEYCLOAK_SECRET!,
};
