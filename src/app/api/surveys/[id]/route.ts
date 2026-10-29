import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { mongoIdParamSchema } from "@/lib/validators";
import { logger } from "@/lib/logger";
import type { SurveyDoc, VoteDoc, CandidateWithVotes } from "@/lib/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: Request,
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

  try {
    const surveysCol = await getCollection<SurveyDoc>("surveys");
    const votesCol = await getCollection<VoteDoc>("votes");

    const survey = await surveysCol.findOne({ _id: new ObjectId(id) });

    if (!survey) {
      return NextResponse.json(
        { error: "Survey not found" },
        { status: 404 }
      );
    }

    // Aggregate votes for this survey
    const votesAggregation = await votesCol
      .aggregate<{ _id: string; count: number }>([
        { $match: { surveyId: id } },
        { $group: { _id: "$candidateId", count: { $sum: 1 } } },
      ])
      .toArray();

    const voteCountMap = new Map<string, number>();
    let totalVotes = 0;

    for (const v of votesAggregation) {
      voteCountMap.set(v._id, v.count);
      totalVotes += v.count;
    }

    const candidatesWithVotes: CandidateWithVotes[] = (survey.candidates || []).map(
      (c) => {
        const votes = voteCountMap.get(c.id) || 0;
        const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
        return {
          ...c,
          votes,
          percentage,
        };
      }
    );

    return NextResponse.json({
      survey: {
        _id: survey._id.toString(),
        name: survey.name,
        description: survey.description || "",
        polygon: survey.polygon,
        isActive: survey.isActive,
        createdAt: survey.createdAt,
        updatedAt: survey.updatedAt,
        totalVotes,
        candidatesWithVotes,
      },
    });
  } catch (error) {
    logger.error("Error fetching survey details", error, { surveyId: id });
    return NextResponse.json(
      { error: "Failed to retrieve survey details" },
      { status: 500 }
    );
  }
}
