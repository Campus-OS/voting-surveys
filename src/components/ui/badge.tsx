import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "border-transparent bg-blue-600 text-white shadow hover:bg-blue-700",
    secondary: "border-transparent bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100",
    destructive: "border-transparent bg-red-600 text-white shadow hover:bg-red-700",
    outline: "text-zinc-950 dark:text-zinc-50 border-zinc-300 dark:border-zinc-700",
    success: "border-transparent bg-emerald-600 text-white shadow hover:bg-emerald-700",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
