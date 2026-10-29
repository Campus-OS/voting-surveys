"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "./ui/skeleton";
import type { GeoJsonPolygon } from "@/lib/geo";

interface PolygonEditorProps {
  initialPolygon?: GeoJsonPolygon;
  onChange: (polygon: GeoJsonPolygon | null) => void;
}

const DynamicPolygonEditorInner = dynamic(
  () => import("./polygon-editor-inner"),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="h-[380px] w-full rounded-xl" />
      </div>
    ),
  }
);

export function PolygonEditor(props: PolygonEditorProps) {
  return <DynamicPolygonEditorInner {...props} />;
}
