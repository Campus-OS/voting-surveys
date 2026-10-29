"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { UserPlus, Info } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    setIsLoading(true);

    try {
      const result = await signUp.email({
        email: email.trim().toLowerCase(),
        password,
        name: name.trim(),
      });

      if (result.error) {
        toast.error(result.error.message || "Failed to create account");
        return;
      }

      toast.success("Account created successfully! You are signed in.");
      router.push("/admin");
      router.refresh();
    } catch {
      toast.error("An unexpected error occurred during signup");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">Create an Account</CardTitle>
          <CardDescription>
            Register for administrative control or access to voter services
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
            <span>
              <strong>Admin Flow:</strong> New signups receive the default &quot;user&quot; role. To administer surveys, promote your account to &quot;admin&quot; in MongoDB or via the setup script.
            </span>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reg-name">Full Name</Label>
              <Input
                id="reg-name"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-email">Email Address</Label>
              <Input
                id="reg-email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-password">Password</Label>
              <Input
                id="reg-password"
                type="password"
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full" isLoading={isLoading}>
              <UserPlus className="mr-2 h-4 w-4" /> Create Account
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t pt-4 text-xs text-zinc-500">
          Already have an account?{" "}
          <Link href="/login" className="ml-1 font-semibold text-blue-600 hover:underline">
            Sign In
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
