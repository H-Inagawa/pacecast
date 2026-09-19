-- 既存プロジェクトへ走行追加の初期地点設定を足す（#49）。
-- Supabase の SQL Editor に貼って Run する。

alter table user_profiles
  add column if not exists run_station_init text not null default 'profile';
