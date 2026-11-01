"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "./ui/card";
import { toast } from "sonner";
import { CheckCircle2, ArrowRight, Laptop } from "lucide-react";
import type { SurveyWithVotes, CandidateWithVotes } from "@/lib/types";

interface VoteWizardProps {
  survey: SurveyWithVotes;
}

// ── Old-browser safe UUID ────────────────────────────────────────────────
function safeUUID(): string {
  try {
    const cryptoApi = typeof crypto === "undefined"
      ? undefined
      : crypto as Crypto & { randomUUID?: () => string };
    if (typeof cryptoApi?.randomUUID === "function") {
      return cryptoApi.randomUUID();
    }
  } catch {
    // ignore
  }
  // RFC4122 v4 fallback — works on IE10+, all old Android, all Safari
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Old-browser safe string contains ────────────────────────────────────
function contains(haystack: unknown, needle: string): boolean {
  return typeof haystack === "string" && haystack.indexOf(needle) !== -1;
}

export function VoteWizard({ survey }: VoteWizardProps) {
  const router = useRouter();

  const [hasVoted, setHasVoted] = useState<boolean>(false);

  const [deviceId, setDeviceId] = useState<string>("");

  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [voteError, setVoteError] = useState<string | null>(null);

  const [isSubmittingVote, setIsSubmittingVote] = useState<boolean>(false);

  const [checkingStatus, setCheckingStatus] = useState<boolean>(true);
  const [votedStatus, setVotedStatus] = useState<{
    voted: boolean;
    reasons: string[];
  }>({ voted: false, reasons: [] });

  // ── Device ID init — old-browser safe ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 1) Resolve / create a stable deviceId
      let devId = "";
      try {
        let stored = localStorage.getItem("voter_device_uuid");
        if (!stored) {
          stored = safeUUID();
          localStorage.setItem("voter_device_uuid", stored);
        }
        devId = stored;
      } catch {
        // localStorage blocked → cookie fallback
        try {
          const m = document.cookie.match(/(?:^|;\s*)voter_device_uuid=([^;]+)/);
          if (m) devId = decodeURIComponent(m[1]);
          else {
            devId = safeUUID();
            document.cookie = `voter_device_uuid=${encodeURIComponent(
              devId
            )}; path=/; max-age=31536000; SameSite=Lax`;
          }
        } catch {
          devId = "device_" + Math.random().toString(36).substring(2, 15);
        }
      }

      if (cancelled) return;
      setDeviceId(devId);

      // 2) Quick local flag (fast UX)
      try {
        if (localStorage.getItem(`voted_${survey._id}`)) {
          setVotedStatus({
            voted:true,
            reasons:['voted all-ready voted']
          })
        }
      } catch {
        // ignore
      }

      // 3) Ask the server (source of truth)
      try {
        const res = await fetch(`/api/surveys/${survey._id}/voted-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId: devId }),
          // optional: `cache: "no-store"` to be safe
        });
        if (res.ok) {
          const data = await res.json();
          if (cancelled) return;
          setVotedStatus({
            voted: !!data.voted,
            reasons: Array.isArray(data.reasons) ? data.reasons : [],
          });
          if (data.voted) {
            setVotedStatus({
              voted:true,
              reasons:[]
            })
            try {
              localStorage.setItem(`voted_${survey._id}`, "true");
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // Network failure → do not block the user; server vote POST will still enforce
        // (we don't want a flaky network to prevent a legit vote)
      } finally {
        if (!cancelled) setCheckingStatus(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [survey._id]);

  useEffect(() => {
  const onFocus = async () => {
    if (document.visibilityState !== "visible") return;
    if (!deviceId) return;
    try {
      const res = await fetch(`/api/surveys/${survey._id}/voted-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.voted) {
        setVotedStatus({ voted: true, reasons: data.reasons || [] });
      }
    } catch {
      // ignore
    }
  };
  document.addEventListener("visibilitychange", onFocus);
  return () => document.removeEventListener("visibilitychange", onFocus);
}, [deviceId, survey._id]);

  // Request location and submit the ballot in one user action. The server
  // verifies the geofence before inserting the vote.
  const handleSubmitVote = async () => {
    setVoteError(null);

    if (votedStatus.voted) {
      toast.error("This device has already cast a vote in this survey.");
      return;
    }

    if (!selectedCandidateId) {
      toast.error("Please select a candidate");
      return;
    }

    if (typeof window === "undefined" || !window.isSecureContext) {
      setVoteError("Location permission requires a secure HTTPS connection.");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setVoteError("Location is not supported by this browser.");
      return;
    }

    setIsSubmittingVote(true);
    try {
      const location = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }),
          reject,
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      });

      const res = await fetch(`/api/surveys/${survey._id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: selectedCandidateId,
          lat: location.lat,
          lng: location.lng,
          deviceId: deviceId || safeUUID(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 403) {
          setVoteError("You are not allowed to vote in this survey area.");
        } else {
          toast.error(data.error || "Failed to record vote");
        }
        if (res.status === 409 && contains(data.error, "device")) {
          setVotedStatus({
            voted: true,
            reasons: [],
          });
          try {
            localStorage.setItem(`voted_${survey._id}`, "true");
          } catch {
            // ignore
          }
        }
        return;
      }

      try {
        localStorage.setItem(`voted_${survey._id}`, "true");
      } catch {
        // ignore
      }

      setHasVoted(true);
      toast.success("Vote recorded successfully!");
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error) {
        switch (Number(error.code)) {
          case 1:
            setVoteError("Location permission is required to verify your eligibility.");
            break;
          case 2:
            setVoteError("Your location is unavailable. Try again from an open area.");
            break;
          case 3:
            setVoteError("Location request timed out. Please try again.");
            break;
          default:
            setVoteError("Unable to verify your location.");
        }
      } else {
        toast.error("Network error while verifying your location or submitting your vote.");
      }
    } finally {
      setIsSubmittingVote(false);
    }
  };


  const selectedCandidate = survey.candidatesWithVotes.find(
    (c) => c.id === selectedCandidateId
  );

  if (checkingStatus) {
  return (
    <div className="w-full max-w-2xl mx-auto py-6">
      <Card className="shadow-md p-8 text-center space-y-3">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600" />
        <p className="text-sm text-zinc-500">आपकी स्थिति जाँची जा रही है…</p>
      </Card>
    </div>
  );
}
  // ── Everything below is IDENTICAL to your original ────────────────────
  if (votedStatus.voted && !hasVoted) {
    return (
      <div className="w-full max-w-2xl mx-auto py-6">
        <Card className="border-amber-500/40 shadow-lg text-center p-6 space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
            <Laptop className="h-7 w-7" />
          </div>
          <CardTitle className="text-xl">One Vote Per Device Limit</CardTitle>
          <CardDescription className="max-w-md mx-auto">
            A ballot has already been cast from this device for <strong>{survey.name}</strong>. Each voter and physical device is permitted exactly one vote.
          </CardDescription>
          <div className="pt-2">
            <Button onClick={() => router.push(`/survey/${survey._id}/results`)} className="gap-2">
              View Live Results
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (hasVoted) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <Card className="shadow-lg border-emerald-500/30">
          <CardHeader className="text-center pb-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 mb-2">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <CardTitle className="text-2xl text-emerald-700 dark:text-emerald-400">
              वोट सफलतापूर्वक दर्ज हो गया!
            </CardTitle>
            <CardDescription>
              आपका वोट सफलतापूर्वक दर्ज हो गया है।
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border p-4 bg-zinc-50 dark:bg-zinc-900/50 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Survey:</span>
                <span className="font-semibold">{survey.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Candidate:</span>
                <span className="font-semibold text-blue-600">{selectedCandidate?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Device Status:</span>
                <span className="text-emerald-600 font-medium">Ballot Recorded (Device Locked)</span>
              </div>
            </div>

            <Button
              onClick={() => router.push(`/survey/${survey._id}/results`)}
              className="w-full h-11 text-base font-semibold"
            >
              View Live Results
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-xl">अपना उम्मीदवार चुनें</CardTitle>
          <CardDescription>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{survey.name}</span> के लिए उम्मीदवार चुनें। वोट करने पर आपका ब्राउज़र स्थान की अनुमति माँगेगा। पात्रता जाँच पृष्ठभूमि में होगी; निर्देशांक स्क्रीन पर नहीं दिखेंगे।
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {survey.candidatesWithVotes.length === 0 ? (
            <div className="py-8 text-center text-zinc-500">
              इस सर्वेक्षण के लिए अभी तक कोई उम्मीदवार पंजीकृत नहीं किया गया है।
            </div>
          ) : (
            <div role="radiogroup" aria-label="Survey Candidates" className="grid gap-3">
              {survey.candidatesWithVotes.map((candidate: CandidateWithVotes) => {
                const isSelected = selectedCandidateId === candidate.id;
                return (
                  <label
                    key={candidate.id}
                    htmlFor={`cand-${candidate.id}`}
                    className={`relative flex items-center justify-between gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 dark:focus-within:ring-offset-zinc-950 ${isSelected
                      ? "border-blue-600 bg-blue-50/70 shadow-sm dark:bg-blue-950/30"
                      : "border-zinc-200 hover:border-blue-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/60"
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="candidate"
                        id={`cand-${candidate.id}`}
                        checked={isSelected}
                        onChange={() => {
                          setSelectedCandidateId(candidate.id);
                          setVoteError(null);
                        }}
                        aria-label={`Select ${candidate.name}`}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {candidate.name}
                        </span>
                        {candidate.party && (
                          <p className="text-xs text-zinc-500">{candidate.party}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                        {candidate.votes} votes
                      </span>
                      <span className="text-xs text-zinc-500 block">
                        {candidate.percentage}%
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
          {voteError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
              {voteError}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-4 border-t pt-4">
          <span className="text-xs text-zinc-500">
            Total cast votes: {survey.totalVotes}
          </span>
          <Button
            disabled={!selectedCandidateId || isSubmittingVote || survey.candidatesWithVotes.length === 0}
            onClick={handleSubmitVote}
            isLoading={isSubmittingVote}
            className="gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isSubmittingVote ? "Checking eligibility…" : "Cast Vote"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
