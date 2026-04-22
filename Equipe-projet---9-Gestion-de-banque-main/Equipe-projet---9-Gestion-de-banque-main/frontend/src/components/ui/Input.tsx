import React from "react";

type InputProps = {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "password" | "number";
  name?: string;
  autoComplete?: string;
};

export default function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  name,
  autoComplete,
}: InputProps) {
  return (
    <label className="block">
      {label ? (
        <span className="mb-1.5 block" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--t3)" }}>
          {label}
        </span>
      ) : null}
      <input
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="lb-input"
      />
    </label>
  );
}
