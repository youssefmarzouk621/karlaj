import { auth } from "@/auth";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight mb-1">Dashboard</h1>
      <p className="text-muted text-sm mb-8">
        Welcome back, {session?.user?.name || session?.user?.email || "Admin"}
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          href="/dashboard/content"
          className="bg-surface border border-border-custom rounded-xl p-6 hover:border-accent/30 transition-colors group"
        >
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent mb-4 group-hover:bg-accent group-hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h2 className="font-bold mb-1">Landing Page Content</h2>
          <p className="text-muted text-sm">
            Edit hero text, features, and gallery examples
          </p>
        </Link>

        <Link
          href="/dashboard/pricing"
          className="bg-surface border border-border-custom rounded-xl p-6 hover:border-accent/30 transition-colors group"
        >
          <div className="w-10 h-10 rounded-lg bg-highlight/10 flex items-center justify-center text-highlight mb-4 group-hover:bg-highlight group-hover:text-bg transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="font-bold mb-1">Pricing Plans</h2>
          <p className="text-muted text-sm">
            Manage pricing tiers, features, and visibility
          </p>
        </Link>
      </div>
    </div>
  );
}
