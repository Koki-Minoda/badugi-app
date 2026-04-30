import React from "react";
import { buildChipStack } from "./chipStackUtils.js";

export default function ChipStackIcons({
  amount,
  maxChips = 6,
  sizeClass = "w-6 h-6",
  className = "",
  overlapPx = 6,
  orientation = "line", // stack | line
}) {
  const chips = buildChipStack(amount, maxChips);
  const isStack = orientation === "stack";
  return (
    <div
      className={`${isStack ? "flex flex-col items-center" : "flex items-center -space-x-1"} ${className}`}
    >
      {(isStack ? chips.slice().reverse() : chips).map((chip, idx) => (
        <div
          key={`chip-${idx}-${chip.value}`}
          className={`${sizeClass} rounded-full border-2 text-[10px] font-bold flex items-center justify-center shadow ${chip.color}`}
          style={
            isStack && idx !== 0
              ? {
                  marginTop: -Math.abs(overlapPx),
                }
              : undefined
          }
        >
          {chip.label}
        </div>
      ))}
    </div>
  );
}
