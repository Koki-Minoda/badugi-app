// src/components/Card.jsx
import React from "react";

export default function Card({ value, hidden, selected, onClick, folded }) {
  if (hidden || folded) {
    return (
      <div
        className={`w-16 h-24 rounded-lg shadow-lg border-4 border-yellow-500 flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-800 relative overflow-hidden ${folded ? "opacity-50" : ""}`}
      >
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-6 gap-1 opacity-20">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="w-2 h-2 bg-yellow-400 rounded-full mx-auto my-auto" />
          ))}
        </div>
        <div className="absolute w-10 h-10 rounded-full border-2 border-yellow-400 flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-yellow-500 shadow-inner" />
        </div>
      </div>
    );
  }

  const suit = value.slice(-1);
  const rank = value.slice(0, -1);
  let color = "text-black";
  if (suit === "♥") color = "text-red-600";
  if (suit === "♦") color = "text-blue-600";
  if (suit === "♣") color = "text-green-600";

  return (
    <div onClick={onClick} className={`w-16 h-24 bg-white rounded-lg shadow-md border flex items-center justify-center font-bold text-lg cursor-pointer ${selected ? "border-red-500 border-4" : "border"}`}>
      <span className={color}>
        {rank}{suit}
      </span>
    </div>
  );
}
