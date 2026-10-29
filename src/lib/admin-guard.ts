import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, type User, type Session } from "./auth";
import { logger } from "./logger";

export interface AdminContext {
  user: User;
  session: Session["session"];
}

/**
 * Server-side guard for Server Components and Server Actions.
 * Validates session and ensures the user has the 'admin' role.
 * Redirects to /login if unauthorized or not an admin.
 */
export async function requireAdmin(): Promise<AdminContext> {
  const reqHeaders = await headers();
  const sessionData = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!sessionData || !sessionData.user) {
    logger.info("requireAdmin: Unauthenticated access attempt, redirecting to /login");
    redirect("/login");
  }

  const role = (sessionData.user as { role?: string }).role;
  if (role !== "admin") {
    logger.warn("requireAdmin: User lacks admin role, redirecting to /", {
      userId: sessionData.user.id,
      role,
    });
    redirect("/login?error=Forbidden");
  }

  return {
    user: sessionData.user,
    session: sessionData.session,
  };
}
