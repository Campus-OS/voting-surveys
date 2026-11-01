import React, { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getCollection } from "@/lib/mongodb";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Vote, Users, Shield, ArrowRight, BarChart2 } from "lucide-react";
import type { SurveyDoc, VoteDoc } from "@/lib/types";

// Extracted data-fetching component wrapped inside <Suspense>
async function SurveyList() {
  await connection();
  const surveysCol = await getCollection<SurveyDoc>("surveys");
  const votesCol = await getCollection<VoteDoc>("votes");

  const surveys = await surveysCol
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  if (surveys.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 p-12 text-center">
        <Vote className="mx-auto h-12 w-12 text-zinc-400 mb-3" />
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          No Public Surveys Found
        </h3>
        <p className="mt-1 text-sm text-zinc-500 max-w-sm mx-auto">
          There are currently no public surveys to display. Check back soon or contact your local election administrator.
        </p>
      </div>
    );
  }

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

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {surveys.map((survey) => {
        const sid = survey._id.toString();
        const totalVotes = voteCountMap.get(sid) || 0;
        const candidateCount = (survey.candidates || []).length;

        return (
          <Card key={sid} className="flex flex-col justify-between hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-lg font-bold line-clamp-1">
                  {survey.name}
                </CardTitle>
                <Badge variant={survey.isActive ? "success" : "secondary"} className="shrink-0 text-[11px]">
                  {survey.isActive ? "Active" : "Closed"}
                </Badge>
              </div>
              {survey.description && (
                <CardDescription className="line-clamp-2 text-xs mt-1">
                  {survey.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="pb-4">
              <div className="flex items-center justify-between text-xs text-zinc-500 border-t border-b border-zinc-100 dark:border-zinc-800 py-2.5">
                <span className="flex items-center gap-1.5 font-medium">
                  <Users className="h-4 w-4 text-blue-600" />
                  {candidateCount} {candidateCount === 1 ? "Candidate" : "Candidates"}
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-zinc-700 dark:text-zinc-300">
                  <Vote className="h-4 w-4 text-emerald-600" />
                  {totalVotes} {totalVotes === 1 ? "Vote" : "Votes"}
                </span>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2 pt-0">
              <Link href={survey.isActive ? `/survey/${sid}` : `/survey/${sid}/results`} className="flex-1">
                <Button className="w-full text-xs font-semibold gap-1.5" variant={survey.isActive ? "default" : "outline"}>
                  {survey.isActive ? "Vote Now" : "View Results"}
                  {survey.isActive && <ArrowRight className="h-3.5 w-3.5" />}
                </Button>
              </Link>
              {survey.isActive && (
                <Link href={`/survey/${sid}/results`}>
                  <Button variant="outline" size="icon" title="View Live Results">
                    <BarChart2 className="h-4 w-4 text-zinc-600" />
                  </Button>
                </Link>
              )}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}

function SurveyListSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="flex flex-col justify-between p-6 space-y-4">
          <div className="flex justify-between items-start">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-10 w-full" />
          <div className="flex justify-between py-2 border-y">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-10" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export const instant = false;

export default async function HomePage() {
  await connection();
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Hero Header */}
      <div className="text-center space-y-3 py-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-2">
          <Shield className="h-3.5 w-3.5" /> Verified Geofenced Surveys
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-zinc-900 dark:text-zinc-50">
          Decentralized Local Democracy
        </h1>
        <p className="text-base text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
          Cast your verified ballot with GPS geofence auditing and device-hash protection. One device, one vote.
        </p>
      </div>

      {/* Active Surveys Streamed in Suspense */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Public Surveys in Your Area
          </h2>
        </div>

        <Suspense fallback={<SurveyListSkeleton />}>
          <SurveyList />
        </Suspense>
      </section>
    </div>
  );
}
