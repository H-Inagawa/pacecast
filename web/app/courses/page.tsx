"use client";

import { useEffect, useRef, useState } from "react";
import { BackHome } from "../../components/BackHome";
import { CourseMap } from "../../components/CourseMap";
import { StickyActions } from "../../components/StickyActions";
import { apiSend } from "../../lib/api";
import {
  confidenceLabel,
  formatDistanceKm,
  formatDurationRange,
  formatPaceRange,
} from "../../lib/format";
import { readGeolocationError, requestCurrentPosition } from "../../lib/geolocation";
import { beginLoading, endLoading } from "../../lib/loading";

const INTENSITIES = [
  { key: "low", label: "低" },
  { key: "medium", label: "中" },
  { key: "high", label: "高" },
] as const;

type CoursePoint = {
  lat: number;
  lon: number;
};

type CourseResult = {
  id: string;
  distance_km: number;
  coordinates: CoursePoint[];
  turn_count: number;
  signal_count: number;
  ascent_m: number;
  descent_m: number;
  prediction: {
    pace_sec_per_km: number;
    duration_sec: number;
    rmse_sec_per_km: number;
    confidence: string;
    sample_count: number;
    r_squared: number;
  } | null;
};

type CourseResponse = {
  station_name: string;
  courses: CourseResult[];
};

export default function CoursesPage() {
  const [distance, setDistance] = useState("5");
  const [intensity, setIntensity] = useState("medium");
  const [start, setStart] = useState<CoursePoint | null>(null);
  const [placeNote, setPlaceNote] = useState("地図をタップするか、現在地を使ってください");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CourseResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
      const payload = await apiSend<CourseResponse>("/api/courses", "POST", {
        distance_km: distanceKm,
        latitude: start.lat,
        longitude: start.lon,
        intensity,
      });
      setResult(payload);
      setSelectedId(payload.courses[0]?.id ?? null);
    } catch (err) {
      setResult(null);
      setSelectedId(null);
      setError(err instanceof Error ? err.message : "コースを作れませんでした");
    }
  }

  return (
    <>
      <h1>コースを作る</h1>
      <p className="lede">
        走りたい距離の周回を、最大3つ提案します。実距離は指定の±20%まで、かつ±2kmまでです。折り返しがあるときは、元の距離と、折り返し分を除いた距離の両方がこの範囲に入るものだけ出します。予想タイムは、起点に近いアメダスの現在の予報で計算します。
      </p>
      <p className="meta">コースの作成には、数分かかることがあります。</p>
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
        <fieldset>
          <legend>走行強度</legend>
          {INTENSITIES.map((item) => (
            <label key={item.key}>
              <input
                type="radio"
                name="course-intensity"
                value={item.key}
                checked={intensity === item.key}
                onChange={() => setIntensity(item.key)}
              />
              {item.label}
            </label>
          ))}
        </fieldset>
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

      {result ? (
        <>
          <p className="meta">気象は {result.station_name} の現在の予報です。信号は地図データ上の数です。</p>
          <div className="course-list">
            {result.courses.map((course, index) => {
              const selected = course.id === selectedId;
              const timeError = course.prediction
                ? course.prediction.rmse_sec_per_km * (course.prediction.duration_sec / course.prediction.pace_sec_per_km)
                : 0;
              return (
                <button
                  key={course.id}
                  type="button"
                  className={selected ? "course-card is-selected" : "course-card"}
                  aria-pressed={selected}
                  onClick={() => setSelectedId(course.id)}
                >
                  <strong>コース {index + 1}</strong>
                  <span>実距離 {formatDistanceKm(course.distance_km)}</span>
                  {course.prediction ? (
                    <>
                      <span>
                        予想ペース {formatPaceRange(course.prediction.pace_sec_per_km, course.prediction.rmse_sec_per_km)}
                      </span>
                      <span>予想タイム {formatDurationRange(course.prediction.duration_sec, timeError)}</span>
                      <span className="meta">
                        信頼度 {confidenceLabel(course.prediction.confidence)} / 参考 {course.prediction.sample_count}件 /
                        R² {course.prediction.r_squared.toFixed(2)}
                      </span>
                    </>
                  ) : (
                    <span>予想タイムは出せません。WBGT が付いた走行記録が足りません。</span>
                  )}
                  <span>信号 {course.signal_count}回</span>
                  <span>曲がり角 {course.turn_count}回</span>
                  <span>
                    上り {course.ascent_m}m / 下り {course.descent_m}m
                  </span>
                </button>
              );
            })}
          </div>
        </>
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
