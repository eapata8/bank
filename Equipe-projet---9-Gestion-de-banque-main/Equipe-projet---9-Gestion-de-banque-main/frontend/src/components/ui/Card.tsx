import React from "react";

export default function Card({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={["lb-card p-6 md:p-7", className ?? ""].join(" ")} style={style}>
      {children}
    </div>
  );
}
