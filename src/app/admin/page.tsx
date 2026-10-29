import React, { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getCollection } from "@/lib/mongodb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Vote, FileSpreadsheet, Users, ArrowRight, PlusCircle, BarChart3 } from "lucide-react";
import type { SurveyDoc, VoteDoc } from "@/lib/types";

async function DashboardStats() {
  await connection();
  const surveysCol = await getCollection<SurveyDoc>("surveys");
  const votesCol = await getCollection<VoteDoc>("votes");

  const [totalSurveys, totalVotes, allSurveys] = await Promise.all([
    surveysCol.countDocuments(),
    votesCol.countDocuments(),
    surveysCol.find({}).sort({ createdAt: -1 }).limit(5).toArray(),
  ]);

  // Count total candidates across all surveys using aggregation
  const candidateCountAgg = await surveysCol
    .aggregate<{ totalCandidates: number }>([
      { $project: { numCandidates: { $size: { $ifNull: ["$candidates", []] } } } },
      { $group: { _id: null, totalCandidates: { $sum: "$numCandidates" } } },
    ])
    .toArray();

  const totalAllCandidates = candidateCountAgg[0]?.totalCandidates || 0;

  return (
    <div className="space-y-8">
      {/* 3 Stats Cards: total surveys, total candidates, total votes */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Surveys</CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold">{totalSurveys}</div>
            <p className="text-xs text-zinc-500 mt-1">Geofenced ballot perimeters</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registered Candidates</CardTitle>
            <Users className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold">{totalAllCandidates}</div>
            <p className="text-xs text-zinc-500 mt-1">Nominees across all districts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cast Ballots</CardTitle>
            <Vote className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold">{totalVotes}</div>
            <p className="text-xs text-zinc-500 mt-1">Cryptographically audited votes</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Surveys List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Recent Surveys</CardTitle>
            <CardDescription>Latest surveys created in the system</CardDescription>
          </div>
          <Link href="/admin/surveys/new">
            <Button size="sm" className="gap-1.5">
              <PlusCircle className="h-4 w-4" /> Create Survey
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {allSurveys.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-500 border border-dashed rounded-lg">
              No surveys found. Click &quot;Create Survey&quot; to define your first voting perimeter.
            </div>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-lg border">
              {allSurveys.map((survey) => (
                <div
                  key={survey._id.toString()}
                  className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/surveys/${survey._id.toString()}`}
                        className="font-semibold text-zinc-900 dark:text-zinc-100 hover:text-blue-600"
                      >
                        {survey.name}
                      </Link>
                      <Badge variant={survey.isActive ? "success" : "secondary"}>
                        {survey.isActive ? "Active" : "Closed"}
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-500">
                      {(survey.candidates || []).length} Candidates • Created: {new Date(survey.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link href={`/admin/surveys/${survey._id.toString()}/votes`}>
                      <Button variant="outline" size="sm" className="gap-1 text-xs">
                        <BarChart3 className="h-3.5 w-3.5" /> Votes
                      </Button>
                    </Link>
                    <Link href={`/admin/surveys/${survey._id.toString()}`}>
                      <Button variant="ghost" size="sm" className="gap-1 text-xs">
                        Edit <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

export const instant = false;

export default async function AdminDashboardPage() {
  await connection();
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardStats />
    </Suspense>
  );
}
