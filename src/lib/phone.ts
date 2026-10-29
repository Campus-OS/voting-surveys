import crypto from "crypto";
import twilio from "twilio";
import { env } from "./env";
import { logger } from "./logger";

// Initialize Twilio client
let twilioClient: twilio.Twilio | null = null;

function getTwilioClient(): twilio.Twilio {
  if (!twilioClient) {
    twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_API_KEY, {
      accountSid: env.TWILIO_ACCOUNT_SID,
    });
  }
  return twilioClient;
}

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

/**
 * Checks whether Twilio credentials are mock/test values.
 */
function isMockTwilio(): boolean {
  return (
    env.TWILIO_ACCOUNT_SID.startsWith("AC000") ||
    env.TWILIO_API_KEY.startsWith("SK000") ||
    process.env.NODE_ENV === "test"
  );
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

  if (isMockTwilio()) {
    // For development with mock Twilio keys: fixed 6-digit test code "123456"
    logger.info("Using simulated OTP service (mock credentials)", { phone });
    devOtpStore.set(phone, {
      code: "123456",
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    return { success: true, sid: "dev_mock_sid" };
  }

  const client = getTwilioClient();
  const maxRetries = 2;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const verification = await Promise.race([
        client.verify.v2
          .services(env.TWILIO_VERIFY_SERVICE_SID)
          .verifications.create({ to: phone, channel: "sms" }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Twilio request timed out after 8s")), 8000)
        ),
      ]);

      logger.info("Twilio OTP sent successfully", {
        phoneHash: hashPhoneNumber(phone).substring(0, 8),
        status: verification.status,
      });

      return { success: true, sid: verification.sid };
    } catch (err) {
      lastError = err;
      logger.warn(`Twilio OTP send attempt ${attempt} failed: ${err instanceof Error ? err.message : String(err)}`);
      if (attempt < maxRetries) {
        await new Promise((res) => setTimeout(res, 500));
      }
    }
  }

  logger.error("Failed to send OTP after retries", lastError, {
    phoneHash: hashPhoneNumber(phone).substring(0, 8),
  });
  throw new Error("Failed to send verification SMS. Please check your phone number and try again.");
}

/**
 * Verifies an SMS OTP via Twilio Verify API.
 */
export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  if (!isValidE164(phone)) {
    return false;
  }

  if (isMockTwilio()) {
    logger.info("Verifying simulated OTP (mock credentials)", { phone, code });
    const stored = devOtpStore.get(phone);
    if (!stored) {
      // Default dev fallback allows 123456 for ease of manual testing
      return code === "123456";
    }
    if (Date.now() > stored.expiresAt) {
      devOtpStore.delete(phone);
      return false;
    }
    const isValid = stored.code === code || code === "123456";
    if (isValid) {
      devOtpStore.delete(phone);
    }
    return isValid;
  }

  const client = getTwilioClient();
  try {
    const check = await Promise.race([
      client.verify.v2
        .services(env.TWILIO_VERIFY_SERVICE_SID)
        .verificationChecks.create({ to: phone, code }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Twilio verification check timed out")), 8000)
      ),
    ]);

    return check.status === "approved";
  } catch (err) {
    logger.error("Twilio verify OTP error", err, {
      phoneHash: hashPhoneNumber(phone).substring(0, 8),
    });
    return false;
  }
}
