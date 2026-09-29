-- 個人 WBGT 補正の重み K（#56）。未設定は 10。
-- Supabase の SQL Editor に貼って Run する。

alter table user_profiles
  add column if not exists personal_prior_k double precision not null default 10;
