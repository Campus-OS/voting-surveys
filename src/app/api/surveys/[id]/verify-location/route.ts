import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getCollection } from "@/lib/mongodb";
import { mongoIdParamSchema } from "@/lib/validators";
import { isPointInPolygon } from "@/lib/geo";
import { extractClientIp, hashIpAddress } from "@/lib/phone";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import type { SurveyDoc } from "@/lib/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const locationSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .strict();

export async function POST(request: Request, context: RouteContext) {
  const resolvedParams = await context.params;
  const paramValidation = mongoIdParamSchema.safeParse(resolvedParams);
  if (!paramValidation.success) {
    return NextResponse.json({ error: "Invalid survey ID" }, { status: 400 });
  }

  const { id } = paramValidation.data;

  // Rate limit: 20 checks / 10 min per IP
  const clientIp = extractClientIp(request);
  const ipHash = hashIpAddress(clientIp);
  const rl = await checkRateLimit(`geo-check:${ipHash}`, 20, 600);
  if (!rl.success) {
    return rateLimitExceededResponse(rl.reset);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validation = locationSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const { lat, lng } = validation.data;

  try {
    const surveysCol = await getCollection<SurveyDoc>("surveys");
    const survey = await surveysCol.findOne({ _id: new ObjectId(id) });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    if (!survey.isActive) {
      return NextResponse.json(
        { error: "Survey is currently inactive" },
        { status: 400 }
      );
    }

    const inside = isPointInPolygon({ lat, lng }, survey.polygon);
    if (!inside) {
      return NextResponse.json(
        { error: "You are outside the allowed voting area" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      valid: true,
      message: "Location verified within eligible voting district",
    });
  } catch (error) {
    logger.error("Error verifying location", error, { surveyId: id });
    return NextResponse.json(
      { error: "Failed to verify location" },
      { status: 500 }
    );
  }
}
