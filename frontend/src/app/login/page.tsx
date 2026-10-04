import { redirect } from "next/navigation";
import { auth } from "@/auth";
import SignInRedirect from "./SignInRedirect";

// Only allow same-site relative paths as a post-login destination.
function safePath(p: string | undefined): string {
  return p && p.startsWith("/") && !p.startsWith("//") ? p : "/";
}

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; register?: string; error?: string }>;
}) {
  const { callbackUrl, register, error } = await searchParams;
  const next = safePath(callbackUrl);

  if (await auth()) redirect(next);

  return <SignInRedirect callbackUrl={next} register={register === "1"} failed={!!error} />;
}
