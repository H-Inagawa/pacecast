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

type AdvancedDraft = {
  maxHr: string;
  hrs: IntensityHrs;
  priorK: string;
  runStationInit: RunStationInit;
};

const RUN_STATION_INIT_HELP =
  "許可が取れない・測位できないときは設定地点に戻します。GPS の測位は「GPSで探す」と同じです。";

const INTENSITY_HELP = "初期値は最大心拍数からの算出です。必要なら個別に上書きできます。";

const PRIOR_K_HELP =
  "一般の WBGT 補正と、自分の記録から求めた補正の混ぜ方です。α = 有効件数 / (有効件数 + K)。K が小さいほど自分の記録を強く使います。K が大きいほど一般の補正に寄ります。未入力で保存すると 10 になります。ユーザー名・地点・誕生日とは別に保存します。";

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
  const [draft, setDraft] = useState<AdvancedDraft | null>(null);
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

  function setDraftHr(key: keyof IntensityHrs, value: string) {
    setDraft((current) =>
      current ? { ...current, hrs: { ...current.hrs, [key]: value ? Number(value) : null } } : current,
    );
  }

  function openAdvanced() {
    setDraft({
      maxHr,
      hrs: { ...hrs },
      priorK,
      runStationInit,
    });
    setAdvancedOpen(true);
  }

  function discardAdvanced() {
    setDraft(null);
    setAdvancedOpen(false);
  }

  function commitAdvanced() {
    if (!draft) {
      return;
    }
    if (!draft.maxHr && colorMode === "hr") {
      setColorMode("off");
    }
    setMaxHr(draft.maxHr);
    setHrs(draft.hrs);
    setPriorK(draft.priorK);
    setRunStationInit(draft.runStationInit);
    setDraft(null);
    setAdvancedOpen(false);
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
    if (!draft || !window.confirm("高度な設定をデフォルトに戻しますか？")) {
      return;
    }
    if (birthday) {
      const nextMax = maxHrFromAge(ageFromBirthday(birthday));
      setDraft({
        ...draft,
        maxHr: String(nextMax),
        hrs: suggestedHrs(nextMax),
        runStationInit: "profile",
        priorK: String(PERSONAL_PRIOR_K),
      });
      return;
    }
    setDraft({
      ...draft,
      maxHr: "",
      hrs: emptyHrs(),
      runStationInit: "profile",
      priorK: String(PERSONAL_PRIOR_K),
    });
  }

  useEffect(() => {
    if (!advancedOpen) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDraft(null);
        setAdvancedOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advancedOpen]);

  return (
    <div className="settings-page">
      <h1>{onboarding ? "ユーザー設定" : "設定"}</h1>
      {onboarding ? (
        <p className="lede">ユーザー名、アメダス地点、誕生日を入力すると、メイン画面へ進めます。</p>
      ) : null}
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

          <button type="button" className="button home-back settings-advanced-open" onClick={openAdvanced}>
            高度な設定
          </button>
          {advancedOpen && draft
            ? createPortal(
            <div className="modal-backdrop settings-backdrop" onClick={discardAdvanced} role="presentation">
              <div
                className="modal-panel settings-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="advanced-settings-title"
                onClick={(event) => event.stopPropagation()}
              >
                <ModalCloseButton onClick={discardAdvanced} />
                <h2 id="advanced-settings-title">高度な設定</h2>
                <div className="stack settings-modal__body">
                  <section className="settings-modal__section" aria-labelledby="advanced-max-hr">
                    <div className="settings-modal__field">
                      <h3 id="advanced-max-hr">最大心拍数</h3>
                      <input
                        type="number"
                        min="80"
                        max="230"
                        aria-labelledby="advanced-max-hr"
                        value={draft.maxHr}
                        onChange={(event) => {
                          const value = event.target.value;
                          setDraft((current) => (current ? { ...current, maxHr: value } : current));
                        }}
                        onBlur={() => {
                          if (draft.maxHr && draft.maxHr !== maxHr && window.confirm("強度別心拍数を変更しますか？")) {
                            setDraft((current) =>
                              current ? { ...current, hrs: suggestedHrs(Number(current.maxHr)) } : current,
                            );
                          }
                        }}
                      />
                    </div>
                  </section>
                  <section className="settings-modal__section settings-modal__section--spaced" aria-labelledby="advanced-run-station">
                    <h3 id="advanced-run-station">
                      <HelpTip label="走行記録を追加するときの初期地点" text={RUN_STATION_INIT_HELP} />
                    </h3>
                    <label className="choice">
                      <input
                        type="radio"
                        name="run-station-init"
                        checked={draft.runStationInit === "profile"}
                        onChange={() => setDraft((current) => (current ? { ...current, runStationInit: "profile" } : current))}
                      />
                      設定どおりのアメダスを出す
                    </label>
                    <label className="choice">
                      <input
                        type="radio"
                        name="run-station-init"
                        checked={draft.runStationInit === "gps"}
                        onChange={() => setDraft((current) => (current ? { ...current, runStationInit: "gps" } : current))}
                      />
                      GPS で近くのアメダスを探す
                    </label>
                  </section>
                  <section className="settings-modal__section settings-modal__section--spaced" aria-labelledby="advanced-intensity">
                    <h3 id="advanced-intensity">
                      <HelpTip label="強度別心拍数" text={INTENSITY_HELP} />
                    </h3>
                    <label>
                      低強度（60〜70%）
                      <input type="number" min="30" max="230" value={fieldValue(draft.hrs.low)} onChange={(event) => setDraftHr("low", event.target.value)} />
                    </label>
                    <label>
                      中強度（70〜80%）
                      <input type="number" min="30" max="230" value={fieldValue(draft.hrs.medium)} onChange={(event) => setDraftHr("medium", event.target.value)} />
                    </label>
                    <label>
                      高強度（80〜90%）
                      <input type="number" min="30" max="230" value={fieldValue(draft.hrs.high)} onChange={(event) => setDraftHr("high", event.target.value)} />
                    </label>
                  </section>
                  <section className="settings-modal__section settings-modal__section--spaced" aria-labelledby="advanced-race">
                    <h3 id="advanced-race">レースペース心拍数</h3>
                    <label>
                      5km（90〜100%）
                      <input type="number" min="30" max="230" value={fieldValue(draft.hrs.race_5k)} onChange={(event) => setDraftHr("race_5k", event.target.value)} />
                    </label>
                    <label>
                      10km（90〜95%）
                      <input type="number" min="30" max="230" value={fieldValue(draft.hrs.race_10k)} onChange={(event) => setDraftHr("race_10k", event.target.value)} />
                    </label>
                    <label>
                      ハーフマラソン（85〜92%）
                      <input type="number" min="30" max="230" value={fieldValue(draft.hrs.race_half)} onChange={(event) => setDraftHr("race_half", event.target.value)} />
                    </label>
                    <label>
                      フルマラソン（75〜88%）
                      <input type="number" min="30" max="230" value={fieldValue(draft.hrs.race_full)} onChange={(event) => setDraftHr("race_full", event.target.value)} />
                    </label>
                  </section>
                  <section className="settings-modal__section settings-modal__section--spaced" aria-labelledby="advanced-prior-k">
                    <div className="settings-modal__field">
                      <h3 id="advanced-prior-k">
                        <HelpTip label="個人記録の重み設定" text={PRIOR_K_HELP} />
                      </h3>
                      <input
                        aria-label="個人記録の重み設定"
                        type="number"
                        min="0.1"
                        max="1000"
                        step="0.1"
                        value={draft.priorK}
                        onChange={(event) => {
                          const value = event.target.value;
                          setDraft((current) => (current ? { ...current, priorK: value } : current));
                        }}
                      />
                    </div>
                  </section>
                  <div className="settings-modal__actions">
                    <button type="button" className="button home-back settings-modal__reset" onClick={resetAdvancedDefaults}>
                      デフォルト設定に戻す
                    </button>
                    <button type="button" className="button settings-modal__save" onClick={commitAdvanced}>
                      保存する
                    </button>
                  </div>
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
    </div>
  );
}
