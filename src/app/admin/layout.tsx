import React from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-guard";
import { LayoutDashboard, FileSpreadsheet, PlusCircle } from "lucide-react";

// For authenticated admin routes reading request headers / session
export const instant = false;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Layer 2 Guard: Cryptographically check session & admin role on the server
  const adminContext = await requireAdmin();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Election Administration
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Signed in as <span className="font-semibold text-zinc-800 dark:text-zinc-200">{adminContext.user.email}</span> (Administrator)
          </p>
        </div>

        <nav className="flex items-center gap-2 text-sm font-medium">
          <Link
            href="/admin"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <LayoutDashboard className="h-4 w-4 text-blue-600" />
            Dashboard
          </Link>
          <Link
            href="/admin/surveys"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <FileSpreadsheet className="h-4 w-4 text-zinc-600" />
            Surveys
          </Link>
          <Link
            href="/admin/surveys/new"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            <PlusCircle className="h-4 w-4" />
            New Survey
          </Link>
        </nav>
      </div>

      <div>{children}</div>
    </div>
  );
}
