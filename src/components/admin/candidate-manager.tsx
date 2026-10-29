"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { UserPlus, Trash2, Edit2, Check, X } from "lucide-react";
import type { CandidateDoc } from "@/lib/types";

interface CandidateManagerProps {
  surveyId: string;
  initialCandidates: CandidateDoc[];
}

export function CandidateManager({
  surveyId,
  initialCandidates,
}: CandidateManagerProps) {
  const router = useRouter();
  const [candidates, setCandidates] = useState<CandidateDoc[]>(initialCandidates);

  // New Candidate Form State
  const [name, setName] = useState("");
  const [party, setParty] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editParty, setEditParty] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Candidate name is required");
      return;
    }

    if (candidates.length >= 50) {
      toast.error("Maximum 50 candidates allowed per survey");
      return;
    }

    setIsAdding(true);
    try {
      const res = await fetch(`/api/admin/surveys/${surveyId}/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          party: party.trim() || undefined,
          imageUrl: imageUrl.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to add candidate");
        return;
      }

      setCandidates((prev) => [...prev, data.candidate]);
      setName("");
      setParty("");
      setImageUrl("");
      toast.success("Candidate added successfully");
      router.refresh();
    } catch {
      toast.error("Network error adding candidate");
    } finally {
      setIsAdding(false);
    }
  };

  const startEdit = (c: CandidateDoc) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditParty(c.party || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditParty("");
  };

  const handleSaveEdit = async (candidateId: string) => {
    if (!editName.trim()) {
      toast.error("Candidate name cannot be empty");
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/candidates/${candidateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          party: editParty.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to update candidate");
        return;
      }

      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidateId ? { ...c, name: editName.trim(), party: editParty.trim() || undefined } : c
        )
      );
      cancelEdit();
      toast.success("Candidate updated");
      router.refresh();
    } catch {
      toast.error("Network error updating candidate");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteCandidate = async (candidateId: string, candName: string) => {
    if (!confirm(`Are you sure you want to remove candidate "${candName}"? Any votes cast for this candidate will also be deleted.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/candidates/${candidateId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to delete candidate");
        return;
      }

      setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
      toast.success("Candidate removed");
      router.refresh();
    } catch {
      toast.error("Network error deleting candidate");
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-xl">Candidate Roster ({candidates.length}/50)</CardTitle>
        <CardDescription>
          Add and manage the registered candidates participating in this survey.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add Candidate Form */}
        <form
          onSubmit={handleAddCandidate}
          className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30 space-y-4"
        >
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
            <UserPlus className="h-4 w-4 text-blue-600" />
            Add New Candidate
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="cand-name" className="text-xs">
                Candidate Name *
              </Label>
              <Input
                id="cand-name"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cand-party" className="text-xs">
                Affiliation / Party (Optional)
              </Label>
              <Input
                id="cand-party"
                placeholder="e.g. Independent, Green"
                value={party}
                onChange={(e) => setParty(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cand-image" className="text-xs">
                Image URL (Optional)
              </Label>
              <Input
                id="cand-image"
                placeholder="https://..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                maxLength={500}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              isLoading={isAdding}
              disabled={!name.trim() || candidates.length >= 50}
            >
              Add Candidate
            </Button>
          </div>
        </form>

        {/* Existing Candidates List */}
        <div className="space-y-2">
          {candidates.length === 0 ? (
            <div className="py-6 text-center text-sm text-zinc-500 border border-dashed rounded-lg">
              No candidates added yet. Add at least one candidate for voters to select.
            </div>
          ) : (
            <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {candidates.map((c) => {
                const isEditing = editingId === c.id;

                if (isEditing) {
                  return (
                    <div key={c.id} className="p-3 flex items-center gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Candidate Name"
                        className="h-8 text-sm"
                        maxLength={100}
                      />
                      <Input
                        value={editParty}
                        onChange={(e) => setEditParty(e.target.value)}
                        placeholder="Party"
                        className="h-8 text-sm"
                        maxLength={100}
                      />
                      <Button
                        size="sm"
                        variant="default"
                        className="h-8 px-2"
                        onClick={() => handleSaveEdit(c.id)}
                        isLoading={isSavingEdit}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2"
                        onClick={cancelEdit}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                }

                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                  >
                    <div>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {c.name}
                      </span>
                      {c.party && (
                        <span className="ml-2 text-xs text-zinc-500 font-medium">
                          ({c.party})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(c)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="h-4 w-4 text-zinc-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCandidate(c.id, c.name)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
