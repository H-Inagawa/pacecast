/**
 * catch した値から表示用メッセージを取り出す。
 */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
