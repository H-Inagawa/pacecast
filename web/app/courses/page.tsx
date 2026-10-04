"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BackHome } from "../../components/BackHome";
import { type CourseDetail } from "../../components/CourseDetailModal";
import { CourseScoreTable } from "../../components/CourseScoreTable";
import { CourseMap } from "../../components/CourseMap";
import { CourseMethodModal } from "../../components/CourseMethodModal";
import { StickyActions } from "../../components/StickyActions";
import { apiPostCourses } from "../../lib/api";
import { readGeolocationError, requestCurrentPosition } from "../../lib/geolocation";
import { beginLoading, endLoading, setLoadingMessage } from "../../lib/loading";
import { COURSE_LOCATE_LOADING_MESSAGE } from "../../lib/loading-messages";

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
  hint_roads?: CoursePoint[][];
};

const START_GUIDE = "地図をタップすると、スタート位置を変更できます。";

export default function CoursesPage() {
  const [distance, setDistance] = useState("5");
  const [start, setStart] = useState<CoursePoint | null>(null);
  const [placeNote, setPlaceNote] = useState(START_GUIDE);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CourseResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [methodOpen, setMethodOpen] = useState(false);
  const plotWait = useRef(false);
  const headingRef = useRef<HTMLElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const scrollTarget = useRef<"heading" | "map" | null>(null);

  const distanceKm = Number(distance);
  const ready = start != null && distanceKm >= 1 && distanceKm <= 50;

  const locateHere = useCallback(async () => {
    setError(null);
    if (plotWait.current) {
      return;
    }
    plotWait.current = true;
    beginLoading();
    setLoadingMessage(COURSE_LOCATE_LOADING_MESSAGE);
    try {
      // 「現在地に戻る」と同じく、ブラウザ GPS（Geolocation）で現在地を取る
      const here = await requestCurrentPosition();
      setStart({ lat: here.latitude, lon: here.longitude });
      setPlaceNote(START_GUIDE);
    } catch (err) {
      plotWait.current = false;
      endLoading();
      setPlaceNote("現在地を使えないので、地図をタップしてください");
      scrollTarget.current = "heading";
      setError(err instanceof Error ? err.message : readGeolocationError(err));
    }
  }, []);

  useEffect(() => {
    return () => {
      if (plotWait.current) {
        plotWait.current = false;
        endLoading();
      }
    };
  }, []);

  useEffect(() => {
    void locateHere();
  }, [locateHere]);

  useEffect(() => {
    const target = scrollTarget.current;
    if (target == null) {
      return;
    }
    scrollTarget.current = null;
    const node = target === "heading" ? headingRef.current : mapRef.current;
    if (node != null && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [error, result]);

  function finishPlotWait() {
    if (!plotWait.current) {
      return;
    }
    plotWait.current = false;
    endLoading();
  }

  function pickMap(latitude: number, longitude: number) {
    setStart({ lat: latitude, lon: longitude });
    setPlaceNote(START_GUIDE);
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
      // エラー・案内があるときは見出しまで戻し、成功時は地図が見える位置へ
      scrollTarget.current = payload.notice ? "heading" : "map";
    } catch (err) {
      scrollTarget.current = "heading";
      setError(err instanceof Error ? err.message : "コースを作れませんでした");
    }
  }

  return (
    <>
      <header className="page-heading" ref={headingRef}>
        <h1>コースを作る</h1>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <div className="course-lede-row">
        <p className="lede">
          走りたい距離のコースを、最大5つ作成します。
          <br />
          コースの作成には、数分かかることがあります。
        </p>
        <button type="button" className="heading-help course-method-button" onClick={() => setMethodOpen(true)}>
          作成方法
        </button>
      </div>
      <CourseMethodModal open={methodOpen} onClose={() => setMethodOpen(false)} />

      <section className="course-form">
        <label>
          距離（km）:
          <input
            type="number"
            min={1}
            max={50}
            step={0.1}
            value={distance}
            onChange={(event) => setDistance(event.target.value)}
          />
        </label>
        <div className="course-map-header">
          <p className="meta">{placeNote}</p>
          <button type="button" className="button course-locate-button" onClick={() => void locateHere()}>
            現在地に戻る
          </button>
        </div>
      </section>

      <div ref={mapRef}>
        <CourseMap
          start={start}
          courses={result?.courses ?? []}
          hintRoads={result?.hint_roads ?? []}
          selectedId={selectedId}
          onPick={pickMap}
          onStartPlotted={finishPlotWait}
        />
      </div>

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
