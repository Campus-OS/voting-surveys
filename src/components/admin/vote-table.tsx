"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { RefreshCw, ArrowLeft, ChevronLeft, ChevronRight, Phone, MapPin, Laptop, ExternalLink } from "lucide-react";
import Link from "next/link";

interface VoteRecord {
  _id: string;
  candidateId: string;
  candidateName: string;
  candidateParty: string;
  phone: string;
  location: {
    lat: number;
    lng: number;
  };
  deviceIdMasked: string;
  ip: string;
  createdAt: string;
}

interface VoteTableProps {
  surveyId: string;
  surveyName: string;
}

export function VoteTable({ surveyId, surveyName }: VoteTableProps) {
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalVotes, setTotalVotes] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchVotes = React.useCallback(async (pageNum: number) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/surveys/${surveyId}/votes?page=${pageNum}&limit=20`);
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to load votes");
        return;
      }

      setVotes(data.votes || []);
      setPage(data.pagination.page);
      setTotalPages(data.pagination.totalPages || 1);
      setTotalVotes(data.pagination.total || 0);
    } catch {
      toast.error("Network error fetching votes");
    } finally {
      setIsLoading(false);
    }
  }, [surveyId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/admin/surveys/${surveyId}/votes?page=${page}&limit=20`);
        const data = await res.json();
        if (active && res.ok) {
          setVotes(data.votes || []);
          setTotalPages(data.pagination.totalPages || 1);
          setTotalVotes(data.pagination.total || 0);
        }
      } catch {
        // error handled
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [page, surveyId]);

  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link href={`/admin/surveys/${surveyId}`}>
                <Button variant="ghost" size="sm" className="h-8 px-2 gap-1">
                  <ArrowLeft className="h-4 w-4" /> Back to Survey
                </Button>
              </Link>
              <CardTitle className="text-xl">Audited Cast Ballots</CardTitle>
            </div>
            <CardDescription className="mt-1">
              Recorded votes for &quot;{surveyName}&quot; (Total: {totalVotes} ballots)
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchVotes(page)}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : votes.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 border border-dashed rounded-lg">
            No votes have been cast for this survey yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Candidate</th>
                  <th className="px-4 py-3">Phone Number</th>
                  <th className="px-4 py-3">GPS Coordinates</th>
                  <th className="px-4 py-3">Device / IP</th>
                  <th className="px-4 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-950 font-mono text-xs">
                {votes.map((v) => (
                  <tr key={v._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                    <td className="px-4 py-3 font-sans font-medium text-zinc-900 dark:text-zinc-100">
                      <div>{v.candidateName}</div>
                      <div className="text-[11px] text-zinc-500">{v.candidateParty}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200">
                      <span className="inline-flex items-center gap-1.5 font-sans font-semibold">
                        <Phone className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        {v.phone}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      <a
                        href={`https://www.google.com/maps?q=${v.location?.lat},${v.location?.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-1 hover:text-blue-600 hover:bg-blue-50 transition"
                        title="View GPS Coordinate on Map"
                      >
                        <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span>{v.location?.lat?.toFixed(5)}, {v.location?.lng?.toFixed(5)}</span>
                        <ExternalLink className="h-2.5 w-2.5 ml-0.5 text-zinc-400" />
                      </a>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      <div className="flex items-center gap-1 text-[11px]">
                        <Laptop className="h-3 w-3 text-zinc-500 shrink-0" />
                        <span>{v.deviceIdMasked}</span>
                      </div>
                      <div className="text-[10px] text-zinc-400">{v.ip}</div>
                    </td>
                    <td className="px-4 py-3 font-sans text-zinc-500">
                      {new Date(v.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      {totalPages > 1 && (
        <CardFooter className="flex items-center justify-between border-t pt-4">
          <span className="text-xs text-zinc-500">
            Page {page} of {totalPages} ({totalVotes} total votes)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
