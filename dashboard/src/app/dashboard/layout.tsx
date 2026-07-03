import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/keycloak";
import Sidebar from "@/components/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (!isAdmin(session.user.roles)) {
    return (
      <main className="flex-1 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted">
            You need the <code className="text-accent">brickart-admin</code>{" "}
            role to access this dashboard.
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-60 p-8">{children}</main>
    </div>
  );
}
