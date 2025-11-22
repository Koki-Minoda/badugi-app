/** 
 * Placeholder helpers for future spectator / WebRTC flows.
 * Spec22 plans to allow delayed spectators and pure P2P channels.
 */
export function startSpectatorMode(roomId: string) {
  return {
    status: "pending",
    roomId,
    message: "Spectator mode will stream a delayed feed (Spec22 future work)",
  };
}

export function startDirectP2P(roomId: string) {
  return {
    status: "pending",
    roomId,
    message: "WebRTC direct mode needs signaling + encryption, not yet implemented",
  };
}
