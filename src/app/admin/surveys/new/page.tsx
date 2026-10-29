import React from "react";
import { SurveyEditor } from "@/components/admin/survey-editor";

export default function NewSurveyPage() {
  return (
    <div className="py-2">
      <SurveyEditor isNew={true} />
    </div>
  );
}
