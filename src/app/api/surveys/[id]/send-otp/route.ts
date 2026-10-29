import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { mongoIdParamSchema, sendOtpSchema } from "@/lib/validators";
import { extractClientIp, hashIpAddress, hashPhoneNumber, sendOtp } from "@/lib/phone";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import type { SurveyDoc } from "@/lib/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  const resolvedParams = await context.params;
  const paramValidation = mongoIdParamSchema.safeParse(resolvedParams);

  if (!paramValidation.success) {
    return NextResponse.json(
      { error: "Invalid survey ID format" },
      { status: 400 }
    );
  }

  const { id } = paramValidation.data;

  // 1. IP extraction & IP rate limit (10 req / 10 min)
  const clientIp = extractClientIp(request);
  const ipHash = hashIpAddress(clientIp);

  const ipRateLimit = await checkRateLimit(`send-otp:ip:${ipHash}`, 10, 600);
  if (!ipRateLimit.success) {
    return rateLimitExceededResponse(
      ipRateLimit.reset,
      "Too many OTP requests from this IP address. Please try again later."
    );
  }

  // 2. Parse & validate request body
  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  const bodyValidation = sendOtpSchema.safeParse(bodyJson);
  if (!bodyValidation.success) {
    return NextResponse.json(
      {
        error: "Validation error",
        details: bodyValidation.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { phone } = bodyValidation.data;
  const phoneHash = hashPhoneNumber(phone);

  // 3. Phone rate limit (3 req / 10 min)
  const phoneRateLimit = await checkRateLimit(`send-otp:phone:${phoneHash}`, 3, 600);
  if (!phoneRateLimit.success) {
    return rateLimitExceededResponse(
      phoneRateLimit.reset,
      "Too many OTP requests for this phone number. Please try again later."
    );
  }

  try {
    // 4. Verify survey exists and is active
    const surveysCol = await getCollection<SurveyDoc>("surveys");
    const survey = await surveysCol.findOne({ _id: new ObjectId(id) });

    if (!survey) {
      return NextResponse.json(
        { error: "Survey not found" },
        { status: 404 }
      );
    }

    if (!survey.isActive) {
      return NextResponse.json(
        { error: "This survey is currently inactive and not accepting votes." },
        { status: 400 }
      );
    }

    // 5. Send OTP via Twilio Verify
    await sendOtp(phone);

    return NextResponse.json({
      success: true,
      message: "Verification code sent successfully",
    });
  } catch (error) {
    logger.error("Error sending survey OTP", error, {
      surveyId: id,
      phoneHash: phoneHash.substring(0, 8),
    });

    const errorMessage =
      error instanceof Error ? error.message : "Failed to send verification SMS";

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
