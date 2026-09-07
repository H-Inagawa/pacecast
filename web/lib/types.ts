export type WeatherBrief = {
  temperature_c: number;
  humidity_pct: number;
  observed_at: string;
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
};

export type HomeData = {
  run_count: number;
  total_distance: number;
  recent_runs: Run[];
  display_name: string | null;
  color_rows: boolean;
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
  intensities: IntensityHrs;
  suggested: IntensityHrs;
  custom_intensities: Intensity[];
  race_options: Intensity[];
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
  weather_distance: number;
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
  } | null;
  weather_distance_help: string;
};

export type WeatherPage = {
  summary: {
    count: number;
    first: string | null;
    last: string | null;
    location: string;
    default_csv: string;
  };
  selected_date: string;
  rows: {
    observed_at: string;
    temperature_c: number;
    humidity_pct: number;
    temperature_quality: number | null;
    humidity_quality: number | null;
  }[];
};
