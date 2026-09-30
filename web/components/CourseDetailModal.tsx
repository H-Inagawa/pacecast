"use client";

import { useEffect, useState } from "react";
import { formatDistanceKm } from "../lib/format";
import { CourseScoreGuideModal } from "./CourseScoreGuideModal";
import { ModalCloseButton } from "./ModalCloseButton";

export type CourseScoreParts = {
  distance: number;
  major: number;
  straight: number;
  turns: number;
  overlap: number;
  signals: number;
  junctions: number;
};

export type CourseDetail = {
  id: string;
  distance_km: number;
  turn_count: number;
  signal_count: number;
  major_km: number;
  overlap_ratio: number;
  ascent_m: number;
  descent_m: number;
  junction_count: number;
  score: number;
  score_parts: CourseScoreParts;
};

type Props = {
  course: CourseDetail | null;
  title: string;
  onClose: () => void;
};

function points(value: number): string {
  return value.toFixed(1);
}

export function CourseDetailModal({ course, title, onClose }: Props) {
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (course == null) {
      setGuideOpen(false);
    }
  }, [course]);

  useEffect(() => {
    if (course == null) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      if (guideOpen) {
        setGuideOpen(false);
        return;
      }
      onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [course, guideOpen, onClose]);

  if (course == null) {
    return null;
  }

  const rows: { label: string; data: string; points: string }[] = [
    { label: "信号", data: `${course.signal_count}回`, points: points(course.score_parts.signals) },
    { label: "曲がり角", data: `${course.turn_count}回`, points: points(course.score_parts.turns) },
    { label: "大通り", data: formatDistanceKm(course.major_km), points: points(course.score_parts.major) },
    { label: "道路重複", data: `${Math.round(course.overlap_ratio * 100)}%`, points: points(course.score_parts.overlap) },
    { label: "上り", data: `${course.ascent_m}m`, points: "—" },
    { label: "下り", data: `${course.descent_m}m`, points: "—" },
    { label: "距離への近さ", data: formatDistanceKm(course.distance_km), points: points(course.score_parts.distance) },
    { label: "直進", data: "—", points: points(course.score_parts.straight) },
    { label: "交差点", data: `${course.junction_count}回`, points: points(course.score_parts.junctions) },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-panel about-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />
        <div className="modal-heading">
          <h2 id="course-detail-title">{title}</h2>
          <button type="button" className="heading-help" onClick={() => setGuideOpen(true)}>
            採点基準
          </button>
        </div>
        <p className="meta">今回の候補で、いちばん高い素点を100点にしています。信号は地図データ上の数です。上りと下りは点数に入っていません。</p>
        <table className="course-score-table">
          <thead>
            <tr>
              <th scope="col">項目</th>
              <th scope="col">データ</th>
              <th scope="col">点数</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>{row.data}</td>
                <td>{row.points}</td>
              </tr>
            ))}
            <tr>
              <th scope="row">合計</th>
              <td />
              <td>{points(course.score)}</td>
            </tr>
          </tbody>
        </table>
        <CourseScoreGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
      </div>
    </div>
  );
}
