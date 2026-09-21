"use client";

import { useState } from "react";
import { AboutModal } from "../components/AboutModal";
import { HomeCard } from "../components/HomeCard";

const PREDICT_LEDE =
  "過去のランニング記録と気象データから、未来の走りを予測します。";
const RUNS_LEDE = "過去のランニング記録を表示します。";
const FORECAST_LEDE = "気象データによる走りやすさを予報します。";

export default function HomePage() {
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <section className="hero">
      <p className="eyebrow">RUNNING × WEATHER</p>
      <h1>天気から、走りを予報する。</h1>
      <div className="home-cards">
        <HomeCard
          size="lg"
          href="/predict"
          imageSrc="/images/home/home-card-predict.png?v=6"
          label="パフォーマンスを予測"
          lede={PREDICT_LEDE}
        />
        <HomeCard
          size="lg"
          href="/runs"
          imageSrc="/images/home/home-card-runs.png?v=6"
          label="走行記録"
          lede={RUNS_LEDE}
        />
        <HomeCard
          size="lg"
          href="/forecast"
          imageSrc="/images/home/home-card-forecast.png?v=6"
          label="ランニング天気予報"
          lede={FORECAST_LEDE}
        />
        <HomeCard
          size="md"
          href="/analyze"
          imageSrc="/images/home/home-card-analyze.png?v=6"
          label="分析結果"
        />
        <HomeCard
          size="sm"
          imageSrc="/images/home/home-card-about.png?v=6"
          label="PaceCastとは？"
          onClick={() => setAboutOpen(true)}
        />
      </div>
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </section>
  );
}
