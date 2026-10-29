import crypto from "crypto";
import { logger } from "./logger";


/**
 * Normalizes and hashes a phone number using SHA-256.
 * Raw phone numbers are NEVER stored in persistent storage.
 */
export function hashPhoneNumber(phone: string): string {
  const normalized = phone.trim();
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Normalizes and hashes an IP address using SHA-256.
 * Raw IP addresses are NEVER stored in persistent storage.
 */
export function hashIpAddress(ip: string): string {
  const normalized = ip.trim();
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Extracts client IP address with priority:
 * 1. cf-connecting-ip (Cloudflare)
 * 2. x-real-ip
 * 3. x-forwarded-for (first IP in chain)
 * 4. fallback: '127.0.0.1'
 */
export function extractClientIp(req: Request): string {
  const headers = req.headers;

  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) {
    return cfIp.trim();
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return "127.0.0.1";
}

/**
 * Validates E.164 phone number format (+ followed by 7 to 15 digits).
 */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone.trim());
}


// In-memory mock store for development/testing when Twilio credentials are mock
const devOtpStore = new Map<string, { code: string; expiresAt: number }>();

/**
 * Sends an SMS OTP via Twilio Verify API (with timeout and retry).
 */
export async function sendOtp(phone: string): Promise<{ success: boolean; sid?: string }> {
  if (!isValidE164(phone)) {
    throw new Error("Invalid phone number. Must be in E.164 format (e.g. +12345678901).");
  }

  
  const maxRetries = 2;
  let lastError: unknown;

  logger.error("Failed to send OTP after retries", lastError, {
    phoneHash: hashPhoneNumber(phone).substring(0, 8),
  });
  throw new Error("Failed to send verification SMS. Please check your phone number and try again.");
}

/**
 * Verifies an SMS OTP via Twilio Verify API.
 */
export async function verifyOtp(phone: string, code: string): Promise<any> {
  if (!isValidE164(phone)) {
    return false;
  }  
}
