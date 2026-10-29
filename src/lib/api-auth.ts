import { NextResponse } from "next/server";
import { auth, type User, type Session } from "./auth";
import { logger } from "./logger";

export type AdminAuthSuccess = {
  user: User;
  session: Session["session"];
};

export type AdminAuthResult =
  | AdminAuthSuccess
  | { response: NextResponse };

/**
 * Validates that the incoming API request has an active session with 'admin' role.
 * If unauthorized or forbidden, returns a Next response with appropriate status code (401 or 403).
 */
export async function requireAdminApi(req: Request): Promise<AdminAuthResult> {
  try {
    const sessionData = await auth.api.getSession({
      headers: req.headers,
    });

    if (!sessionData || !sessionData.user) {
      return {
        response: NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        ),
      };
    }

    const role = (sessionData.user as { role?: string }).role;
    if (role !== "admin") {
      logger.warn("Access denied: user is not an admin", {
        userId: sessionData.user.id,
        role,
      });
      return {
        response: NextResponse.json(
          { error: "Forbidden: Admin privileges required" },
          { status: 403 }
        ),
      };
    }

    return {
      user: sessionData.user,
      session: sessionData.session,
    };
  } catch (error) {
    logger.error("requireAdminApi unexpected error", error);
    return {
      response: NextResponse.json(
        { error: "Internal server error during authorization" },
        { status: 500 }
      ),
    };
  }
}
