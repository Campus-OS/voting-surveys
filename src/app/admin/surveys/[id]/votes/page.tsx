import React, { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { VoteTable } from "@/components/admin/vote-table";
import { Skeleton } from "@/components/ui/skeleton";
import type { SurveyDoc } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function SurveyVoteLoader({ id }: { id: string }) {
  await connection();
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    notFound();
  }

  const surveysCol = await getCollection<SurveyDoc>("surveys");
  const survey = await surveysCol.findOne({ _id: new ObjectId(id) });

  if (!survey) {
    notFound();
  }

  return <VoteTable surveyId={id} surveyName={survey.name} />;
}

function TableSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

export const instant = false;

export default async function AdminSurveyVotesPage({ params }: PageProps) {
  await connection();
  const { id } = await params;

  return (
    <Suspense fallback={<TableSkeleton />}>
      <SurveyVoteLoader id={id} />
    </Suspense>
  );
}
