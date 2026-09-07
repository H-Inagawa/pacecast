type Props = {
  hours: number;
  minutes: number;
  seconds: number;
  onChange: (part: "hours" | "minutes" | "seconds", value: number) => void;
};

function options(max: number) {
  return Array.from({ length: max + 1 }, (_, value) => value);
}

export function DurationFields({ hours, minutes, seconds, onChange }: Props) {
  return (
    <label>
      走行時間
      <div className="duration-row">
        <span className="duration-field">
          <select value={hours} onChange={(event) => onChange("hours", Number(event.target.value))}>
            {options(23).map((value) => (
              <option key={value} value={value}>
                {String(value).padStart(2, "0")}
              </option>
            ))}
          </select>
          時
        </span>
        <span className="duration-field">
          <select value={minutes} onChange={(event) => onChange("minutes", Number(event.target.value))}>
            {options(59).map((value) => (
              <option key={value} value={value}>
                {String(value).padStart(2, "0")}
              </option>
            ))}
          </select>
          分
        </span>
        <span className="duration-field">
          <select value={seconds} onChange={(event) => onChange("seconds", Number(event.target.value))}>
            {options(59).map((value) => (
              <option key={value} value={value}>
                {String(value).padStart(2, "0")}
              </option>
            ))}
          </select>
          秒
        </span>
      </div>
    </label>
  );
}
