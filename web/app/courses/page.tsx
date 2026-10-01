"use client";

import { useEffect, useRef, useState } from "react";
import { BackHome } from "../../components/BackHome";
import { type CourseDetail } from "../../components/CourseDetailModal";
import { CourseScoreTable } from "../../components/CourseScoreTable";
import { CourseMap } from "../../components/CourseMap";
import { CourseMethodModal } from "../../components/CourseMethodModal";
import { StickyActions } from "../../components/StickyActions";
import { apiPostCourses } from "../../lib/api";
import { readGeolocationError, requestCurrentPosition } from "../../lib/geolocation";
import { beginLoading, endLoading } from "../../lib/loading";

type CoursePoint = {
  lat: number;
  lon: number;
};

type CourseResult = CourseDetail & {
  coordinates: CoursePoint[];
};

type CourseResponse = {
  courses: CourseResult[];
  notice?: string;
};

export default function CoursesPage() {
  const [distance, setDistance] = useState("5");
  const [start, setStart] = useState<CoursePoint | null>(null);
  const [placeNote, setPlaceNote] = useState("地図をタップするか、現在地を使ってください");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CourseResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [methodOpen, setMethodOpen] = useState(false);
  const plotWait = useRef(false);

  const distanceKm = Number(distance);
  const ready = start != null && distanceKm >= 1 && distanceKm <= 50;

  useEffect(() => {
    return () => {
      if (plotWait.current) {
        plotWait.current = false;
        endLoading();
      }
    };
  }, []);

  function finishPlotWait() {
    if (!plotWait.current) {
      return;
    }
    plotWait.current = false;
    endLoading();
  }

  async function useHere() {
    setError(null);
    if (plotWait.current) {
      return;
    }
    plotWait.current = true;
    beginLoading();
    try {
      const here = await requestCurrentPosition();
      setStart({ lat: here.latitude, lon: here.longitude });
      setPlaceNote("現在地を起点にしました");
    } catch (err) {
      plotWait.current = false;
      endLoading();
      setPlaceNote("現在地を使えないので、地図をタップしてください");
      setError(err instanceof Error ? err.message : readGeolocationError(err));
    }
  }

  function pickMap(latitude: number, longitude: number) {
    setStart({ lat: latitude, lon: longitude });
    setPlaceNote("地図の地点を起点にしました");
    setError(null);
  }

  async function onSubmit() {
    if (start == null) {
      return;
    }
    setError(null);
    try {
      const payload = await apiPostCourses<CourseResponse>("/api/courses", {
        distance_km: distanceKm,
        latitude: start.lat,
        longitude: start.lon,
      });
      setResult(payload);
      setSelectedId(payload.courses[0]?.id ?? null);
      setError(payload.notice ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "コースを作れませんでした");
    }
  }

  return (
    <>
      <header className="page-heading">
        <h1>コースを作る</h1>
        <button type="button" className="heading-help" onClick={() => setMethodOpen(true)}>
          作成方法
        </button>
      </header>
      <p className="lede">走りたい距離の周回を、点数の高い順に最大5つ出します。</p>
      <p className="meta">コースの作成には、数分かかることがあります。</p>
      <CourseMethodModal open={methodOpen} onClose={() => setMethodOpen(false)} />
      {error ? <p className="error">{error}</p> : null}

      <section className="course-form">
        <label>
          距離（km）
          <input
            type="number"
            min={1}
            max={50}
            step={0.1}
            value={distance}
            onChange={(event) => setDistance(event.target.value)}
          />
        </label>
        <p className="meta">{placeNote}</p>
        <button type="button" className="button" onClick={() => void useHere()}>
          現在地を使う
        </button>
      </section>

      <CourseMap
        start={start}
        courses={result?.courses ?? []}
        selectedId={selectedId}
        onPick={pickMap}
        onStartPlotted={finishPlotWait}
      />

      {result && result.courses.length > 0 ? (
        <CourseScoreTable
          courses={result.courses}
          targetKm={distanceKm}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      ) : null}

      <StickyActions>
        <button type="button" className="button action-lg" disabled={!ready} onClick={() => void onSubmit()}>
          コースを作る
        </button>
        <BackHome variant="button" />
      </StickyActions>
    </>
  );
}
