import React, { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { VoteWizard } from "@/components/vote-wizard";
import { Skeleton } from "@/components/ui/skeleton";
import type { SurveyDoc, VoteDoc, SurveyWithVotes, CandidateWithVotes } from "@/lib/types";
import type { Metadata } from "next";

export const instant = false;

interface PageProps {
  params: Promise<{ id: string }>;
}


// ─────────────────────────────────────────────────────────
// SERVER-SIDE METADATA
// ─────────────────────────────────────────────────────────
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;

  // Guard: valid ObjectId shape before hitting DB
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    return {
      title: "Survey Not Found",
      description: "The survey you are looking for does not exist.",
    };
  }

  try {
    const surveysCol = await getCollection<SurveyDoc>("surveys");
    const survey = await surveysCol.findOne({ _id: new ObjectId(id) });

    if (!survey) {
      return {
        title: "Survey Not Found",
        description: "The survey you are looking for does not exist.",
      };
    }

    const surveyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/survey/${id}`;
    const description =
      survey.description ||
      `Cast your vote for ${survey.name}. Your location is verified to ensure fair participation.`;

    return {
      title: `${survey.name} | Digital Udaan Voting`,
      description,
      keywords: [
        "voting",
        "survey",
        "election",
        survey.name,
        "digital udaan",
        ...(survey.candidates?.slice(0, 5).map((c) => c.name) || []),
      ],
      openGraph: {
        title: survey.name,
        description,
        url: surveyUrl,
        siteName: "Digital Udaan Voting",
        type: "website",
        locale: "en_IN",
        images: [
          {
            url: `${process.env.NEXT_PUBLIC_APP_URL}/api/og?surveyId=${id}`,
            width: 1200,
            height: 630,
            alt: survey.name,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: survey.name,
        description,
        images: [`${process.env.NEXT_PUBLIC_APP_URL}/api/og?surveyId=${id}`],
      },
      robots: survey.isActive
        ? { index: true, follow: true }
        : { index: false, follow: false }, // closed surveys should not be indexed
      alternates: {
        canonical: surveyUrl,
      },
    };
  } catch (err) {
    // Never let metadata failure break the page
    console.error("generateMetadata error:", err);
    return {
      title: "Voting Survey",
      description: "Cast your vote in this community survey.",
    };
  }
}

async function SurveyDataLoader({ surveyId }: { surveyId: string }) {
  await connection();
  if (!/^[0-9a-fA-F]{24}$/.test(surveyId)) {
    notFound();
  }

  const surveysCol = await getCollection<SurveyDoc>("surveys");
  const votesCol = await getCollection<VoteDoc>("votes");

  const survey = await surveysCol.findOne({ _id: new ObjectId(surveyId) });
  if (!survey) {
    notFound();
  }

  const voteAgg = await votesCol
    .aggregate<{ _id: string; count: number }>([
      { $match: { surveyId } },
      { $group: { _id: "$candidateId", count: { $sum: 1 } } },
    ])
    .toArray();

  let totalVotes = 0;
  const countMap = new Map<string, number>();
  for (const v of voteAgg) {
    countMap.set(v._id, v.count);
    totalVotes += v.count;
  }

  const candidatesWithVotes: CandidateWithVotes[] = (survey.candidates || []).map((c) => {
    const votes = countMap.get(c.id) || 0;
    return {
      ...c,
      votes,
      percentage: totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0,
    };
  });

  const surveyWithVotes: SurveyWithVotes = {
    _id: survey._id.toString(),
    name: survey.name,
    description: survey.description,
    polygon: survey.polygon,
    isActive: survey.isActive,
    candidates: survey.candidates || [],
    createdAt: survey.createdAt,
    updatedAt: survey.updatedAt,
    createdBy: survey.createdBy,
    totalVotes,
    candidatesWithVotes,
  };

  return <VoteWizard survey={surveyWithVotes} />;
}

function WizardSkeleton() {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <Skeleton className="h-8 w-full rounded-md" />
      <div className="p-6 border rounded-xl space-y-4">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
        <div className="space-y-3 pt-4">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default async function SurveyVotePage({ params }: PageProps) {
  await connection();
  const { id } = await params;

  return (
    <div className="py-6">
      <Suspense fallback={<WizardSkeleton />}>
        <SurveyDataLoader surveyId={id} />
      </Suspense>
    </div>
  );
}
