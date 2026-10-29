import React, { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { connection } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { SurveyEditor } from "@/components/admin/survey-editor";
import { CandidateManager } from "@/components/admin/candidate-manager";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, BarChart3, ArrowLeft } from "lucide-react";
import type { SurveyDoc } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function SurveyEditLoader({ id }: { id: string }) {
  await connection();
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    notFound();
  }

  const surveysCol = await getCollection<SurveyDoc>("surveys");
  const survey = await surveysCol.findOne({ _id: new ObjectId(id) });

  if (!survey) {
    notFound();
  }

  const serializedSurvey = {
    _id: survey._id.toString(),
    name: survey.name,
    description: survey.description || "",
    isActive: survey.isActive,
    polygon: survey.polygon,
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/admin/surveys">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back to Survey List
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/survey/${id}`} target="_blank">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ExternalLink className="h-4 w-4 text-blue-600" /> Public Vote Wizard
            </Button>
          </Link>
          <Link href={`/admin/surveys/${id}/votes`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <BarChart3 className="h-4 w-4 text-emerald-600" /> Audited Votes
            </Button>
          </Link>
        </div>
      </div>

      <SurveyEditor initialData={serializedSurvey} isNew={false} />

      <CandidateManager
        surveyId={id}
        initialCandidates={survey.candidates || []}
      />
    </div>
  );
}

function EditSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-96 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

export const instant = false;

export default async function AdminSurveyEditPage({ params }: PageProps) {
  await connection();
  const { id } = await params;

  return (
    <Suspense fallback={<EditSkeleton />}>
      <SurveyEditLoader id={id} />
    </Suspense>
  );
}
