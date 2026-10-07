"use client";

import { useState } from "react";
import { AboutModal } from "../components/AboutModal";
import { HomeCard } from "../components/HomeCard";

const PREDICT_LEDE =
  "過去のランニング記録と気象データから、未来の走りを予測します。";
const RUNS_LEDE = "過去のランニング記録を表示します。";
const FORECAST_LEDE = "気象データによる走りやすさを予報します。";
const COURSES_LEDE = "距離と起点から、周回コースの候補を作ります。";

export default function HomePage() {
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <section className="hero">
      <p className="eyebrow">RUNNING × WEATHER</p>
      <h1>天気から、走りを予報する。</h1>
      <div className="home-cards">
        <HomeCard size="lg" href="/predict" label="パフォーマンスを予測" lede={PREDICT_LEDE} />
        <HomeCard size="lg" href="/runs" label="走行記録" lede={RUNS_LEDE} />
        <HomeCard size="lg" href="/forecast" label="ランニング天気予報" lede={FORECAST_LEDE} />
        <HomeCard size="lg" href="/courses" label="コースを作る" lede={COURSES_LEDE} />
        <HomeCard size="sm" label="PaceCastとは？" onClick={() => setAboutOpen(true)} />
      </div>
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </section>
  );
}
