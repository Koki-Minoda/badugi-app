// src/utils/position.js
export function getPositionStyle(index, selfIndex = 0, totalPlayers = 6) {
  // Put selfIndex at bottom center; positions arranged clockwise
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  const radiusX = 350;
  const radiusY = 220;

  const posIndex = (index - selfIndex + totalPlayers) % totalPlayers;
  const angle = (posIndex / totalPlayers) * 2 * Math.PI + Math.PI / 2; // posIndex 0 -> bottom (π/2)

  const x = centerX + radiusX * Math.cos(angle);
  const y = centerY + radiusY * Math.sin(angle);

  return { left: `${x}px`, top: `${y}px`, transform: "translate(-50%,-50%)" };
}
