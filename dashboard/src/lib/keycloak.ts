export const keycloakConfig = {
  issuer: process.env.AUTH_KEYCLOAK_ISSUER!,
  clientId: process.env.AUTH_KEYCLOAK_ID!,
  clientSecret: process.env.AUTH_KEYCLOAK_SECRET!,
  adminRole: process.env.KEYCLOAK_ADMIN_ROLE || "brickart-admin",

  get baseUrl() {
    const url = new URL(this.issuer);
    return `${url.protocol}//${url.host}`;
  },

  get realm() {
    return this.issuer.split("/realms/")[1];
  },
};

export function isAdmin(roles: string[] | undefined): boolean {
  return !!roles?.includes(keycloakConfig.adminRole);
}
