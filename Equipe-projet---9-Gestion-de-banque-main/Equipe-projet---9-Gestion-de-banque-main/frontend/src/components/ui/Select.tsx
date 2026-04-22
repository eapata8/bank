import React from "react";

type SelectOption = { value: string; label: string };

type SelectProps = {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  options: SelectOption[];
};

export default function Select({ label, value, onChange, options }: SelectProps) {
  return (
    <label className="block">
      {label ? (
        <span className="mb-1.5 block" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--t3)" }}>
          {label}
        </span>
      ) : null}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="lb-select"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
