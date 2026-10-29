import { NextResponse } from "next/server";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { requireAdminApi } from "@/lib/api-auth";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { mongoIdParamSchema, candidateInputSchema } from "@/lib/validators";
import { logger } from "@/lib/logger";
import type { SurveyDoc, CandidateDoc } from "@/lib/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const authResult = await requireAdminApi(request);
  if ("response" in authResult) return authResult.response;
  const { user } = authResult;

  const rl = await checkRateLimit(`admin:${user.id}`, 100, 60);
  if (!rl.success) return rateLimitExceededResponse(rl.reset);

  const resolvedParams = await context.params;
  const paramValidation = mongoIdParamSchema.safeParse(resolvedParams);
  if (!paramValidation.success) {
    return NextResponse.json({ error: "Invalid survey ID format" }, { status: 400 });
  }

  const { id } = paramValidation.data;

  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = candidateInputSchema.safeParse(bodyJson);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, party, imageUrl } = validation.data;

  try {
    const surveysCol = await getCollection<SurveyDoc>("surveys");
    const survey = await surveysCol.findOne({ _id: new ObjectId(id) });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    if ((survey.candidates || []).length >= 50) {
      return NextResponse.json(
        { error: "Survey cannot exceed 50 candidates" },
        { status: 400 }
      );
    }

    const newCandidate: CandidateDoc = {
      id: crypto.randomUUID(),
      name,
      party: party || undefined,
      imageUrl: imageUrl || undefined,
    };

    await surveysCol.updateOne(
      { _id: new ObjectId(id) },
      {
        $push: { candidates: newCandidate },
        $set: { updatedAt: new Date() },
      }
    );

    logger.info("Admin: Candidate added", {
      surveyId: id,
      candidateId: newCandidate.id,
      candidateName: newCandidate.name,
    });

    return NextResponse.json({ candidate: newCandidate }, { status: 201 });
  } catch (error) {
    logger.error("Admin: Error adding candidate", error, { surveyId: id });
    return NextResponse.json({ error: "Failed to add candidate" }, { status: 500 });
  }
}
