import { NextResponse } from "next/server";
import crypto from "crypto";
import { ObjectId, MongoServerError } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { mongoIdParamSchema, castVoteSchema } from "@/lib/validators";
import { isPointInPolygon } from "@/lib/geo";
import { extractClientIp, hashIpAddress, hashPhoneNumber } from "@/lib/phone";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import type { SurveyDoc, VoteDoc } from "@/lib/types";

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

  // 1. IP extraction & Rate Limiting (5 req / 10 min per IP)
  const clientIp = extractClientIp(request);
  const ipHash = hashIpAddress(clientIp);

  const ipRateLimit = await checkRateLimit(`vote:ip:${ipHash}`, 5, 600);
  if (!ipRateLimit.success) {
    return rateLimitExceededResponse(
      ipRateLimit.reset,
      "Too many voting attempts from this IP address. Please try again later."
    );
  }

  // 2. Validate request body (candidateId, phone, lat, lng, deviceId)
  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  const bodyValidation = castVoteSchema.safeParse(bodyJson);
  if (!bodyValidation.success) {
    return NextResponse.json(
      {
        error: "Validation error",
        details: bodyValidation.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { candidateId, phone, lat, lng, deviceId } = bodyValidation.data;
  const normalizedPhone = phone.trim();
  const phoneHash = hashPhoneNumber(normalizedPhone);
  const deviceHash = crypto.createHash("sha256").update(deviceId.trim()).digest("hex");

  try {
    // 3. Retrieve survey
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
        { error: "This survey is currently closed for voting" },
        { status: 400 }
      );
    }

    // 4. Validate Candidate exists
    const candidateExists = (survey.candidates || []).some((c) => c.id === candidateId);
    if (!candidateExists) {
      return NextResponse.json(
        { error: "Selected candidate does not exist in this survey" },
        { status: 400 }
      );
    }

    // 5. SERVER-SIDE GEOFENCE VERIFICATION (Ray-casting point-in-polygon)
    const isInside = isPointInPolygon({ lat, lng }, survey.polygon);
    if (!isInside) {
      logger.warn("Vote rejected: location outside allowed geofence", {
        surveyId: id,
        coordinates: { lat, lng },
      });
      return NextResponse.json(
        { error: "You are outside the allowed voting area" },
        { status: 403 }
      );
    }

    // 6. Insert vote atomically storing plaintext phone, GPS coordinates, device identifier & hashes
    const votesCol = await getCollection<VoteDoc>("votes");

    const voteRecord: VoteDoc = {
      _id: new ObjectId(),
      surveyId: id,
      candidateId,
      phone: normalizedPhone, // Plaintext phone as requested
      phoneHash,
      location: {
        lat,
        lng, // Plaintext coordinates as requested
      },
      deviceId: deviceId.trim(),
      deviceHash,
      ip: clientIp,
      ipHash,
      createdAt: new Date(),
    };

    await votesCol.insertOne(voteRecord);

    logger.info("Vote successfully recorded", {
      surveyId: id,
      candidateId,
      phoneHash: phoneHash.substring(0, 8),
      deviceHash: deviceHash.substring(0, 8),
    });

    return NextResponse.json({
      success: true,
      message: "Vote recorded successfully",
    });
  } catch (error) {
    // Handle MongoDB duplicate key error (code 11000)
    if (error instanceof MongoServerError && error.code === 11000) {
      const isDeviceDuplicate = error.message.includes("deviceHash");
      const isPhoneDuplicate = error.message.includes("phoneHash");

      logger.warn("Duplicate vote attempt caught by unique index", {
        surveyId: id,
        isDeviceDuplicate,
        isPhoneDuplicate,
      });

      if (isDeviceDuplicate) {
        return NextResponse.json(
          { error: "This device has already been used to cast a vote in this survey." },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          error: isPhoneDuplicate
            ? "A vote has already been cast with this phone number for this survey."
            : "A vote has already been cast from this network/IP address for this survey.",
        },
        { status: 409 }
      );
    }

    logger.error("Error processing vote", error, { surveyId: id });
    return NextResponse.json(
      { error: "An unexpected error occurred while processing your vote" },
      { status: 500 }
    );
  }
}
