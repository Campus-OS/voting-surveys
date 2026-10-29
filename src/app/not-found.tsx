import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4 dark:bg-red-950/50 dark:text-red-400">
        <AlertCircle className="h-8 w-8" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
        Page Not Found
      </h1>
      <p className="mt-2 text-base text-zinc-500 max-w-md">
        The survey or page you requested could not be located or may have been archived.
      </p>
      <div className="mt-6">
        <Link href="/">
          <Button className="gap-2">
            <Home className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
