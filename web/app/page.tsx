import Link from "next/link";

export default function HomePage() {
  return (
    <section className="hero">
      <p className="eyebrow">RUNNING × WEATHER</p>
      <h1>この条件なら、どのくらい走れるか。</h1>
      <p className="lede">過去の走行記録と気象データを重ねて、指定した気温・湿度でのペース・タイムを見積もります。</p>
      <div className="hero-actions">
        <Link className="button primary" href="/runs">
          走行記録
        </Link>
        <Link className="button primary" href="/predict">
          パフォーマンスを予測
        </Link>
      </div>
    </section>
  );
}
