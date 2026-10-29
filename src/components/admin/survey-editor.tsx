"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PolygonEditor } from "@/components/polygon-editor";
import { toast } from "sonner";
import { Save, ArrowLeft } from "lucide-react";
import type { GeoJsonPolygon } from "@/lib/geo";

interface SurveyEditorProps {
  initialData?: {
    _id: string;
    name: string;
    description?: string;
    isActive: boolean;
    polygon: GeoJsonPolygon;
  };
  isNew?: boolean;
}

export function SurveyEditor({ initialData, isNew = false }: SurveyEditorProps) {
  const router = useRouter();

  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [isActive, setIsActive] = useState<boolean>(
    initialData ? initialData.isActive : true
  );
  const [polygon, setPolygon] = useState<GeoJsonPolygon | null>(
    initialData?.polygon || null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || name.trim().length < 3 || name.trim().length > 100) {
      toast.error("Survey name must be between 3 and 100 characters");
      return;
    }

    if (!polygon || !polygon.coordinates || polygon.coordinates[0]?.length < 3) {
      toast.error("Please draw a polygon boundary on the map (minimum 3 points required)");
      return;
    }

    setIsSubmitting(true);
    try {
      const endpoint = isNew
        ? "/api/admin/surveys"
        : `/api/admin/surveys/${initialData?._id}`;
      const method = isNew ? "POST" : "PUT";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          isActive,
          polygon,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to save survey");
        return;
      }

      toast.success(
        isNew ? "Survey created successfully!" : "Survey updated successfully!"
      );

      if (isNew && data.survey?._id) {
        router.push(`/admin/surveys/${data.survey._id}`);
      } else {
        router.push("/admin/surveys");
      }
      router.refresh();
    } catch {
      toast.error("Network error while saving survey");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">
                {isNew ? "Create New Voting Survey" : "Edit Survey Settings"}
              </CardTitle>
              <CardDescription>
                Define survey identity and draw the geofence perimeter.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/admin/surveys")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Surveys
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="survey-name">Survey Title *</Label>
            <Input
              id="survey-name"
              placeholder="e.g. 2026 District Mayoral Election"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={3}
              maxLength={100}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="survey-description">Description</Label>
            <Textarea
              id="survey-description"
              placeholder="Provide context or instructions for voters (max 500 characters)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <input
              type="checkbox"
              id="is-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <Label htmlFor="is-active" className="cursor-pointer font-medium">
              Accepting Votes (Active Status)
            </Label>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <Label className="text-base font-semibold">
              Eligible Voting District (Polygon) *
            </Label>
            <PolygonEditor
              initialPolygon={initialData?.polygon}
              onChange={(poly) => setPolygon(poly)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/surveys")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} className="gap-2">
            <Save className="h-4 w-4" />
            {isNew ? "Create Survey & Add Candidates" : "Save Changes"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
