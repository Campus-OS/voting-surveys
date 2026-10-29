import { NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import { requireAdminApi } from "@/lib/api-auth";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { createSurveySchema, paginationQuerySchema } from "@/lib/validators";
import { logger } from "@/lib/logger";
import type { SurveyDoc, VoteDoc } from "@/lib/types";

export async function GET(request: Request) {
  const authResult = await requireAdminApi(request);
  if ("response" in authResult) {
    return authResult.response;
  }
  const { user } = authResult;

  // Rate limit: 100 req / 1 min per user
  const rl = await checkRateLimit(`admin:${user.id}`, 100, 60);
  if (!rl.success) {
    return rateLimitExceededResponse(rl.reset);
  }

  const { searchParams } = new URL(request.url);
  const pageParsed = paginationQuerySchema.safeParse({
    page: searchParams.get("page") || 1,
    limit: searchParams.get("limit") || 50,
  });

  const { page, limit } = pageParsed.success ? pageParsed.data : { page: 1, limit: 50 };
  const skip = (page - 1) * limit;

  try {
    const surveysCol = await getCollection<SurveyDoc>("surveys");
    const votesCol = await getCollection<VoteDoc>("votes");

    const total = await surveysCol.countDocuments();
    const surveys = await surveysCol
      .find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Attach total vote count for each survey
    const surveyIds = surveys.map((s) => s._id.toString());
    const voteCounts = await votesCol
      .aggregate<{ _id: string; count: number }>([
        { $match: { surveyId: { $in: surveyIds } } },
        { $group: { _id: "$surveyId", count: { $sum: 1 } } },
      ])
      .toArray();

    const voteCountMap = new Map<string, number>();
    for (const vc of voteCounts) {
      voteCountMap.set(vc._id, vc.count);
    }

    const surveysWithCount = surveys.map((s) => ({
      ...s,
      _id: s._id.toString(),
      totalVotes: voteCountMap.get(s._id.toString()) || 0,
      candidateCount: (s.candidates || []).length,
    }));

    return NextResponse.json({
      surveys: surveysWithCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error("Admin: Error listing surveys", error);
    return NextResponse.json(
      { error: "Failed to fetch surveys" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authResult = await requireAdminApi(request);
  if ("response" in authResult) {
    return authResult.response;
  }
  const { user } = authResult;

  const rl = await checkRateLimit(`admin:${user.id}`, 100, 60);
  if (!rl.success) {
    return rateLimitExceededResponse(rl.reset);
  }

  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = createSurveySchema.safeParse(bodyJson);
  if (!validation.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { name, description, polygon, isActive } = validation.data;

  try {
    const surveysCol = await getCollection<Omit<SurveyDoc, "_id">>("surveys");

    const newSurvey: Omit<SurveyDoc, "_id"> = {
      name,
      description: description || "",
      polygon,
      isActive: isActive ?? true,
      candidates: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: user.id,
    };

    const result = await surveysCol.insertOne(newSurvey as SurveyDoc);

    logger.info("Admin: Created new survey", {
      surveyId: result.insertedId.toString(),
      adminId: user.id,
    });

    return NextResponse.json(
      {
        survey: {
          ...newSurvey,
          _id: result.insertedId.toString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error("Admin: Error creating survey", error);
    return NextResponse.json(
      { error: "Failed to create survey" },
      { status: 500 }
    );
  }
}
