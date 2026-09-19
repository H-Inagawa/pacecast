export type AuthUserRow = {
  id: number;
  email: string;
  password_hash: string;
  email_verified: boolean;
  created_at: string;
};

export type EmailVerificationRow = {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};

export type PasswordResetRow = {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};

export type WeatherRow = {
  id: number;
  observed_at: string;
  location: string;
  temperature_c: number;
  humidity_pct: number;
  temperature_quality: number | null;
  humidity_quality: number | null;
  wind_ms: number | null;
  solar_wm2: number | null;
  wbgt_c: number | null;
  wbgt_method: string | null;
  station_id: string | null;
  source: string;
  imported_at: string;
};

export type ProfileRow = {
  id: number;
  auth_user_id: number | null;
  display_name: string | null;
  birthday: string | null;
  max_heart_rate: number | null;
  color_rows: boolean;
  row_color_mode: string;
  hr_low: number | null;
  hr_medium: number | null;
  hr_high: number | null;
  hr_race_5k: number | null;
  hr_race_10k: number | null;
  hr_race_half: number | null;
  hr_race_full: number | null;
  amedas_station_id: string | null;
  amedas_station_name: string | null;
  updated_at: string;
};

export type RunRow = {
  id: number;
  started_at: string;
  distance_km: number;
  duration_sec: number;
  avg_heart_rate: number | null;
  notes: string | null;
  amedas_station_id: string | null;
  amedas_station_name: string | null;
  auth_user_id: number | null;
  weather_observation_id: number | null;
  created_at: string;
  updated_at: string;
  weather?: WeatherRow | null;
};
