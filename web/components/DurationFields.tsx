type Props = {
  hours: number;
  minutes: number;
  seconds: number;
  onChange: (part: "hours" | "minutes" | "seconds", value: number) => void;
};

function clamp(value: number, max: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(max, Math.max(0, Math.trunc(value)));
}

export function DurationFields({ hours, minutes, seconds, onChange }: Props) {
  return (
    <div className="duration-fields">
      <span className="duration-fields__label" id="duration-fields-label">
        走行時間
      </span>
      <div className="duration-row" role="group" aria-labelledby="duration-fields-label">
        <label className="duration-field">
          <input
            type="number"
            min={0}
            max={23}
            step={1}
            aria-label="時間"
            value={hours}
            onChange={(event) => onChange("hours", clamp(Number(event.target.value), 23))}
          />
          時間
        </label>
        <label className="duration-field">
          <input
            type="number"
            min={0}
            max={59}
            step={1}
            aria-label="分"
            value={minutes}
            onChange={(event) => onChange("minutes", clamp(Number(event.target.value), 59))}
          />
          分
        </label>
        <label className="duration-field">
          <input
            type="number"
            min={0}
            max={59}
            step={1}
            aria-label="秒"
            value={seconds}
            onChange={(event) => onChange("seconds", clamp(Number(event.target.value), 59))}
          />
          秒
        </label>
      </div>
    </div>
  );
}
