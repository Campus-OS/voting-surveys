import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { requireAdminApi } from "@/lib/api-auth";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { mongoIdParamSchema, paginationQuerySchema } from "@/lib/validators";
import { logger } from "@/lib/logger";
import type { SurveyDoc, VoteDoc } from "@/lib/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
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

  const { searchParams } = new URL(request.url);
  const pageParsed = paginationQuerySchema.safeParse({
    page: searchParams.get("page") || 1,
    limit: searchParams.get("limit") || 25,
  });

  const { page, limit } = pageParsed.success ? pageParsed.data : { page: 1, limit: 25 };
  const skip = (page - 1) * limit;

  try {
    const surveysCol = await getCollection<SurveyDoc>("surveys");
    const votesCol = await getCollection<VoteDoc>("votes");

    const survey = await surveysCol.findOne({ _id: new ObjectId(id) });
    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    const candidateMap = new Map<string, { name: string; party?: string }>();
    for (const c of survey.candidates || []) {
      candidateMap.set(c.id, { name: c.name, party: c.party });
    }

    const totalVotes = await votesCol.countDocuments({ surveyId: id });
    const votes = await votesCol
      .find({ surveyId: id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const formattedVotes = votes.map((v) => {
      const cand = candidateMap.get(v.candidateId);
      return {
        _id: v._id.toString(),
        candidateId: v.candidateId,
        candidateName: cand ? cand.name : "Unknown / Deleted Candidate",
        candidateParty: cand?.party || "Independent",
        phone: v.phone || "N/A", // Plaintext phone
        location: v.location || { lat: 0, lng: 0 }, // Plaintext coordinates
        deviceIdMasked: v.deviceId ? `${v.deviceId.substring(0, 8)}...` : "N/A",
        ip: v.ip || "127.0.0.1",
        createdAt: v.createdAt,
      };
    });

    return NextResponse.json({
      surveyName: survey.name,
      votes: formattedVotes,
      pagination: {
        page,
        limit,
        total: totalVotes,
        totalPages: Math.ceil(totalVotes / limit),
      },
    });
  } catch (error) {
    logger.error("Admin: Error fetching survey votes", error, { surveyId: id });
    return NextResponse.json({ error: "Failed to fetch votes" }, { status: 500 });
  }
}
