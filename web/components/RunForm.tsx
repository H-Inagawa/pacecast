"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BackHome } from "./BackHome";
import { DurationFields } from "./DurationFields";
import { apiGet, apiSend } from "../lib/api";
import { defaultDateTimeLocal } from "../lib/format";
import type { Run } from "../lib/types";

type Props = {
  title: string;
  runId?: number;
  variant?: "page" | "modal";
  onCancel?: () => void;
  onSuccess?: () => void;
};

type FormState = {
  started_at: string;
  distance_km: string;
  hours: number;
  minutes: number;
  seconds: number;
  avg_heart_rate: string;
  notes: string;
};

const emptyForm: FormState = {
  started_at: defaultDateTimeLocal(),
  distance_km: "5.00",
  hours: 0,
  minutes: 30,
  seconds: 0,
  avg_heart_rate: "",
  notes: "",
};

export function RunForm({ title, runId, variant = "page", onCancel, onSuccess }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) {
      return;
    }
    void apiGet<Run>(`/api/runs/${runId}`).then((run) => {
      setForm({
        started_at: run.started_at,
        distance_km: run.distance_km.toFixed(2),
        hours: run.hours,
        minutes: run.minutes,
        seconds: run.seconds,
        avg_heart_rate: run.avg_heart_rate == null ? "" : String(run.avg_heart_rate),
        notes: run.notes ?? "",
      });
    });
  }, [runId]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const payload = {
      started_at: form.started_at,
      distance_km: Number(form.distance_km),
      hours: form.hours,
      minutes: form.minutes,
      seconds: form.seconds,
      avg_heart_rate: form.avg_heart_rate ? Number(form.avg_heart_rate) : null,
      notes: form.notes,
    };
    try {
      if (runId) {
        await apiSend(`/api/runs/${runId}`, "PUT", payload);
      } else {
        await apiSend("/api/runs", "POST", payload);
      }
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/runs");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    }
  }

  const Heading = variant === "modal" ? "h2" : "h1";

  return (
    <>
      {variant === "page" ? <BackHome /> : null}
      <Heading id={variant === "modal" ? "run-form-title" : undefined}>{title}</Heading>
      {error ? <p className="error">{error}</p> : null}
      <form className="stack" onSubmit={(event) => void onSubmit(event)}>
        <label>
          走行日時
          <input
            type="datetime-local"
            value={form.started_at}
            onChange={(event) => setForm({ ...form, started_at: event.target.value })}
            required
          />
        </label>
        <label>
          走行距離（km）
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={form.distance_km}
            onChange={(event) => setForm({ ...form, distance_km: event.target.value })}
            required
          />
        </label>
        <DurationFields
          hours={form.hours}
          minutes={form.minutes}
          seconds={form.seconds}
          onChange={(part, value) => setForm({ ...form, [part]: value })}
        />
        <label>
          平均心拍数（任意）
          <input
            type="number"
            min="30"
            max="220"
            value={form.avg_heart_rate}
            onChange={(event) => setForm({ ...form, avg_heart_rate: event.target.value })}
          />
        </label>
        <label>
          メモ（任意）
          <input type="text" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </label>
        <div className="actions">
          <button type="submit">保存</button>
          <button
            type="button"
            className="button ghost"
            onClick={() => (onCancel ? onCancel() : router.push("/runs"))}
          >
            キャンセル
          </button>
        </div>
      </form>
    </>
  );
}
