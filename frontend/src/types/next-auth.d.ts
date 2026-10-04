import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
    idToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
    idToken?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    sub?: string;
    idToken?: string;
  }
}
