"use client";

import { useState } from "react";
import Link from "next/link";
import { AboutModal } from "../components/AboutModal";

export default function HomePage() {
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <section className="hero">
      <p className="eyebrow">RUNNING × WEATHER</p>
      <h1>この条件なら、どのくらい走れるか。</h1>
      <p className="lede">過去の走行記録と気象データを重ねて、指定した気象条件・走行強度でのペース・タイムを見積もります。</p>
      <div className="hero-actions">
        <Link className="button primary" href="/runs">
          走行記録
        </Link>
        <Link className="button primary" href="/predict">
          パフォーマンスを予測
        </Link>
      </div>
      <div className="hero-secondary">
        <button type="button" className="button secondary" onClick={() => setAboutOpen(true)}>
          PaceCastとは？
        </button>
        <Link className="button secondary" href="/analyze">
          分析結果を見る
        </Link>
      </div>
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </section>
  );
}
