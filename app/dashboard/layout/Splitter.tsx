"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import "./Splitter.css";

export function Splitter({
  axis,
  label,
  onPointerDown,
}: {
  axis: "x" | "y";
  label: string;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      className={`splitter splitter-${axis}`}
      aria-label={label}
      onPointerDown={onPointerDown}
    />
  );
}
