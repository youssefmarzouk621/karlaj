export function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) return {};

  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);

  return JSON.parse(json);
}

export function extractRealmRoles(accessToken: string): string[] {
  const payload = decodeJwtPayload(accessToken);
  const realmAccess = payload.realm_access as
    | { roles?: string[] }
    | undefined;
  return realmAccess?.roles ?? [];
}
