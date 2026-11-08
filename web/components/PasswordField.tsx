"use client";

import { useId, useState } from "react";

type PasswordFieldProps = {
  label: string;
  name: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  minLength?: number;
  required?: boolean;
};

export function PasswordField({
  label,
  name,
  autoComplete,
  value,
  onChange,
  minLength,
  required,
}: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-block">
      <label htmlFor={id}>{label}</label>
      <span className="password-field">
        <input
          id={id}
          type={visible ? "text" : "password"}
          name={name}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          minLength={minLength}
          required={required}
        />
        <button
          type="button"
          className="password-toggle"
          aria-label={visible ? "パスワードを隠す" : "パスワードを表示する"}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          <EyeIcon hidden={visible} />
        </button>
      </span>
    </div>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M2.2 12S5.8 6.2 12 6.2 21.8 12 21.8 12 18.2 17.8 12 17.8 2.2 12 2.2 12z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" />
      {hidden ? <path d="M5 19 L19 5" stroke="currentColor" strokeWidth="1.8" /> : null}
    </svg>
  );
}
