import React from "react";

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
};

export default function Button({
  children,
  onClick,
  type = "button",
  disabled,
  variant = "primary",
  className,
}: ButtonProps) {
  const cls =
    variant === "primary"
      ? "lb-btn lb-btn-primary"
      : variant === "danger"
        ? "lb-btn lb-btn-primary"
        : "lb-btn lb-btn-ghost";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[cls, className ?? ""].join(" ")}
      style={variant === "danger" ? { background: "#DC2626" } : undefined}
    >
      {children}
    </button>
  );
}
