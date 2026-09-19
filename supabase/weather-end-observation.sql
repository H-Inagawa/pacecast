-- 既存プロジェクトへ走行終了時刻の気象 FK を足す（#48）。
-- Supabase の SQL Editor に貼って Run する。

alter table running_records
  add column if not exists weather_end_observation_id integer references weather_observations (id) on delete set null;

create index if not exists ix_runs_weather_end_id on running_records (weather_end_observation_id);
