import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { requireAdminApi } from "@/lib/api-auth";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { mongoIdParamSchema, updateSurveySchema } from "@/lib/validators";
import { logger } from "@/lib/logger";
import type { SurveyDoc, VoteDoc, CandidateWithVotes } from "@/lib/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const authResult = await requireAdminApi(request);
  if ("response" in authResult) {
    return authResult.response;
  }
  const { user } = authResult;

  const rl = await checkRateLimit(`admin:${user.id}`, 100, 60);
  if (!rl.success) return rateLimitExceededResponse(rl.reset);

  const resolvedParams = await context.params;
  const paramValidation = mongoIdParamSchema.safeParse(resolvedParams);
  if (!paramValidation.success) {
    return NextResponse.json({ error: "Invalid survey ID format" }, { status: 400 });
  }

  const { id } = paramValidation.data;

  try {
    const surveysCol = await getCollection<SurveyDoc>("surveys");
    const votesCol = await getCollection<VoteDoc>("votes");

    const survey = await surveysCol.findOne({ _id: new ObjectId(id) });
    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    const voteCounts = await votesCol
      .aggregate<{ _id: string; count: number }>([
        { $match: { surveyId: id } },
        { $group: { _id: "$candidateId", count: { $sum: 1 } } },
      ])
      .toArray();

    let totalVotes = 0;
    const voteMap = new Map<string, number>();
    for (const vc of voteCounts) {
      voteMap.set(vc._id, vc.count);
      totalVotes += vc.count;
    }

    const candidatesWithVotes: CandidateWithVotes[] = (survey.candidates || []).map((c) => {
      const votes = voteMap.get(c.id) || 0;
      return {
        ...c,
        votes,
        percentage: totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0,
      };
    });

    return NextResponse.json({
      survey: {
        ...survey,
        _id: survey._id.toString(),
        totalVotes,
        candidatesWithVotes,
      },
    });
  } catch (error) {
    logger.error("Admin: Error fetching survey detail", error, { surveyId: id });
    return NextResponse.json({ error: "Failed to fetch survey" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
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

  const validation = updateSurveySchema.safeParse(bodyJson);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const surveysCol = await getCollection<SurveyDoc>("surveys");

    const updateFields: Partial<SurveyDoc> = {
      updatedAt: new Date(),
    };

    if (validation.data.name !== undefined) updateFields.name = validation.data.name;
    if (validation.data.description !== undefined) updateFields.description = validation.data.description;
    if (validation.data.polygon !== undefined) updateFields.polygon = validation.data.polygon;
    if (validation.data.isActive !== undefined) updateFields.isActive = validation.data.isActive;

    const result = await surveysCol.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateFields },
      { returnDocument: "after" }
    );

    if (!result) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    logger.info("Admin: Survey updated", { surveyId: id });

    return NextResponse.json({
      survey: {
        ...result,
        _id: result._id.toString(),
      },
    });
  } catch (error) {
    logger.error("Admin: Error updating survey", error, { surveyId: id });
    return NextResponse.json({ error: "Failed to update survey" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
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

  try {
    const surveysCol = await getCollection<SurveyDoc>("surveys");
    const votesCol = await getCollection<VoteDoc>("votes");

    // Cascading deletion: remove all cast votes belonging to this survey
    const votesDeletion = await votesCol.deleteMany({ surveyId: id });

    // Delete survey document
    const surveyDeletion = await surveysCol.deleteOne({ _id: new ObjectId(id) });

    if (surveyDeletion.deletedCount === 0) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    logger.info("Admin: Survey and cascade votes deleted", {
      surveyId: id,
      deletedVotesCount: votesDeletion.deletedCount,
    });

    return NextResponse.json({
      success: true,
      message: "Survey and all associated votes deleted successfully",
      deletedVotesCount: votesDeletion.deletedCount,
    });
  } catch (error) {
    logger.error("Admin: Error deleting survey", error, { surveyId: id });
    return NextResponse.json({ error: "Failed to delete survey" }, { status: 500 });
  }
}
