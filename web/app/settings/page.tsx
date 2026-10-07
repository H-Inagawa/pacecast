"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { BackHome } from "../../components/BackHome";
import { HelpTip } from "../../components/WeatherDistanceHelp";
import { ModalCloseButton } from "../../components/ModalCloseButton";
import { StickyActions } from "../../components/StickyActions";
import { apiGet, apiSend } from "../../lib/api";
import { ageFromBirthday, emptyHrs, maxHrFromAge, suggestedHrs } from "../../lib/heartRate";
import { StationPicker } from "../../components/StationPicker";
import { PERSONAL_PRIOR_K, normalizePersonalPriorK } from "../../lib/personalPredict";
import { normalizeRunStationInit, type RunStationInit } from "../../lib/run-station-init";
import type { AmedasStation, IntensityHrs, Profile } from "../../lib/types";
import { normalizeRowColorMode, type RowColorMode } from "../../lib/weatherZone";

const PRIOR_K_HELP =
  "一般の WBGT 補正と、自分の記録から求めた補正の混ぜ方です。α = 有効件数 / (有効件数 + K)。K が小さいほど自分の記録を強く使います。K が大きいほど一般の補正に寄ります。未設定は 10 です。";

const STATION_HELP =
  "気象の取得と推定 WBGT に使います。未設定時は東京（44132）。都道府県で絞り、観測所番号順です。「GPSで探す」は HTTPS か http://127.0.0.1 で使えます。";

