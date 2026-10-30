"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "./ui/card";
import { toast } from "sonner";
import { CheckCircle2, MapPin, ShieldCheck, AlertCircle, ArrowRight, ArrowLeft, Laptop } from "lucide-react";
import type { SurveyWithVotes, CandidateWithVotes } from "@/lib/types";

interface VoteWizardProps {
  survey: SurveyWithVotes;
}

// ── Old-browser safe UUID ────────────────────────────────────────────────
function safeUUID(): string {
  try {
    if (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function") {
      return (crypto as any).randomUUID();
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

// ── Round safely (avoids NaN.toFixed throwing on old Android GPS) ───────
function safeRound(n: unknown, digits = 6): number {
  const x = typeof n === "number" && isFinite(n) ? n : 0;
  const f = Math.pow(10, digits);
  return Math.round(x * f) / f;
}

export function VoteWizard({ survey }: VoteWizardProps) {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [deviceId, setDeviceId] = useState<string>("");
  const [alreadyVotedOnDevice, setAlreadyVotedOnDevice] = useState<boolean>(false);

  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [isLocationVerified, setIsLocationVerified] = useState<boolean>(false);

  const [phone, setPhone] = useState<string>("");
  const [isSubmittingVote, setIsSubmittingVote] = useState<boolean>(false);

  // ── Device ID init — old-browser safe ──────────────────────────────────
  useEffect(() => {
    try {
      const storageKey = `voted_${survey._id}`;
      const votedFlag = localStorage.getItem(storageKey);
      if (votedFlag) {
        setAlreadyVotedOnDevice(true);
      }

      let devId = localStorage.getItem("voter_device_uuid");
      if (!devId) {
        devId = safeUUID();                    // 👈 was crypto.randomUUID()
        localStorage.setItem("voter_device_uuid", devId);
      }
      setDeviceId(devId);
    } catch {
      setDeviceId("device_" + Math.random().toString(36).substring(2, 15));
    }
  }, [survey._id]);

  // ── Location — guarded for null coords + missing geolocation ───────────
  const handleRequestLocation = () => {
    setLocationError(null);
    setIsLocating(true);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      setIsLocating(false);
      return;
    }

    // iOS < 10.3 and Chrome < 50 require secure context — be explicit
    const isSecure =
      typeof window !== "undefined" &&
      (window.location.protocol === "https:" ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");
    if (!isSecure) {
      setLocationError("Location requires a secure (HTTPS) connection");
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // Guard: old Android sometimes returns null coords
        if (!pos || !pos.coords || typeof pos.coords.latitude !== "number" || typeof pos.coords.longitude !== "number") {
          setLocationError("GPS returned invalid coordinates — try again");
          setIsLocating(false);
          return;
        }

        const coords = {
          lat: safeRound(pos.coords.latitude, 6),    // 👈 safer than toFixed then Number
          lng: safeRound(pos.coords.longitude, 6),
        };
        setLocation(coords);

        try {
          const res = await fetch(`/api/surveys/${survey._id}/verify-location`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(coords),
          });

          const data = await res.json();

          if (!res.ok) {
            setLocationError(data.error || "You are outside the allowed voting area");
            setIsLocationVerified(false);
            toast.error(data.error || "Location verification failed");
          } else {
            setIsLocationVerified(true);
            toast.success("Location verified inside eligible voting district!");
          }
        } catch {
          setLocationError("Failed to verify location with server");
          setIsLocationVerified(false);
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        setIsLocationVerified(false);
        switch (err.code) {
          case 1:
            setLocationError("Allow location in your browser settings");
            break;
          case 2:
            setLocationError("GPS unavailable — try outdoors");
            break;
          case 3:
            setLocationError("Location request timed out");
            break;
          default:
            setLocationError("Failed to obtain accurate location");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  // ── Submit vote — `.includes` replaced by `.indexOf` ───────────────────
  const handleSubmitVote = async (e: React.FormEvent) => {
    e.preventDefault();

    if (alreadyVotedOnDevice) {
      toast.error("This device has already cast a vote in this survey.");
      return;
    }

    if (!selectedCandidateId) {
      toast.error("Please select a candidate");
      setStep(1);
      return;
    }

    if (!location || !isLocationVerified) {
      toast.error("Please complete location verification");
      setStep(2);
      return;
    }

    if (!phone || !/^\+?[1-9]\d{6,14}$/.test(phone.trim())) {
      toast.error("Please enter a valid mobile phone number (e.g. +12345678901)");
      return;
    }

    setIsSubmittingVote(true);
    try {
      const res = await fetch(`/api/surveys/${survey._id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: selectedCandidateId,
          phone: phone.trim(),
          lat: location.lat,
          lng: location.lng,
          deviceId: deviceId || safeUUID(),    // 👈 fallback-safe
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to record vote");
        if (res.status === 409 && contains(data.error, "device")) {   // 👈 was .includes
          setAlreadyVotedOnDevice(true);
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

      toast.success("Vote recorded successfully!");
      setStep(4);
    } catch {
      toast.error("Network error while submitting vote");
    } finally {
      setIsSubmittingVote(false);
    }
  };

  const selectedCandidate = survey.candidatesWithVotes.find(
    (c) => c.id === selectedCandidateId
  );

  // ── Everything below is IDENTICAL to your original ────────────────────
  if (alreadyVotedOnDevice && step !== 4) {
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

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Wizard Progress Bar */}
      <div className="px-2" aria-label="Voting Steps">
        <div className="flex items-center justify-between text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400">
          <div
            className={`flex items-center gap-1.5 ${step >= 1 ? "text-blue-600 dark:text-blue-400" : ""
              }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${step >= 1
                ? "bg-blue-600 text-white"
                : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800"
                }`}
            >
              1
            </span>
            <span>Candidate</span>
          </div>

          <div
            className={`h-0.5 flex-1 mx-2 ${step >= 2 ? "bg-blue-600" : "bg-zinc-200 dark:bg-zinc-800"
              }`}
          />

          <div
            className={`flex items-center gap-1.5 ${step >= 2 ? "text-blue-600 dark:text-blue-400" : ""
              }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${step >= 2
                ? "bg-blue-600 text-white"
                : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800"
                }`}
            >
              2
            </span>
            <span>Location</span>
          </div>

          <div
            className={`h-0.5 flex-1 mx-2 ${step >= 3 ? "bg-blue-600" : "bg-zinc-200 dark:bg-zinc-800"
              }`}
          />

          <div
            className={`flex items-center gap-1.5 ${step >= 3 ? "text-blue-600 dark:text-blue-400" : ""
              }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${step >= 3
                ? "bg-blue-600 text-white"
                : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800"
                }`}
            >
              3
            </span>
            <span>Mobile & Vote</span>
          </div>
        </div>
      </div>

      {/* STEP 1: Select Candidate */}
      {step === 1 && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-xl">चरण 1: अपना उम्मीदवार चुनें</CardTitle>
            <CardDescription>
              <span className="text-md font-semibold leading-none tracking-tight text-black">{survey.name}</span> के लिए नामांकित उम्मीदवारों की समीक्षा करें। अपना वोट डालने के लिए एक उम्मीदवार का चयन करें।
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {survey.candidatesWithVotes.length === 0 ? (
              <div className="py-8 text-center text-zinc-500">
                इस सर्वेक्षण के लिए अभी तक कोई उम्मीदवार पंजीकृत नहीं किया गया है।
              </div>
            ) : (
              <div
                role="radiogroup"
                aria-label="Survey Candidates"
                className="grid gap-3"
              >
                {survey.candidatesWithVotes.map((candidate: CandidateWithVotes) => {
                  const isSelected = selectedCandidateId === candidate.id;
                  return (
                    <div
                      key={candidate.id}
                      onClick={() => setSelectedCandidateId(candidate.id)}
                      className={`relative flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${isSelected
                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20"
                        : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="candidate"
                          id={`cand-${candidate.id}`}
                          checked={isSelected}
                          onChange={() => setSelectedCandidateId(candidate.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <div>
                          <label
                            htmlFor={`cand-${candidate.id}`}
                            className="font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer"
                          >
                            {candidate.name}
                          </label>
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
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between border-t pt-4">
            <span className="text-xs text-zinc-500">
              Total cast votes: {survey.totalVotes}
            </span>
            <Button
              disabled={!selectedCandidateId}
              onClick={() => setStep(2)}
              className="gap-2"
            >
              Next: Location Check
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* STEP 2: Location Verification */}
      {step === 2 && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-xl">चरण 2: भू-सीमा सत्यापन</CardTitle>
            <CardDescription>
              मतदान केवल उन सत्यापित निवासियों तक सीमित है जो निर्धारित सर्वेक्षण सीमा के भीतर स्थित हैं।
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-xl border border-zinc-200 p-4 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600">
                <MapPin className="h-7 w-7" />
              </div>

              <div>
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  अपनी भौतिक उपस्थिति सत्यापित करें
                </h4>
                <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto">
                  GPS स्थान की अनुमति देने के लिए नीचे दिए गए बटन पर क्लिक करें। आपके स्थान को सर्वर पर सर्वेक्षण सीमा के विरुद्ध सत्यापित किया जाएगा।
                </p>
              </div>

              {location && (
                <div className="text-xs text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-800 py-2 px-3 rounded-lg border max-w-xs mx-auto">
                  Lat: {location.lat.toFixed(5)}, Lng: {location.lng.toFixed(5)}
                </div>
              )}

              {locationError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50 text-left"
                >
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <span>{locationError}</span>
                </div>
              )}

              {isLocationVerified && (
                <div
                  role="status"
                  className="flex items-center gap-2 p-3 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50 text-left"
                >
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  <span className="font-medium">
                    ✅ पात्र! आपकी पुष्टि हो गई है कि आप अनुमत जिला सीमा के भीतर हैं।
                  </span>
                </div>
              )}

              <Button
                type="button"
                onClick={handleRequestLocation}
                isLoading={isLocating}
                className="w-full sm:w-auto"
                variant={isLocationVerified ? "outline" : "default"}
              >
                <MapPin className="h-4 w-4 mr-2" />
                {isLocationVerified ? "दोबारा लोकेशन चेक करें" : "लोकेशन चालू करके जाँचें"}
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t pt-4">
            <Button variant="ghost" onClick={() => setStep(1)} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              disabled={!isLocationVerified}
              onClick={() => setStep(3)}
              className="gap-2"
            >
              Next: Mobile Verification
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* STEP 3: Phone & Direct Ballot Submission */}
      {step === 3 && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-xl">चरण 3: पहचान और मतपत्र जमा करना</CardTitle>
            <CardDescription>
              अपना मोबाइल फ़ोन नंबर दर्ज करें। प्रति डिवाइस और प्रति फ़ोन नंबर केवल एक वोट की अनुमति है।
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitVote} className="space-y-4">
              <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900/40 p-3 border text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                <div>
                  <strong>Selected Candidate:</strong> {selectedCandidate?.name} ({selectedCandidate?.party || "Independent"})
                </div>
                <div>
                  <strong>Location Verified:</strong> Lat: {location?.lat.toFixed(5)}, Lng: {location?.lng.toFixed(5)}
                </div>
                <div>
                  <strong>Device Identifier:</strong> Registered ({deviceId.substring(0, 8)}...)
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="voter-phone">Mobile Phone Number</Label>
                <Input
                  id="voter-phone"
                  type="tel"
                  placeholder="+12345678901"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  autoFocus
                />
                <p className="text-[11px] text-zinc-500">
                  देश कोड के साथ अपना मोबाइल नंबर दर्ज करें। किसी SMS OTP की आवश्यकता नहीं है।
                </p>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full h-11 text-base font-semibold"
                  isLoading={isSubmittingVote}
                  disabled={!phone.trim()}
                >
                  <ShieldCheck className="h-5 w-5 mr-2" />
                  Confirm and Cast Vote
                </Button>
              </div>
            </form>
          </CardContent>
          <CardFooter className="flex justify-between border-t pt-4">
            <Button
              variant="ghost"
              onClick={() => setStep(2)}
              disabled={isSubmittingVote}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* STEP 4: Success & Confirmation */}
      {step === 4 && (
        <Card className="shadow-lg border-emerald-500/30">
          <CardHeader className="text-center pb-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 mb-2">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <CardTitle className="text-2xl text-emerald-700 dark:text-emerald-400">
              वोट सफलतापूर्वक दर्ज हो गया!
            </CardTitle>
            <CardDescription>
              आपका मतपत्र सत्यापित GPS निर्देशांक और डिवाइस विशिष्टता के साथ आधिकारिक रूप से दर्ज कर लिया गया है।
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
      )}
    </div>
  );
}
