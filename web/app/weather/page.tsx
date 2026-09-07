"use client";

import { useEffect, useState } from "react";
import { BackHome } from "../../components/BackHome";
import { StickyActions } from "../../components/StickyActions";
import { apiGet, apiUpload } from "../../lib/api";
import type { WeatherPage } from "../../lib/types";

export default function WeatherScreen() {
  const [data, setData] = useState<WeatherPage | null>(null);
  const [date, setDate] = useState("");
  const [file, setFile] = useState<File | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(selected?: string) {
    const query = selected ? `?date=${selected}` : "";
    const page = await apiGet<WeatherPage>(`/api/weather${query}`);
    setData(page);
    setDate(page.selected_date);
  }

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    });
  }, []);

  async function importWeather(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const result = await apiUpload<{ notice: string }>("/api/weather/import", file);
      setNotice(result.notice);
      await load(date);
    } catch (err) {
      setError(err instanceof Error ? err.message : "取り込みに失敗しました");
    }
  }

  return (
    <>
      <h1>気象データ</h1>
      <p className="lede">気象庁の時別 CSV を取り込み、走行記録と日時で関連付けます。</p>
      {notice ? <p className="notice">{notice}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {data ? (
        <>
          <section className="stat-grid">
            <article className="card">
              <h2>地点</h2>
              <p className="stat">{data.summary.location}</p>
            </article>
            <article className="card">
              <h2>件数</h2>
              <p className="stat">{data.summary.count} 時間</p>
            </article>
            <article className="card">
              <h2>期間</h2>
              <p className="meta">
                {data.summary.first && data.summary.last
                  ? `${data.summary.first} 〜 ${data.summary.last}`
                  : "—"}
              </p>
            </article>
          </section>
          <form className="panel stack" onSubmit={(event) => void importWeather(event)}>
            <label>
              CSV を指定する場合（省略時は {data.summary.default_csv}）
              <input type="file" accept=".csv" onChange={(event) => setFile(event.target.files?.[0])} />
            </label>
            <button type="submit">取り込む / 再取り込み</button>
          </form>
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              void load(date);
            }}
          >
            <label>
              表示する日
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <button type="submit">表示</button>
          </form>
          {data.rows.length ? (
            <table>
              <thead>
                <tr>
                  <th>時刻</th>
                  <th>気温</th>
                  <th>湿度</th>
                  <th>品質（気温 / 湿度）</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.observed_at}>
                    <td>{row.observed_at}</td>
                    <td>{row.temperature_c.toFixed(1)}℃</td>
                    <td>{row.humidity_pct.toFixed(0)}%</td>
                    <td>
                      {row.temperature_quality ?? "—"} / {row.humidity_quality ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty">この日の観測がありません。</p>
          )}
        </>
      ) : null}
      <StickyActions>
        <BackHome variant="button" />
      </StickyActions>
    </>
  );
}
