import React, { Suspense } from "react";
import { connection } from "next/server";
import { getCollection } from "@/lib/mongodb";
import { SurveyListClient } from "./survey-list-client";
import { Skeleton } from "@/components/ui/skeleton";
import type { SurveyDoc, VoteDoc } from "@/lib/types";

async function SurveyListLoader() {
  await connection();
  const surveysCol = await getCollection<SurveyDoc>("surveys");
  const votesCol = await getCollection<VoteDoc>("votes");

  const surveys = await surveysCol.find({}).sort({ createdAt: -1 }).toArray();

  const surveyIds = surveys.map((s) => s._id.toString());
  const voteAgg = await votesCol
    .aggregate<{ _id: string; count: number }>([
      { $match: { surveyId: { $in: surveyIds } } },
      { $group: { _id: "$surveyId", count: { $sum: 1 } } },
    ])
    .toArray();

  const voteCountMap = new Map<string, number>();
  for (const v of voteAgg) {
    voteCountMap.set(v._id, v.count);
  }

  const formattedSurveys = surveys.map((s) => ({
    _id: s._id.toString(),
    name: s.name,
    description: s.description,
    isActive: s.isActive,
    totalVotes: voteCountMap.get(s._id.toString()) || 0,
    candidateCount: (s.candidates || []).length,
    createdAt: s.createdAt.toISOString(),
  }));

  return <SurveyListClient initialSurveys={formattedSurveys} />;
}

function ListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export const instant = false;

export default async function AdminSurveysPage() {
  await connection();
  return (
    <Suspense fallback={<ListSkeleton />}>
      <SurveyListLoader />
    </Suspense>
  );
}
