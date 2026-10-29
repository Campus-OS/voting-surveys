"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Vote, Shield, LogOut, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";

export function Nav() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Failed to sign out");
    }
  };

  const role = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = role === "admin";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">                
            <a
              href="https://www.digitaludaantechnologies.in/#contact"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 font-bold text-lg text-zinc-900 dark:text-zinc-100 hover:opacity-80 transition-opacity"
            >
              <Vote className="h-6 w-6 text-blue-600" />
              <span>Digital Udaan Technologies</span>
            </a>

            <nav className="hidden md:flex items-center gap-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              <Link
                href="/"
                className="transition hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Surveys
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold transition hover:text-blue-700"
                >
                  <Shield className="h-4 w-4" />
                  Admin Dashboard
                </Link>
              )}
            </nav>
        </div>

        <div className="flex items-center gap-3">
          {isPending ? (
            <div className="h-8 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          ) : session?.user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end text-xs">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {session.user.name || session.user.email}
                </span>
                {isAdmin ? (
                  <Badge variant="default" className="text-[10px] px-1.5 py-0 mt-0.5">
                    Admin
                  </Badge>
                ) : (
                  <span className="text-zinc-500 text-[10px]">Voter</span>
                )}
              </div>

              {isAdmin && (
                <Link href="/admin">
                  <Button variant="outline" size="sm" className="hidden sm:inline-flex">
                    Admin
                  </Button>
                </Link>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-zinc-600 hover:text-red-600"
              >
                <LogOut className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  <LogIn className="h-4 w-4 mr-1.5" />
                  Sign In
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  Register
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
