import { NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import { requireAdminApi } from "@/lib/api-auth";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { updateCandidateInputSchema } from "@/lib/validators";
import { logger } from "@/lib/logger";
import type { SurveyDoc, VoteDoc } from "@/lib/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  const authResult = await requireAdminApi(request);
  if ("response" in authResult) return authResult.response;
  const { user } = authResult;

  const rl = await checkRateLimit(`admin:${user.id}`, 100, 60);
  if (!rl.success) return rateLimitExceededResponse(rl.reset);

  const resolvedParams = await context.params;
  const candidateId = resolvedParams.id;
  if (!candidateId || typeof candidateId !== "string") {
    return NextResponse.json({ error: "Candidate ID is required" }, { status: 400 });
  }

  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = updateCandidateInputSchema.safeParse(bodyJson);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const surveysCol = await getCollection<SurveyDoc>("surveys");

    const updateFields: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (validation.data.name !== undefined) {
      updateFields["candidates.$.name"] = validation.data.name;
    }
    if (validation.data.party !== undefined) {
      updateFields["candidates.$.party"] = validation.data.party;
    }
    if (validation.data.imageUrl !== undefined) {
      updateFields["candidates.$.imageUrl"] = validation.data.imageUrl;
    }

    const updateResult = await surveysCol.updateOne(
      { "candidates.id": candidateId },
      { $set: updateFields }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    logger.info("Admin: Candidate updated", { candidateId });

    return NextResponse.json({
      success: true,
      message: "Candidate updated successfully",
    });
  } catch (error) {
    logger.error("Admin: Error updating candidate", error, { candidateId });
    return NextResponse.json({ error: "Failed to update candidate" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const authResult = await requireAdminApi(request);
  if ("response" in authResult) return authResult.response;
  const { user } = authResult;

  const rl = await checkRateLimit(`admin:${user.id}`, 100, 60);
  if (!rl.success) return rateLimitExceededResponse(rl.reset);

  const resolvedParams = await context.params;
  const candidateId = resolvedParams.id;
  if (!candidateId || typeof candidateId !== "string") {
    return NextResponse.json({ error: "Candidate ID is required" }, { status: 400 });
  }

  try {
    const surveysCol = await getCollection<SurveyDoc>("surveys");
    const votesCol = await getCollection<VoteDoc>("votes");

    // Remove candidate from survey
    const updateResult = await surveysCol.updateOne(
      { "candidates.id": candidateId },
      {
        $pull: { candidates: { id: candidateId } },
        $set: { updatedAt: new Date() },
      }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    // Cascade delete any votes cast for this candidate
    const voteCascade = await votesCol.deleteMany({ candidateId });

    logger.info("Admin: Candidate and associated votes removed", {
      candidateId,
      deletedVotes: voteCascade.deletedCount,
    });

    return NextResponse.json({
      success: true,
      message: "Candidate removed successfully",
      deletedVotesCount: voteCascade.deletedCount,
    });
  } catch (error) {
    logger.error("Admin: Error deleting candidate", error, { candidateId });
    return NextResponse.json({ error: "Failed to remove candidate" }, { status: 500 });
  }
}
