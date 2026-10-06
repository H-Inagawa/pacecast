"use client";

import { useState } from "react";
import { courseRecommendStars } from "../lib/courses";
import { formatDistanceKm } from "../lib/format";
import {
  courseScoreCell,
  courseScoreRows,
  formatScorePoint,
  type CourseDetail,
} from "./CourseDetailModal";
import { CourseScoreGuideModal } from "./CourseScoreGuideModal";

type Props = {
  courses: CourseDetail[];
  targetKm: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function CourseScoreTable({ courses, targetKm, selectedId, onSelect }: Props) {
  const [guideOpen, setGuideOpen] = useState(false);
  const rows = courses[0] ? courseScoreRows(courses[0], targetKm) : [];
  const byCourse = courses.map((course) => courseScoreRows(course, targetKm));

  return (
    <section className="course-board" aria-label="コースの評価">
      <div className="course-board-tools">
        <button type="button" className="heading-help" onClick={() => setGuideOpen(true)}>
          採点基準
        </button>
      </div>
      <div className="course-compare-scroll">
        <table className="course-score-table course-compare-table">
          <thead>
            <tr>
              <th scope="col">項目</th>
              {courses.map((course, index) => {
                const name = `コース ${index + 1}`;
                const selected = course.id === selectedId;
                return (
                  <th key={course.id} scope="col" className="course-column-header">
                    <button
                      type="button"
                      className={selected ? "course-column-button is-selected" : "course-column-button"}
                      aria-pressed={selected}
                      onClick={() => onSelect(course.id)}
                    >
                      {name}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">おすすめ度</th>
              {courses.map((course) => {
                const stars = courseRecommendStars(course.raw_score);
                return (
                  <td key={`${course.id}-score`} aria-label={`おすすめ度 ${stars}`}>
                    {stars}
                  </td>
                );
              })}
            </tr>
            <tr>
              <th scope="row">スコア</th>
              {courses.map((course) => (
                <td key={`${course.id}-raw`}>{formatScorePoint(course.raw_score)}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">距離</th>
              {courses.map((course) => (
                <td key={`${course.id}-distance`}>{formatDistanceKm(course.distance_km)}</td>
              ))}
            </tr>
            {rows.map((row, rowIndex) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {byCourse.map((courseRows, courseIndex) => (
                  <td key={courses[courseIndex].id}>{courseScoreCell(courseRows[rowIndex])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CourseScoreGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </section>
  );
}
