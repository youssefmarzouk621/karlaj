"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";

/**
 * Login and sign-up live on Keycloak's pages, so this route just hands the
 * visitor over. If Keycloak reported a problem we stop and explain instead of
 * bouncing them straight back into the same error.
 */
export default function SignInRedirect({
  callbackUrl,
  register,
  failed,
}: {
  callbackUrl: string;
  register: boolean;
  failed: boolean;
}) {
  const started = useRef(false);

  const go = () =>
    signIn("keycloak", { callbackUrl }, register ? { prompt: "create" } : undefined);

  useEffect(() => {
    if (failed || started.current) return;
    started.current = true;
    void go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="flex-1 grid place-items-center px-4 py-24">
      <div className="max-w-md text-center flex flex-col items-center gap-5">
        {failed ? (
          <>
            <h1 className="font-display font-normal text-5xl leading-none tracking-[-0.03em]">
              We couldn&apos;t sign you in
            </h1>
            <p className="text-base leading-relaxed text-ink-2">
              Something went wrong while talking to the sign-in service. Please try again.
            </p>
          </>
        ) : (
          <>
            <span className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" aria-hidden />
            <h1 className="font-display font-normal text-5xl leading-none tracking-[-0.03em]">
              Taking you to sign in…
            </h1>
            <p className="text-base leading-relaxed text-ink-2">Not redirected? Use the button below.</p>
          </>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => void go()}
            className="h-12 px-6 rounded-full bg-accent hover:bg-accent-hover text-on-accent font-semibold transition-colors"
          >
            {register ? "Create account" : "Continue to sign in"}
          </button>
          <Link
            href="/"
            className="h-12 px-6 rounded-full border border-line-strong bg-surface text-ink font-medium inline-flex items-center hover:bg-surface-2 transition-colors"
          >
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
