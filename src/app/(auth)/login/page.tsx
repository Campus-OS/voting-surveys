"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { LogIn, ShieldAlert } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin";
  const forbiddenError = searchParams.get("error") === "Forbidden";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signIn.email({
        email: email.trim().toLowerCase(),
        password,
      });

      if (result.error) {
        toast.error(result.error.message || "Invalid email or password");
        return;
      }

      toast.success("Signed in successfully");
      router.push(callbackUrl);
      router.refresh();
    } catch {
      toast.error("An error occurred during authentication");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight">Sign In</CardTitle>
        <CardDescription>
          Enter your credentials to access your administrative dashboard or voter account
        </CardDescription>
      </CardHeader>
      <CardContent>
        {forbiddenError && (
          <div
            role="alert"
            className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
          >
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>Admin access required. Please sign in with an administrator account.</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email">Email Address</Label>
            <Input
              id="login-email"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="login-password">Password</Label>
            </div>
            <Input
              id="login-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" isLoading={isLoading}>
            <LogIn className="mr-2 h-4 w-4" /> Sign In
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center border-t pt-4 text-xs text-zinc-500">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="ml-1 font-semibold text-blue-600 hover:underline">
          Register here
        </Link>
      </CardFooter>
    </Card>
  );
}

function LoginSkeleton() {
  return (
    <Card className="w-full max-w-md shadow-lg p-6 space-y-4">
      <Skeleton className="h-8 w-1/2 mx-auto" />
      <Skeleton className="h-4 w-3/4 mx-auto" />
      <div className="space-y-3 pt-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <Suspense fallback={<LoginSkeleton />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
