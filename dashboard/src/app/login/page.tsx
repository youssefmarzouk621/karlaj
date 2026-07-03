"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center px-6 min-h-screen bg-bg">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8">
          <span className="inline-block w-12 h-12 rounded-xl bg-accent mb-4" />
          <h1 className="text-2xl font-black tracking-tight text-text">
            BrickArt Dashboard
          </h1>
          <p className="text-muted text-sm mt-2">
            Sign in with your admin account to continue
          </p>
        </div>

        <button
          onClick={() => signIn("keycloak", { callbackUrl: "/dashboard" })}
          className="w-full bg-accent hover:bg-accent-hover text-white font-medium py-3 rounded-lg transition-colors text-sm"
        >
          Sign in with Keycloak
        </button>
      </div>
    </main>
  );
}
