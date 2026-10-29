import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { env } from "./env";
import { logger } from "./logger";

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in seconds when the window resets
}

// In-memory sliding window fallback store
interface MemoryRecord {
  timestamps: number[];
}
const memoryStore = new Map<string, MemoryRecord>();

// Periodic memory store cleanup every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of memoryStore.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < 600000);
      if (record.timestamps.length === 0) {
        memoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref?.();
}

let redisClient: Redis | null = null;
if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    redisClient = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
    logger.info("Upstash Redis rate limiter initialized");
  } catch (err) {
    logger.warn("Failed to initialize Upstash Redis, defaulting to in-memory fallback", {
      error: err instanceof Error ? err.message : String(err),
    });
    redisClient = null;
  }
}

/**
 * Checks rate limit for a specific identifier and action.
 *
 * @param identifier Unique key (e.g., ipHash, phoneHash, userId)
 * @param maxRequests Maximum requests allowed within window
 * @param windowSeconds Window length in seconds (e.g. 600 for 10 min, 60 for 1 min)
 */
export async function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  if (redisClient) {
    try {
      const ratelimit = new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
        prefix: "voter:ratelimit",
      });

      const res = await ratelimit.limit(identifier);
      return {
        success: res.success,
        limit: res.limit,
        remaining: res.remaining,
        reset: Math.ceil(res.reset / 1000),
      };
    } catch (err) {
      logger.warn("Upstash Redis error during rate limit check, using in-memory fallback", {
        error: err instanceof Error ? err.message : String(err),
      });
      // Fall through to in-memory fallback
    }
  }

  // In-Memory sliding window implementation
  let record = memoryStore.get(identifier);
  if (!record) {
    record = { timestamps: [] };
    memoryStore.set(identifier, record);
  }

  // Filter timestamps to current window
  const windowStart = now - windowMs;
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (record.timestamps.length >= maxRequests) {
    const oldest = record.timestamps[0] || now;
    const resetTimeSeconds = Math.ceil((oldest + windowMs) / 1000);
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      reset: resetTimeSeconds,
    };
  }

  record.timestamps.push(now);
  const remaining = maxRequests - record.timestamps.length;
  const resetTimeSeconds = Math.ceil((now + windowMs) / 1000);

  return {
    success: true,
    limit: maxRequests,
    remaining,
    reset: resetTimeSeconds,
  };
}

/**
 * Returns a 429 Too Many Requests response with standard Retry-After header.
 */
export function rateLimitExceededResponse(
  resetEpochSeconds: number,
  customMessage?: string
): NextResponse {
  const nowSeconds = Math.ceil(Date.now() / 1000);
  const retryAfter = Math.max(1, resetEpochSeconds - nowSeconds);

  return NextResponse.json(
    {
      error: customMessage || "Rate limit exceeded. Please try again later.",
      retryAfter,
    },
    {
      status: 429,
      headers: {
        "Retry-After": retryAfter.toString(),
        "X-RateLimit-Reset": resetEpochSeconds.toString(),
      },
    }
  );
}
