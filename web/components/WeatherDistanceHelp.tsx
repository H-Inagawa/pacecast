"use client";

import { useState } from "react";

type Props = {
  text: string;
};

export function WeatherDistanceHelp({ text }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <span className={`help${open ? " open" : ""}`}>
      気象距離
      <button
        type="button"
        className="help-button"
        aria-label="気象距離の説明"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        i
      </button>
      <span className="help-pop">{text}</span>
    </span>
  );
}
