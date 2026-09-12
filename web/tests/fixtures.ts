import type { AmedasStation, PredictResult, Profile } from "../lib/types";

export const profileFixture: Profile = {
  display_name: "あい",
  birthday: "1995-09-12",
  age: 31,
  max_heart_rate: 189,
  color_rows: true,
  color_rows_effective: true,
  row_color_mode: "hr",
  intensities: {
    low: 123,
    medium: 142,
    high: 161,
    race_5k: 180,
    race_10k: 174,
    race_half: 166,
    race_full: 151,
  },
  suggested: {
    low: 123,
    medium: 142,
    high: 161,
    race_5k: 180,
    race_10k: 174,
    race_half: 166,
    race_full: 151,
  },
  custom_intensities: [
    { key: "low", label: "低強度（60〜70%）", target_hr: 123 },
    { key: "medium", label: "中強度（70〜80%）", target_hr: 142 },
    { key: "high", label: "高強度（80〜90%）", target_hr: 161 },
  ],
  race_options: [],
  amedas_station_id: "44071",
  amedas_station_name: "練馬",
  wbgt_ready_count: 39,
  run_count: 39,
};

export const stationsFixture: AmedasStation[] = [
  { station_id: "11001", name: "宗谷岬", latitude: 45.5, longitude: 141.9 },
  { station_id: "44071", name: "練馬", latitude: 35.74, longitude: 139.65 },
  { station_id: "44132", name: "東京", latitude: 35.69, longitude: 139.75 },
];

export const predictResultFixture: PredictResult = {
  predicted_pace_sec_per_km: 329,
  predicted_duration_sec: 1644,
  predicted_heart_rate: null,
  confidence: "high",
  sample_count: 39,
  near_count: 18,
  intensity_key: "medium",
  intensity_label: "中強度（70〜80%）",
  used_runs: [],
  condition: null,
  weather_distance_help: "差の説明",
};
