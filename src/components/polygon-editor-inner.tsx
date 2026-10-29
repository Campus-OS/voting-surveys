"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import "leaflet-draw";
import { Button } from "./ui/button";
import { RotateCcw, Crosshair } from "lucide-react";
import type { GeoJsonPolygon } from "@/lib/geo";

interface PolygonEditorProps {
  initialPolygon?: GeoJsonPolygon;
  onChange: (polygon: GeoJsonPolygon | null) => void;
}

export default function PolygonEditorInner({
  initialPolygon,
  onChange,
}: PolygonEditorProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const [pointCount, setPointCount] = useState<number>(
    initialPolygon?.coordinates?.[0]?.length || 0
  );

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center: London or initial polygon centroid
    let initialCenter: [number, number] = [40.7128, -74.006]; // NYC
    let initialZoom = 13;

    if (
      initialPolygon &&
      initialPolygon.coordinates &&
      initialPolygon.coordinates[0]?.length > 0
    ) {
      const first = initialPolygon.coordinates[0][0];
      // GeoJSON is [lng, lat], Leaflet is [lat, lng]
      initialCenter = [first[1], first[0]];
      initialZoom = 14;
    }

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnItemsRef.current = drawnItems;

    // If initial polygon exists, add it
    if (
      initialPolygon &&
      initialPolygon.coordinates &&
      initialPolygon.coordinates[0]?.length >= 3
    ) {
      const latLngs = initialPolygon.coordinates[0].map(
        (coord) => [coord[1], coord[0]] as [number, number]
      );
      const poly = L.polygon(latLngs, {
        color: "#2563eb",
        fillColor: "#3b82f6",
        fillOpacity: 0.35,
        weight: 3,
      });
      drawnItems.addLayer(poly);
      map.fitBounds(poly.getBounds());
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const drawControl = new L.Control.Draw({
      draw: {
        polyline: false,
        circle: false,
        rectangle: {
          shapeOptions: {
            color: "#2563eb",
            fillColor: "#3b82f6",
            fillOpacity: 0.35,
            weight: 3,
          },
        },
        circlemarker: false,
        marker: false,
        polygon: {
          allowIntersection: false,
          showArea: true,
          drawError: {
            color: "#e11d48",
            message: "<strong>Error:</strong> polygon edges cannot cross!",
          },
          shapeOptions: {
            color: "#2563eb",
            fillColor: "#3b82f6",
            fillOpacity: 0.35,
            weight: 3,
          },
        },
      },
      edit: {
        featureGroup: drawnItems,
        remove: true,
      },
    });

    map.addControl(drawControl);

    const updateGeoJson = () => {
      const layers = drawnItems.getLayers();
      if (layers.length === 0) {
        setPointCount(0);
        onChange(null);
        return;
      }

      const layer = layers[0] as L.Polygon;
      if (layer && typeof layer.getLatLngs === "function") {
        const rawLatLngs = layer.getLatLngs();
        const latLngs = Array.isArray(rawLatLngs[0])
          ? (rawLatLngs[0] as L.LatLng[])
          : (rawLatLngs as L.LatLng[]);

        // Convert to GeoJSON [lng, lat]
        const ring: number[][] = latLngs.map((pt) => [
          Number(pt.lng.toFixed(6)),
          Number(pt.lat.toFixed(6)),
        ]);

        // Close the ring if not closed
        if (
          ring.length > 0 &&
          (ring[0][0] !== ring[ring.length - 1][0] ||
            ring[0][1] !== ring[ring.length - 1][1])
        ) {
          ring.push([...ring[0]]);
        }

        const geoJson: GeoJsonPolygon = {
          type: "Polygon",
          coordinates: [ring],
        };

        setPointCount(ring.length);
        onChange(geoJson);
      }
    };

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    map.on(L.Draw.Event.CREATED, (e: { layer: L.Layer }) => {
      drawnItems.clearLayers();
      drawnItems.addLayer(e.layer);
      updateGeoJson();
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    map.on(L.Draw.Event.EDITED, () => {
      updateGeoJson();
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    map.on(L.Draw.Event.DELETED, () => {
      updateGeoJson();
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClear = () => {
    if (drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers();
      setPointCount(0);
      onChange(null);
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation || !mapInstanceRef.current) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        mapInstanceRef.current?.setView([lat, lng], 15);

        // Create a 500m sample boundary around user's current location
        const offset = 0.005; // ~500m
        const ring = [
          [Number((lng - offset).toFixed(6)), Number((lat - offset).toFixed(6))],
          [Number((lng + offset).toFixed(6)), Number((lat - offset).toFixed(6))],
          [Number((lng + offset).toFixed(6)), Number((lat + offset).toFixed(6))],
          [Number((lng - offset).toFixed(6)), Number((lat + offset).toFixed(6))],
          [Number((lng - offset).toFixed(6)), Number((lat - offset).toFixed(6))],
        ];

        if (drawnItemsRef.current && mapInstanceRef.current) {
          drawnItemsRef.current.clearLayers();
          const latLngs = ring.map((pt) => [pt[1], pt[0]] as [number, number]);
          const poly = L.polygon(latLngs, {
            color: "#2563eb",
            fillColor: "#3b82f6",
            fillOpacity: 0.35,
            weight: 3,
          });
          drawnItemsRef.current.addLayer(poly);
          mapInstanceRef.current.fitBounds(poly.getBounds());
          setPointCount(ring.length);
          onChange({
            type: "Polygon",
            coordinates: [ring],
          });
        }
      },
      () => {
        // Fallback
      },
      { timeout: 10000 }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            Polygon Boundary:
          </span>
          <span
            className={`font-semibold ${
              pointCount >= 3 ? "text-emerald-600" : "text-amber-600"
            }`}
          >
            {pointCount >= 3
              ? `${pointCount} points configured`
              : "No polygon drawn (min 3 points required)"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLocateMe}
            title="Center and generate area around my location"
          >
            <Crosshair className="h-4 w-4 mr-1.5 text-blue-600" />
            Area Around Me
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={pointCount === 0}
            className="text-red-600 hover:text-red-700"
          >
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Reset Map
          </Button>
        </div>
      </div>

      <div
        ref={mapContainerRef}
        className="h-[380px] w-full rounded-xl border border-zinc-300 shadow-inner relative z-0"
        style={{ minHeight: "380px" }}
      />

      <p className="text-xs text-zinc-500">
        💡 Use the Leaflet toolbar on the map to draw a Polygon or Rectangle around the eligible voting district. Click points on the map and double-click to finish.
      </p>
    </div>
  );
}
