import { apiGet } from "./api";
import type { AmedasStation, Profile } from "./types";

/**
 * 設定プロフィールとアメダス地点一覧をまとめて取得する。
 */
export function fetchProfileAndStations(): Promise<[Profile, AmedasStation[]]> {
  return Promise.all([apiGet<Profile>("/api/profile"), apiGet<AmedasStation[]>("/api/amedas/stations")]);
}
