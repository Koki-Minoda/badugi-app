import { describe, it, expect } from "vitest";
import { roomManager } from "../roomManager";

describe("roomManager", () => {
  it("creates and lists rooms", () => {
    const room = roomManager.createRoom("alpha", 2);
    expect(room.id).toBe("alpha");
    expect(roomManager.listRooms().some((r) => r.id === "alpha")).toBe(true);
  });

  it("joins and leaves room", () => {
    const participant = { id: "u1", displayName: "Unit" };
    roomManager.createRoom("beta", 1);
    const joined = roomManager.joinRoom("beta", participant);
    expect(joined.players.length).toBe(1);
    roomManager.leaveRoom("beta", "u1");
    expect(roomManager.__internal.rooms.get("beta")?.players.length ?? 0).toBe(0);
  });

  it("fails when room full and queues", () => {
    roomManager.createRoom("gamma", 1);
    roomManager.joinRoom("gamma", { id: "u2", displayName: "Two" });
    expect(() =>
      roomManager.joinRoom("gamma", { id: "u3", displayName: "Three" })
    ).toThrow("Room full");
    const queued = roomManager.matchFromQueue();
    expect(queued).toBeDefined();
    expect(queued?.id).toBe("u3");
  });
});