const COLOR_MODE_LABEL: Record<RowColorMode, string> = {
  hr: "心拍",
  wbgt: "気象条件（WBGT）",
  off: "色分けしない",
};

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
  const [priorK, setPriorK] = useState(String(PERSONAL_PRIOR_K));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [age, setAge] = useState<number | null>(null);
  const [stations, setStations] = useState<AmedasStation[]>([]);
  const [stationId, setStationId] = useState("44132");
  const [runStationInit, setRunStationInit] = useState<RunStationInit>("profile");
  const [onboarding, setOnboarding] = useState(false);

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
        setPriorK(String(normalizePersonalPriorK(profile.personal_prior_k)));
        setAge(profile.age);
        setStationId(profile.amedas_station_id);
        setRunStationInit(normalizeRunStationInit(profile.run_station_init));
        setStations(amedasStations);
        setOnboarding(!profile.onboarding_complete);
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
    if (!name.trim() || !birthday || !stationId) {
      setError("ユーザー名、アメダス地点、誕生日を入力してください");
      return;
    }

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
        run_station_init: runStationInit,
        personal_prior_k: normalizePersonalPriorK(priorK === "" ? null : Number(priorK)),
      });
      setMaxHr(saved.max_heart_rate == null ? "" : String(saved.max_heart_rate));
      setOriginalMaxHr(saved.max_heart_rate == null ? "" : String(saved.max_heart_rate));
      setOriginalBirthday(saved.birthday ?? "");
      setColorMode(normalizeRowColorMode(saved.row_color_mode, saved.color_rows ? "hr" : "off"));
      setHrs(saved.intensities);
      setPriorK(String(normalizePersonalPriorK(saved.personal_prior_k)));
      setAge(saved.age);
      setStationId(saved.amedas_station_id);
      setRunStationInit(normalizeRunStationInit(saved.run_station_init));
      setOnboarding(!saved.onboarding_complete);
      if (onboarding && saved.onboarding_complete) {
        router.push("/");
        router.refresh();
        return;
      }
      setNotice("設定を保存しました");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    }
  }

  const colorLocked = !maxHr;

  function resetAdvancedDefaults() {
    if (!window.confirm("高度な設定をデフォルトに戻しますか？")) {
      return;
    }
    if (birthday) {
      const nextAge = ageFromBirthday(birthday);
      const nextMax = maxHrFromAge(nextAge);
      setMaxHr(String(nextMax));
      setHrs(suggestedHrs(nextMax));
      setAge(nextAge);
    } else {
      setMaxHr("");
      setHrs(emptyHrs());
      if (colorMode === "hr") {
        setColorMode("off");
      }
    }
    setRunStationInit("profile");
    setPriorK(String(PERSONAL_PRIOR_K));
  }

  useEffect(() => {
    if (!advancedOpen) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAdvancedOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advancedOpen]);

  return (
    <>
      <h1>{onboarding ? "ユーザー設定" : "設定"}</h1>
      <p className="lede">
        {onboarding
          ? "ユーザー名、アメダス地点、誕生日を入力すると、メイン画面へ進めます。"
          : "ユーザー情報と、予測・記録色分けに使う設定を保存します。"}
      </p>
      {notice ? <p className="notice">{notice}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {loaded ? (
        <form id="settings-form" className="stack" onSubmit={(event) => void onSubmit(event)}>
          <label>
            ユーザー名
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <StationPicker
            stations={stations}
            value={stationId}
            onChange={setStationId}
            allowGps
            helpText={STATION_HELP}
            onGpsMessage={(message, kind) => {
              if (kind === "error") {
                setNotice(null);
                setError(message);
                return;
              }
              setError(null);
              setNotice(message);
            }}
          />
          <label>
            誕生日
            <input
              type="date"
              value={birthday}
              required
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
          <section className="settings-card" aria-label="走行記録の色分け">
            <h2>走行記録の色分け</h2>
            {colorOpen ? (
              <>
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
              </>
            ) : (
              <p className="settings-card__value">{COLOR_MODE_LABEL[colorMode]}</p>
            )}
            <button type="button" className="button" onClick={() => setColorOpen((open) => !open)}>
              {colorOpen ? "閉じる" : "設定する"}
            </button>
          </section>

          <button type="button" className="button home-back settings-advanced-open" onClick={() => setAdvancedOpen(true)}>
            高度な設定
          </button>
          {advancedOpen
            ? createPortal(
            <div className="modal-backdrop settings-backdrop" onClick={() => setAdvancedOpen(false)} role="presentation">
              <div
                className="modal-panel settings-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="advanced-settings-title"
                onClick={(event) => event.stopPropagation()}
              >
                <ModalCloseButton onClick={() => setAdvancedOpen(false)} />
                <h2 id="advanced-settings-title">高度な設定</h2>
                <div className="stack settings-modal__body">
                  <section className="settings-modal__section" aria-labelledby="advanced-max-hr">
                    <h3 id="advanced-max-hr">最大心拍数</h3>
                    <input
                      type="number"
                      min="80"
                      max="230"
                      aria-labelledby="advanced-max-hr"
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
                  </section>
                  <section className="settings-modal__section settings-modal__section--spaced" aria-labelledby="advanced-run-station">
                    <h3 id="advanced-run-station">走行記録を追加するときの初期地点</h3>
                    <label className="choice">
                      <input
                        type="radio"
                        name="run-station-init"
                        checked={runStationInit === "profile"}
                        onChange={() => setRunStationInit("profile")}
                      />
                      設定どおりのアメダスを出す
                    </label>
                    <label className="choice">
                      <input
                        type="radio"
                        name="run-station-init"
                        checked={runStationInit === "gps"}
                        onChange={() => setRunStationInit("gps")}
                      />
                      GPS で近くのアメダスを探す
                    </label>
                    <p className="meta">許可が取れない・測位できないときは設定地点に戻します。GPS の測位は「GPSで探す」と同じです。</p>
                  </section>
                  <section className="settings-modal__section settings-modal__section--spaced" aria-labelledby="advanced-intensity">
                    <h3 id="advanced-intensity">強度別心拍数</h3>
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
                  </section>
                  <section className="settings-modal__section settings-modal__section--spaced" aria-labelledby="advanced-race">
                    <h3 id="advanced-race">レースペース心拍数</h3>
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
                  </section>
                  <section className="settings-modal__section settings-modal__section--spaced" aria-labelledby="advanced-prior-k">
                    <h3 id="advanced-prior-k">
                      <HelpTip label="個人記録の重み設定" text={PRIOR_K_HELP} />
                    </h3>
                    <input
                      aria-label="個人記録の重み設定"
                      type="number"
                      min="0.1"
                      max="1000"
                      step="0.1"
                      value={priorK}
                      onChange={(event) => setPriorK(event.target.value)}
                    />
                    <p className="meta">未入力で保存すると 10 になります。ユーザー名・地点・誕生日とは別に保存します。</p>
                  </section>
                  <button type="button" className="button home-back settings-modal__reset" onClick={resetAdvancedDefaults}>
                    デフォルト設定に戻す
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
            : null}
        </form>
      ) : (
        <p className="empty">読み込み中...</p>
      )}
      <StickyActions>
        <button type="submit" className="button action-lg" form="settings-form" disabled={!loaded}>
          {onboarding ? "保存して始める" : "保存"}
        </button>
        {onboarding ? null : <BackHome variant="button" />}
      </StickyActions>
    </>
  );
}
