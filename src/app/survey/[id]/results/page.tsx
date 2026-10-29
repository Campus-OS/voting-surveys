import React, { Suspense } from "react";
import { ResultsClient } from "@/components/results-client";
import { Skeleton } from "@/components/ui/skeleton";

export const instant = false;

interface PageProps {
  params: Promise<{ id: string }>;
}

function ResultsSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

export default async function SurveyResultsPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<ResultsSkeleton />}>
      <ResultsClient surveyId={id} />
    </Suspense>
  );
}
