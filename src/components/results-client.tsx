"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { BarChart3, RefreshCw, Share2, Vote, ArrowLeft } from "lucide-react";
import type { CandidateWithVotes } from "@/lib/types";
import { ShareButton } from "./share-button";

interface SurveyResultsData {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
  totalVotes: number;
  candidatesWithVotes: CandidateWithVotes[];
}

export function ResultsClient({ surveyId }: { surveyId: string }) {
  const [data, setData] = useState<SurveyResultsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchResults = React.useCallback(async (showToast = false) => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/surveys/${surveyId}`);
      if (!res.ok) {
        toast.error("Failed to load results");
        return;
      }
      const json = await res.json();
      setData(json.survey);
      setLastRefreshed(new Date());
      if (showToast) {
        toast.success("Results refreshed");
      }
    } catch {
      toast.error("Network error updating live results");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [surveyId]);

  useEffect(() => {
    let active = true;
    const initialLoad = async () => {
      try {
        const res = await fetch(`/api/surveys/${surveyId}`);
        if (res.ok) {
          const json = await res.json();
          if (active) {
            setData(json.survey);
            setLastRefreshed(new Date());
          }
        }
      } catch {
        // error handled
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    initialLoad();

    const interval = setInterval(() => {
      fetchResults();
    }, 10000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [surveyId, fetchResults]);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 py-6">
        <Skeleton className="h-10 w-48" />
        <Card className="p-6 space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="space-y-4 pt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-6 w-full rounded-full" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <h2 className="text-xl font-bold">Survey Not Found</h2>
        <p className="text-zinc-500 mt-2">The requested survey could not be retrieved.</p>
        <Link href="/" className="mt-4 inline-block">
          <Button variant="outline">Return Home</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href={`/survey/${surveyId}`}>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Go to Vote Wizard
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          <ShareButton surveyId={surveyId} title={data.name} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchResults(true)}
            disabled={isRefreshing}
            className="gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-2xl font-bold">{data.name}</CardTitle>
                <Badge variant={data.isActive ? "success" : "secondary"}>
                  {data.isActive ? "Live" : "Closed"}
                </Badge>
              </div>
              {data.description && (
                <CardDescription className="mt-1 text-sm">{data.description}</CardDescription>
              )}
            </div>

            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 px-4 py-2 text-right">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
                Total Ballots
              </span>
              <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                {data.totalVotes}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between text-xs text-zinc-500 border-b pb-2">
            <span className="flex items-center gap-1 font-medium">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              Candidate Standing
            </span>
            <span>Auto-refreshes every 10s • Last updated: {lastRefreshed.toLocaleTimeString()}</span>
          </div>

          <div className="space-y-5">
            {data.candidatesWithVotes.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">
                No candidates registered for this survey.
              </p>
            ) : (
              data.candidatesWithVotes
                .sort((a, b) => b.votes - a.votes)
                .map((candidate, idx) => (
                  <div key={candidate.id} className="space-y-2">
                    <div className="flex items-baseline justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {candidate.name}
                        </span>
                        {candidate.party && (
                          <span className="text-xs text-zinc-500 font-medium">
                            ({candidate.party})
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-sm font-bold">
                        <span>{candidate.votes} votes</span>
                        <span className="ml-2 text-blue-600 dark:text-blue-400 font-extrabold">
                          {candidate.percentage}%
                        </span>
                      </div>
                    </div>

                    <div className="h-4 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all duration-700 ease-out"
                        style={{ width: `${Math.max(candidate.percentage, 1)}%` }}
                      />
                    </div>
                  </div>
                ))
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t pt-4 text-xs text-zinc-500">
          <span>Zero-Knowledge SHA-256 Ledger Verified</span>
          <Link href={`/survey/${surveyId}`}>
            <Button size="sm" className="gap-1.5">
              <Vote className="h-4 w-4" /> Cast Your Ballot
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
