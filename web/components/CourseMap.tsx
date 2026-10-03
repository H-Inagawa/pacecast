"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";

type Point = {
  lat: number;
  lon: number;
};

type CourseLine = {
  id: string;
  coordinates: Point[];
};

type Props = {
  start: Point | null;
  courses: CourseLine[];
  hintRoads?: Point[][];
  selectedId: string | null;
  onPick: (latitude: number, longitude: number) => void;
  onStartPlotted?: () => void;
};

const HINT_ROAD_COLOR = "#2f6fed";

export function CourseMap({ start, courses, hintRoads = [], selectedId, onPick, onStartPlotted }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layersRef = useRef<LayerGroup | null>(null);
  const onPickRef = useRef(onPick);
  const onStartPlottedRef = useRef(onStartPlotted);
  const [ready, setReady] = useState(false);
  onPickRef.current = onPick;
  onStartPlottedRef.current = onStartPlotted;

  useEffect(() => {
    const element = host.current;
    if (element == null) {
      return;
    }
    let cancelled = false;
    void import("leaflet").then((leaflet) => {
      if (cancelled || mapRef.current) {
        return;
      }
      const map = leaflet.map(element, { zoomControl: true }).setView([35.681, 139.767], 12);
      leaflet
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        })
        .addTo(map);
      map.on("click", (event) => {
        onPickRef.current(event.latlng.lat, event.latlng.lng);
      });
      layersRef.current = leaflet.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!ready || map == null || layers == null) {
      return;
    }
    void import("leaflet").then((leaflet) => {
      map.invalidateSize();
      layers.clearLayers();
      const bounds: [number, number][] = [];
      if (start) {
        leaflet.circleMarker([start.lat, start.lon], {
          radius: 8,
          color: "#c45c26",
          fillColor: "#c45c26",
          fillOpacity: 1,
        }).addTo(layers);
        bounds.push([start.lat, start.lon]);
        onStartPlottedRef.current?.();
      }
      for (const road of hintRoads) {
        if (road.length < 2) {
          continue;
        }
        const latLngs = road.map((point) => [point.lat, point.lon] as [number, number]);
        leaflet
          .polyline(latLngs, {
            color: HINT_ROAD_COLOR,
            weight: 2,
            opacity: 0.8,
          })
          .addTo(layers);
        bounds.push(...latLngs);
      }
      for (const course of courses) {
        const selected = course.id === selectedId;
        const latLngs = course.coordinates.map((point) => [point.lat, point.lon] as [number, number]);
        leaflet
          .polyline(latLngs, {
            color: selected ? "#c45c26" : "#8d97a6",
            weight: selected ? 5 : 3,
            opacity: selected ? 0.95 : 0.7,
          })
          .addTo(layers);
        bounds.push(...latLngs);
      }
      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [24, 24] });
      } else if (start) {
        map.setView([start.lat, start.lon], 15);
      }
    });
  }, [courses, hintRoads, ready, selectedId, start]);

  return <div ref={host} className="course-map" role="application" aria-label="起点とコースの地図" />;
}
