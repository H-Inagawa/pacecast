"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BackHome } from "../../components/BackHome";
import { StickyActions } from "../../components/StickyActions";
import { apiGet, apiSend } from "../../lib/api";
import { ageFromBirthday, emptyHrs, maxHrFromAge, suggestedHrs } from "../../lib/heartRate";
import { StationPicker } from "../../components/StationPicker";
import type { AmedasStation, IntensityHrs, Profile } from "../../lib/types";
import { normalizeRowColorMode, type RowColorMode } from "../../lib/weatherZone";

function fieldValue(value: number | null): string {
  return value == null ? "" : String(value);
}

export default function SettingsPage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [originalBirthday, setOriginalBirthday] = useState("");
  const [originalMaxHr, setOriginalMaxHr] = useState("");
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [maxHr, setMaxHr] = useState("");
  const [colorMode, setColorMode] = useState<RowColorMode>("hr");
  const [hrs, setHrs] = useState<IntensityHrs>(emptyHrs());
  const [raceOpen, setRaceOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [age, setAge] = useState<number | null>(null);
  const [stations, setStations] = useState<AmedasStation[]>([]);
  const [stationId, setStationId] = useState("44132");
  const [wbgtReady, setWbgtReady] = useState(0);
  const [runCount, setRunCount] = useState(0);

  useEffect(() => {
    void Promise.all([apiGet<Profile>("/api/profile"), apiGet<AmedasStation[]>("/api/amedas/stations")]).then(
      ([profile, amedasStations]) => {
        setName(profile.display_name ?? "");
        setBirthday(profile.birthday ?? "");
        setOriginalBirthday(profile.birthday ?? "");
        setMaxHr(profile.max_heart_rate == null ? "" : String(profile.max_heart_rate));
        setOriginalMaxHr(profile.max_heart_rate == null ? "" : String(profile.max_heart_rate));
        setColorMode(normalizeRowColorMode(profile.row_color_mode, profile.color_rows ? "hr" : "off"));
        setHrs(profile.intensities);
        setAge(profile.age);
        setStationId(profile.amedas_station_id);
        setWbgtReady(profile.wbgt_ready_count);
        setRunCount(profile.run_count);
        setStations(amedasStations);
        setLoaded(true);
      },
    );
  }, []);

  function setHr(key: keyof IntensityHrs, value: string) {
    setHrs({ ...hrs, [key]: value ? Number(value) : null });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const nextMax = maxHr ? Number(maxHr) : null;
    const nextHrs = { ...hrs };

    const nextMode: RowColorMode = nextMax == null && colorMode === "hr" ? "off" : colorMode;
    if (nextMode !== colorMode) {
      setColorMode(nextMode);
    }

    try {
      const saved = await apiSend<Profile>("/api/profile", "PUT", {
        display_name: name,
        birthday: birthday || null,
        max_heart_rate: nextMax,
        row_color_mode: nextMode,
        color_rows: nextMode === "hr",
        intensities: nextHrs,
        amedas_station_id: stationId,
      });
      setMaxHr(saved.max_heart_rate == null ? "" : String(saved.max_heart_rate));
      setOriginalMaxHr(saved.max_heart_rate == null ? "" : String(saved.max_heart_rate));
      setOriginalBirthday(saved.birthday ?? "");
      setColorMode(normalizeRowColorMode(saved.row_color_mode, saved.color_rows ? "hr" : "off"));
      setHrs(saved.intensities);
      setAge(saved.age);
      setStationId(saved.amedas_station_id);
      setWbgtReady(saved.wbgt_ready_count);
      setRunCount(saved.run_count);
      setNotice(
        saved.run_count
          ? `設定を保存しました（WBGT 付きの走行 ${saved.wbgt_ready_count} / ${saved.run_count} 件）`
          : "設定を保存しました",
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    }
  }

  const colorLocked = !maxHr;

  return (
    <>
      <h1>設定</h1>
      <p className="lede">ユーザー情報と、予測・記録色分けに使う設定を保存します。</p>
      {notice ? <p className="notice">{notice}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {loaded ? (
        <form id="settings-form" className="stack" onSubmit={(event) => void onSubmit(event)}>
          <label>
            ユーザー名
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <StationPicker stations={stations} value={stationId} onChange={setStationId} />
          <p className="meta">
            気象の取得と推定 WBGT に使います。未設定時は東京（44132）。観測所番号順です。
            {runCount ? ` WBGT 付きの走行: ${wbgtReady} / ${runCount} 件` : ""}
          </p>
          <label>
            誕生日
            <input
              type="date"
              value={birthday}
              onChange={(event) => {
                const value = event.target.value;
                setBirthday(value);
                if (value && value !== originalBirthday && window.confirm("最大心拍数を変更しますか？")) {
                  const nextAge = ageFromBirthday(value);
                  const nextMax = maxHrFromAge(nextAge);
                  setMaxHr(String(nextMax));
                  setHrs(suggestedHrs(nextMax));
                  setAge(nextAge);
                }
              }}
            />
          </label>
          {birthday ? (
            <p className="meta">
              満年齢: {ageFromBirthday(birthday)} 歳（最大心拍の目安 {maxHrFromAge(ageFromBirthday(birthday))} bpm）
            </p>
          ) : age != null ? (
            <p className="meta">満年齢: {age} 歳</p>
          ) : null}
          <label>
            最大心拍数
            <input
              type="number"
              min="80"
              max="230"
              value={maxHr}
              onChange={(event) => {
                setMaxHr(event.target.value);
                if (!event.target.value && colorMode === "hr") {
                  setColorMode("off");
                }
              }}
              onBlur={() => {
                if (maxHr && maxHr !== originalMaxHr && window.confirm("強度別心拍数を変更しますか？")) {
                  setHrs(suggestedHrs(Number(maxHr)));
                }
              }}
            />
          </label>
          <p className="meta">走行記録の色分け</p>
          <label className="choice">
            <input
              type="radio"
              name="row-color-mode"
              checked={colorMode === "hr"}
              disabled={colorLocked}
              onChange={() => setColorMode("hr")}
            />
            心拍{colorLocked ? "（最大心拍数が未入力のため選べません）" : ""}
          </label>
          <label className="choice">
            <input
              type="radio"
              name="row-color-mode"
              checked={colorMode === "wbgt"}
              onChange={() => setColorMode("wbgt")}
            />
            気象条件（WBGT）
          </label>
          <label className="choice">
            <input
              type="radio"
              name="row-color-mode"
              checked={colorMode === "off"}
              onChange={() => setColorMode("off")}
            />
            色分けしない
          </label>

          <h2>強度別心拍数</h2>
          <p className="meta">初期値は最大心拍数からの算出です。必要なら個別に上書きできます。</p>
          <label>
            低強度（60〜70%）
            <input type="number" min="30" max="230" value={fieldValue(hrs.low)} onChange={(event) => setHr("low", event.target.value)} />
          </label>
          <label>
            中強度（70〜80%）
            <input type="number" min="30" max="230" value={fieldValue(hrs.medium)} onChange={(event) => setHr("medium", event.target.value)} />
          </label>
          <label>
            高強度（80〜90%）
            <input type="number" min="30" max="230" value={fieldValue(hrs.high)} onChange={(event) => setHr("high", event.target.value)} />
          </label>
          <div className="panel">
            <div className="section-head">
              <h2>レースペース</h2>
              <button type="button" className="button secondary" onClick={() => setRaceOpen((current) => !current)}>
                {raceOpen ? "閉じる" : "開く"}
              </button>
            </div>
            {raceOpen ? (
              <div className="stack">
                <label>
                  5km（90〜100%）
                  <input type="number" min="30" max="230" value={fieldValue(hrs.race_5k)} onChange={(event) => setHr("race_5k", event.target.value)} />
                </label>
                <label>
                  10km（90〜95%）
                  <input type="number" min="30" max="230" value={fieldValue(hrs.race_10k)} onChange={(event) => setHr("race_10k", event.target.value)} />
                </label>
                <label>
                  ハーフマラソン（85〜92%）
                  <input type="number" min="30" max="230" value={fieldValue(hrs.race_half)} onChange={(event) => setHr("race_half", event.target.value)} />
                </label>
                <label>
                  フルマラソン（75〜88%）
                  <input type="number" min="30" max="230" value={fieldValue(hrs.race_full)} onChange={(event) => setHr("race_full", event.target.value)} />
                </label>
              </div>
            ) : null}
          </div>
        </form>
      ) : (
        <p className="empty">読み込み中...</p>
      )}
      <StickyActions>
        <button type="submit" className="button action-lg" form="settings-form" disabled={!loaded}>
          保存
        </button>
        <BackHome variant="button" />
      </StickyActions>
    </>
  );
}
