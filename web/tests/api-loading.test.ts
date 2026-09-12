import { afterEach, describe, expect, it, vi } from "vitest";
import { apiGet, apiSend } from "../lib/api";
import { getLoadingCount, resetLoadingForTests } from "../lib/loading";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, ng) => {
    resolve = ok;
    reject = ng;
  });
  return { promise, resolve, reject };
}

describe("api loading", () => {
  afterEach(() => {
    resetLoadingForTests();
    vi.unstubAllGlobals();
  });

  it("通信中は件数を増やし、終わると戻す", async () => {
    const gate = deferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => gate.promise),
    );

    const pending = apiGet("/api/profile");
    expect(getLoadingCount()).toBe(1);

    gate.resolve({
      ok: true,
      json: async () => ({ display_name: "あい" }),
    } as Response);

    await pending;
    expect(getLoadingCount()).toBe(0);
  });

  it("失敗しても件数を戻す", async () => {
    const gate = deferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => gate.promise),
    );

    const pending = apiSend("/api/predict", "POST", {});
    expect(getLoadingCount()).toBe(1);

    gate.resolve({
      ok: false,
      json: async () => ({ detail: "予測に失敗しました" }),
    } as Response);

    await expect(pending).rejects.toThrow("予測に失敗しました");
    expect(getLoadingCount()).toBe(0);
  });
});
