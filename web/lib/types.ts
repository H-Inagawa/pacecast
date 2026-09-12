export type WeatherBrief = {
  temperature_c: number;
  humidity_pct: number;
  observed_at: string;
  wbgt_c: number | null;
};

export type Run = {
  id: number;
  started_at: string;
  distance_km: number;
  duration_sec: number;
  hours: number;
  minutes: number;
  seconds: number;
  avg_heart_rate: number | null;
  notes: string | null;
  pace_sec_per_km: number;
  weather: WeatherBrief | null;
  hr_zone: "low" | "medium" | "high" | null;
  weather_zone: "too_cold" | "cold" | "comfort" | "hot" | "too_hot" | "none" | null;
  amedas_station_id: string | null;
  amedas_station_name: string | null;
};

export type IntensityHrs = {
  low: number | null;
  medium: number | null;
  high: number | null;
  race_5k: number | null;
  race_10k: number | null;
  race_half: number | null;
  race_full: number | null;
};

export type Intensity = {
  key: string;
  label: string;
  target_hr: number | null;
  distance_km?: number | null;
};

export type Profile = {
  display_name: string | null;
  birthday: string | null;
  age: number | null;
  max_heart_rate: number | null;
  color_rows: boolean;
  color_rows_effective: boolean;
  row_color_mode: "hr" | "wbgt" | "off";
  intensities: IntensityHrs;
  suggested: IntensityHrs;
  custom_intensities: Intensity[];
  race_options: Intensity[];
  amedas_station_id: string;
  amedas_station_name: string;
  wbgt_ready_count: number;
  run_count: number;
};

export type AmedasStation = {
  station_id: string;
  name: string;
  latitude: number;
  longitude: number;
};

export type SimilarRun = {
  record_id: number;
  started_at: string;
  distance_km: number;
  duration_sec: number;
  pace_sec_per_km: number;
  avg_heart_rate: number | null;
  temperature_c: number;
  humidity_pct: number;
  wbgt_c: number;
  weather_distance: number;
  wbgt_delta: number;
};

export type PredictResult = {
  predicted_pace_sec_per_km: number;
  predicted_duration_sec: number;
  predicted_heart_rate: number | null;
  confidence: string;
  sample_count: number;
  near_count: number;
  intensity_key: string;
  intensity_label: string;
  used_runs: SimilarRun[];
  condition: {
    observed_at: string;
    temperature_c: number;
    humidity_pct: number;
    location_label: string;
    wind_ms?: number | null;
    solar_wm2?: number | null;
    wbgt_c?: number | null;
  } | null;
  weather_distance_help: string;
};
