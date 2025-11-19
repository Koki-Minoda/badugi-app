import React from "react";

const CHIP_DENOMS = [
  { value: 500, label: "500", color: "bg-red-600 border-red-200 text-white" },
  { value: 100, label: "100", color: "bg-blue-600 border-blue-200 text-white" },
  { value: 25, label: "25", color: "bg-green-600 border-green-200 text-white" },
  { value: 5, label: "5", color: "bg-yellow-400 border-yellow-200 text-gray-900" },
  { value: 1, label: "1", color: "bg-slate-200 border-slate-400 text-gray-900" },
];

export function buildChipStack(amount = 0, maxChips = 6) {
  const chips = [];
  let remaining = Math.max(0, Math.floor(amount));
  CHIP_DENOMS.forEach((chipDef) => {
    if (remaining <= 0 || chips.length >= maxChips) return;
    const count = Math.min(3, Math.floor(remaining / chipDef.value));
    if (count <= 0) return;
    remaining -= count * chipDef.value;
    for (let i = 0; i < count && chips.length < maxChips; i += 1) {
      chips.push(chipDef);
    }
  });
  if (chips.length === 0) {
    chips.push({ value: 0, label: "0", color: "bg-gray-700 border-gray-500 text-white" });
  }
  return chips;
}

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
