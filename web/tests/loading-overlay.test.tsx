import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoadingOverlay } from "../components/LoadingOverlay";
import { beginLoading, endLoading, LOADING_SHOW_DELAY_MS, resetLoadingForTests, setLoadingCancel, setLoadingMessage } from "../lib/loading";

describe("LoadingOverlay", () => {
  afterEach(() => {
    resetLoadingForTests();
    vi.useRealTimers();
  });

  it("少し待ってから処理中のスピナーを出す", async () => {
    vi.useFakeTimers();
    render(<LoadingOverlay />);

    act(() => {
      beginLoading();
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(LOADING_SHOW_DELAY_MS);
    });

    expect(screen.getByRole("status")).toHaveTextContent("処理中");

    act(() => {
      endLoading();
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("短い待ちでは出さない", async () => {
    vi.useFakeTimers();
    render(<LoadingOverlay />);

    act(() => {
      beginLoading();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LOADING_SHOW_DELAY_MS - 20);
    });
    act(() => {
      endLoading();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(40);
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("検索の中止ボタンを押すと処理を止める", async () => {
    vi.useFakeTimers();
    const stop = vi.fn();
    render(<LoadingOverlay />);
    act(() => {
      beginLoading();
      setLoadingMessage("コース検索中です...(10% / 合格ルート: 0件)");
      setLoadingCancel(stop);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LOADING_SHOW_DELAY_MS);
    });
    fireEvent.click(screen.getByRole("button", { name: "検索を中止" }));
    expect(stop).toHaveBeenCalledOnce();
  });
});
