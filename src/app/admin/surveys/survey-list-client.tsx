"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PlusCircle, Edit3, Trash2, BarChart2, Share2, ExternalLink } from "lucide-react";

interface SurveyItem {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
  totalVotes: number;
  candidateCount: number;
  createdAt: string;
}

export function SurveyListClient({ initialSurveys }: { initialSurveys: SurveyItem[] }) {
  const router = useRouter();
  const [surveys, setSurveys] = useState<SurveyItem[]>(initialSurveys);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string, name: string) => {
    if (
      !confirm(
        `Are you sure you want to permanently delete survey "${name}"?\n\nWARNING: All votes associated with this survey will be atomically cascade deleted!`
      )
    ) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/surveys/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to delete survey");
        return;
      }

      setSurveys((prev) => prev.filter((s) => s._id !== id));
      toast.success(
        `Survey deleted successfully! (${data.deletedVotesCount ?? 0} votes cascaded)`
      );
      router.refresh();
    } catch {
      toast.error("Network error deleting survey");
    } finally {
      setDeletingId(null);
    }
  };

  const handleShare = (id: string) => {
    const url = `${window.location.origin}/survey/${id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      toast.success("Public survey link copied to clipboard!");
    } else {
      toast.info(`Public URL: ${url}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">All Surveys ({surveys.length})</h2>
          <p className="text-xs text-zinc-500">Manage all registered voting boundaries and surveys</p>
        </div>
        <Link href="/admin/surveys/new">
          <Button size="sm" className="gap-1.5">
            <PlusCircle className="h-4 w-4" /> New Survey
          </Button>
        </Link>
      </div>

      {surveys.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-zinc-500">
          No surveys found. Click &quot;New Survey&quot; to configure your first election.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 dark:bg-zinc-800/50 text-xs text-zinc-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3">Survey Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Candidates</th>
                <th className="px-4 py-3">Cast Votes</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {surveys.map((survey) => (
                <tr key={survey._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                  <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                    <Link
                      href={`/admin/surveys/${survey._id}`}
                      className="hover:text-blue-600 transition"
                    >
                      {survey.name}
                    </Link>
                    {survey.description && (
                      <p className="text-xs text-zinc-500 font-normal line-clamp-1">
                        {survey.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={survey.isActive ? "success" : "secondary"}>
                      {survey.isActive ? "Active" : "Closed"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {survey.candidateCount}
                  </td>
                  <td className="px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-200">
                    {survey.totalVotes}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(survey.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleShare(survey._id)}
                        title="Copy Public Survey Link"
                        className="h-8 w-8 p-0"
                      >
                        <Share2 className="h-4 w-4 text-zinc-600" />
                      </Button>
                      <Link href={`/survey/${survey._id}`} target="_blank">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Open Public Voting Wizard"
                          className="h-8 w-8 p-0"
                        >
                          <ExternalLink className="h-4 w-4 text-zinc-600" />
                        </Button>
                      </Link>
                      <Link href={`/admin/surveys/${survey._id}/votes`}>
                        <Button
                          variant="outline"
                          size="sm"
                          title="View Detailed Votes"
                          className="h-8 px-2 text-xs gap-1"
                        >
                          <BarChart2 className="h-3.5 w-3.5 text-blue-600" /> Votes
                        </Button>
                      </Link>
                      <Link href={`/admin/surveys/${survey._id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          title="Edit Survey & Candidates"
                          className="h-8 px-2 text-xs gap-1"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Edit
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(survey._id, survey.name)}
                        isLoading={deletingId === survey._id}
                        title="Delete Survey"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
