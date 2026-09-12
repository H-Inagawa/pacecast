"use client";

import { useState } from "react";

type Props = {
  label: string;
  text: string;
  ariaLabel?: string;
};

export function HelpTip({ label, text, ariaLabel }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <span className={`help${open ? " open" : ""}`}>
      {label}
      <button
        type="button"
        className="help-button"
        aria-label={ariaLabel ?? `${label}の説明`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        i
      </button>
      <span className="help-pop">{text}</span>
    </span>
  );
}

type DistanceHelpProps = {
  text: string;
};

export function WeatherDistanceHelp({ text }: DistanceHelpProps) {
  return <HelpTip label="気象距離" text={text} ariaLabel="気象距離の説明" />;
}

export const WBGT_HELP_TEXT =
  "WBGT（湿球黒球温度）は暑さの指数です。気温・湿度・風速・日射から推定しています。値が高いほど暑い条件です。環境省の実況推定と同じ式を使っています。";

