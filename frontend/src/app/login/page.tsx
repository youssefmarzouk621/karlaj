"use client";

import Link from "next/link";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black tracking-tight">Welcome back</h1>
          <p className="text-muted mt-2 text-sm">
            Log in to your BrickArt account
          </p>
        </div>

        <form
          onSubmit={(e) => e.preventDefault()}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-muted mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-lg bg-surface border border-border-custom text-text placeholder:text-muted/50 focus:outline-none focus:border-accent transition-colors text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-lg bg-surface border border-border-custom text-text placeholder:text-muted/50 focus:outline-none focus:border-accent transition-colors text-sm"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-accent hover:bg-accent-hover text-white font-medium py-3 rounded-lg transition-colors text-sm"
          >
            Log in
          </button>
        </form>

        <p className="text-center text-muted text-sm mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/create" className="text-accent hover:text-accent-hover font-medium">
            Get started
          </Link>
        </p>
      </div>
    </main>
  );
}
