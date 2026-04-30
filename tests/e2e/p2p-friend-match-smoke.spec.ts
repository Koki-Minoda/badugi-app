import { expect, test, type Page } from "@playwright/test";
import { APP_URL, createAuthenticatedSession, dismissTranslateOverlay, enterTitleIfPresent } from "./authHelper";

async function installP2PMocks(page: Page) {
  await page.route("**/api/rooms/create", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          roomId: "room-e2e",
          phase: "waiting",
          metadata: { variantId: "badugi", startingStack: "2000" },
          maxPlayers: 2,
        },
      }),
    });
  });
  await page.route("**/api/rooms/join", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: { roomId: "room-e2e", players: ["local-e2e", "guest-e2e"] } }),
    });
  });
  await page.route("**/api/rooms/info/room-e2e", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          room_id: "room-e2e",
          phase: "waiting",
          players: [{ id: "local-e2e" }],
          metadata: { variantId: "badugi", startingStack: "2000" },
          sequence_id: 1,
        },
      }),
    });
  });

  await page.addInitScript(() => {
    class MockP2PWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      url: string;
      readyState = MockP2PWebSocket.CONNECTING;
      listeners: Record<string, Array<(event?: any) => void>> = {};
      playerId = "local-e2e";

      constructor(url: string) {
        this.url = url;
        setTimeout(() => {
          this.readyState = MockP2PWebSocket.OPEN;
          this.emit("open", {});
        }, 5);
      }

      addEventListener(type: string, handler: (event?: any) => void) {
        this.listeners[type] = [...(this.listeners[type] ?? []), handler];
      }

      close() {
        this.readyState = MockP2PWebSocket.CLOSED;
        this.emit("close", {});
      }

      send(raw: string) {
        const message = JSON.parse(raw);
        const payload = message.payload ?? {};
        if (message.event === "join_room") {
          this.playerId = payload.playerId ?? "local-e2e";
          this.serverEvent("room_state", {
            roomId: "room-e2e",
            phase: "waiting",
            sequenceId: 2,
            handId: "hand-e2e-1",
            players: [this.playerId, "guest-e2e"],
            playerStates: [
              { id: this.playerId, displayName: payload.displayName ?? "Host", ready: false, stack: 2000, bet: 0 },
              { id: "guest-e2e", displayName: "Guest", ready: false, stack: 2000, bet: 0 },
            ],
          });
          this.serverEvent("history", {
            events: [{ event: "action", sequenceId: 3, action: "call", amount: 20 }],
          });
          return;
        }
        if (message.event === "reaction" && payload.type === "ready") {
          this.serverEvent("room_state", {
            roomId: "room-e2e",
            phase: "playing",
            sequenceId: 4,
            handId: "hand-e2e-1",
            players: [this.playerId, "guest-e2e"],
            playerStates: [
              { id: this.playerId, displayName: "Host", ready: true, stack: 2000, bet: 0 },
              { id: "guest-e2e", displayName: "Guest", ready: true, stack: 2000, bet: 0 },
            ],
          });
          this.serverEvent("secure_deal", { handId: "hand-e2e-1", cards: [] });
          this.serverEvent("updated_state", {
            sequenceId: 5,
            handId: "hand-e2e-1",
            phase: "playing",
            pot: 0,
            stacks: { [this.playerId]: 2000, "guest-e2e": 2000 },
            bets: { [this.playerId]: 0, "guest-e2e": 0 },
            lastAction: {},
          });
          return;
        }
        if (message.event === "action" && payload.type === "draw") {
          this.serverEvent("updated_state", {
            sequenceId: 6,
            handId: "hand-e2e-1",
            phase: "draw",
            pot: 20,
            stacks: { [this.playerId]: 1980, "guest-e2e": 2000 },
            bets: { [this.playerId]: 20, "guest-e2e": 0 },
            lastAction: { playerId: this.playerId, action: "draw", amount: 0 },
          });
          return;
        }
        if (message.event === "action" && payload.type === "fold") {
          this.serverEvent("showdown", {
            sequenceId: 7,
            handId: "hand-e2e-1",
            winner: "guest-e2e",
            pot: 20,
          });
          setTimeout(() => {
            this.serverEvent("secure_deal", { handId: "hand-e2e-2", cards: [] });
          }, 1000);
        }
      }

      emit(type: string, event: any) {
        for (const handler of this.listeners[type] ?? []) handler(event);
      }

      serverEvent(event: string, payload: any) {
        setTimeout(() => {
          this.emit("message", { data: JSON.stringify({ event, payload }) });
        }, 5);
      }
    }

    Object.defineProperty(window, "WebSocket", {
      configurable: true,
      writable: true,
      value: MockP2PWebSocket,
    });
  });
}

test.describe("P2P friend match browser smoke", () => {
  test.describe.configure({ timeout: 90000 });

  test("logs in, creates a room, syncs ready/draw/showdown, and restores after refresh", async ({ page }) => {
    await createAuthenticatedSession(page);
    await installP2PMocks(page);
    await page.goto(APP_URL, { waitUntil: "load" });
    await dismissTranslateOverlay(page);
    await enterTitleIfPresent(page);
    await page.getByTestId("menu-friend").click();

    await page.getByRole("button", { name: /create room/i }).click();
    await expect(page.getByText("room-e2e", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Latest sequence: 3/i)).toBeVisible({ timeout: 15000 });

    await page.getByTestId("p2p-ready").click();
    await expect(page.getByText(/PLAYING \/ Pot 0/i)).toBeVisible({ timeout: 15000 });

    await page.getByTestId("p2p-draw").click();
    await expect(page.getByText(/DRAW \/ Pot 20/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("p2p-player-guest-e2e")).toContainText("Guest");

    await page.getByTestId("p2p-fold").click();
    await expect(page.getByText(/Showdown winner: guest-e2e/i)).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => window.history.replaceState(null, "", "/dev/friend-match"));
    await page.reload({ waitUntil: "load" });
    await expect(page.getByText("room-e2e", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("action (replay)").first()).toBeVisible({ timeout: 15000 });
  });
});
