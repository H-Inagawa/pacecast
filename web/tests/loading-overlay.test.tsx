import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoadingOverlay } from "../components/LoadingOverlay";
import { beginLoading, endLoading, LOADING_SHOW_DELAY_MS, resetLoadingForTests } from "../lib/loading";

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
});
