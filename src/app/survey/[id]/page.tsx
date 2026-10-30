import React, { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ObjectId } from "mongodb";
import Script from "next/script";
import { getCollection } from "@/lib/mongodb";
import { VoteWizard } from "@/components/vote-wizard";

import { Skeleton } from "@/components/ui/skeleton";
import type {
  SurveyDoc,
  VoteDoc,
  SurveyWithVotes,
  CandidateWithVotes,
} from "@/lib/types";
import type { Metadata } from "next";

export const instant = false;

interface PageProps {
  params: Promise<{ id: string }>;
}

// ─────────────────────────────────────────────────────────
// सर्वर-साइड मेटाडेटा
// ─────────────────────────────────────────────────────────
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;

  // गार्ड: DB तक जाने से पहले ObjectId का आकार जाँचें
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    return {
      title: "सर्वे नहीं मिला",
      description: "जिस सर्वे को आप ढूँढ रहे हैं, वह मौजूद नहीं है।",
    };
  }

  try {
    const surveysCol = await getCollection<SurveyDoc>("surveys");
    const survey = await surveysCol.findOne({ _id: new ObjectId(id) });

    if (!survey) {
      return {
        title: "सर्वे नहीं मिला",
        description: "जिस सर्वे को आप ढूँढ रहे हैं, वह मौजूद नहीं है।",
      };
    }

    const surveyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/survey/${id}`;

    // उम्मीदवारों के नाम जोड़ें ताकि शेयरिंग प्रीव्यू में दिखें
    const candidateLine =
      survey.candidates?.length
        ? `उम्मीदवार: ${survey.candidates.slice(0, 4).map((c) => c.name).join(", ")}।`
        : "";

    const description = `${survey.description ||
      `अपने पसंदीदा उम्मीदवार को वोट दें — ${survey.name}। आपका स्थान सत्यापित किया जाएगा ताकि भागीदारी निष्पक्ष रहे।`
      } ${candidateLine}`.trim();

    return {
      title: `${survey.name} | डिजिटल उड़ान वोटिंग`,
      description,
      keywords: [
        "वोटिंग",
        "सर्वे",
        "चुनाव",
        survey.name,
        "डिजिटल उड़ान",
        ...(survey.candidates?.slice(0, 5).map((c) => c.name) || []),
      ],
      openGraph: {
        title: survey.name,
        description,
        url: surveyUrl,
        siteName: "डिजिटल उड़ान वोटिंग",
        type: "website",
        locale: "hi_IN",
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
        : { index: false, follow: false },
      alternates: {
        canonical: surveyUrl,
      },
    };
  } catch (err) {
    console.error("generateMetadata त्रुटि:", err);
    return {
      title: "वोटिंग सर्वे",
      description: "इस सामुदायिक सर्वे में अपना वोट दर्ज करें।",
    };
  }
}

// ─────────────────────────────────────────────────────────
// डेटा लोडर
// ─────────────────────────────────────────────────────────
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

  // असली वोट्स की गिनती (dummy: true वाले बहिष्कृत)
  const voteAgg = await votesCol
    .aggregate<{ _id: string; count: number }>([
      { $match: { surveyId, dummy: { $ne: true } } },
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

  return (
    <>
      <Script
        id="survey-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Event",
            name: survey.name,
            description: survey.description,
            startDate: survey.createdAt,
            eventStatus: survey.isActive
              ? "https://schema.org/EventScheduled"
              : "https://schema.org/EventCancelled",
            inLanguage: "hi",
          }),
        }}
      />
      <div className="space-y-8">
        <VoteWizard survey={surveyWithVotes} />
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// स्केलेटन (लोडिंग स्थिति)
// ─────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────
// पेज (मुख्य निर्यात)
// ─────────────────────────────────────────────────────────
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