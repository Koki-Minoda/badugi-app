import type { Page } from "@playwright/test";

export const APP_URL = "http://127.0.0.1:3000/";
export const API_URL = `${APP_URL.replace(/\/$/, "")}/api`;

const DEFAULT_PASSWORD = "MgxE2E!2026";
const VARIANT_TEST_ID_BY_ALIAS: Record<string, string> = {
  badugi: "badugi",
  d03: "badugi",
  d01: "deuce_to_seven_triple_draw",
  deuce_to_seven_triple_draw: "deuce_to_seven_triple_draw",
  d02: "ace_to_five_triple_draw",
  ace_to_five_triple_draw: "ace_to_five_triple_draw",
  s01: "deuce_to_seven_single_draw",
  deuce_to_seven_single_draw: "deuce_to_seven_single_draw",
  s02: "ace_to_five_single_draw",
  ace_to_five_single_draw: "ace_to_five_single_draw",
  d04: "badeucey_triple_draw",
  badeucey_td: "badeucey_triple_draw",
  badeucey_triple_draw: "badeucey_triple_draw",
  d05: "badacey_triple_draw",
  badacey_td: "badacey_triple_draw",
  badacey_triple_draw: "badacey_triple_draw",
  d06: "hidugi_triple_draw",
  hidugi_td: "hidugi_triple_draw",
  hidugi_triple_draw: "hidugi_triple_draw",
  d07: "archie_triple_draw",
  archie_td: "archie_triple_draw",
  archie_triple_draw: "archie_triple_draw",
  s03: "five_card_single_draw",
  five_card_single_draw: "five_card_single_draw",
  s04: "badugi_single_draw",
  badugi_single_draw: "badugi_single_draw",
  s05: "badeucey_single_draw",
  badeucey_single_draw: "badeucey_single_draw",
  s06: "badacey_single_draw",
  badacey_single_draw: "badacey_single_draw",
  s07: "hidugi_single_draw",
  hidugi_single_draw: "hidugi_single_draw",
  nlh: "nlh",
  b01: "nlh",
  flh: "flh",
  b02: "flh",
  plo: "plo",
  b05: "plo",
  plo8: "plo8",
  b06: "plo8",
  flo8: "flo8",
  b09: "flo8",
  big_o: "big_o",
  b07: "big_o",
  five_card_plo: "five_card_plo",
  b08: "five_card_plo",
  stud: "stud",
  st1: "stud",
  stud8: "stud8",
  st2: "stud8",
  razz: "razz",
  st3: "razz",
  razzdugi: "razzdugi",
  st4: "razzdugi",
  razzducey: "razzducey",
  st5: "razzducey",
  razz27: "razz27",
  st6: "razz27",
};

function variantTestIdFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const key = (parsed.searchParams.get("variant") ?? "badugi").toLowerCase();
    return VARIANT_TEST_ID_BY_ALIAS[key] ?? "badugi";
  } catch {
    return "badugi";
  }
}

export function uniqueE2eEmail(prefix = "mgx.e2e") {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}+${nonce}@mgx-e2e.com`;
}

export async function dismissTranslateOverlay(page: Page) {
  const translateBubble = page.locator("text=Google Translate");
  if (await translateBubble.count()) {
    await translateBubble.click().catch(() => {});
  }
  const closeButtons = page.locator('button:has-text("\u9589\u3058\u308b")');
  if (await closeButtons.count()) {
    await closeButtons.first().click().catch(() => {});
  }
}

export async function gotoWithRetry(page: Page, url: string, timeout = 60000) {
  const deadline = Date.now() + timeout;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      await page.goto(url, { waitUntil: "load", timeout: Math.min(15000, timeout) });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(1000);
    }
  }
  throw lastError ?? new Error(`Failed to load ${url} within ${timeout}ms`);
}

export async function createAuthenticatedSession(
  page: Page,
  {
    email = uniqueE2eEmail(),
    password = DEFAULT_PASSWORD,
  }: { email?: string; password?: string } = {},
) {
  const signup = await page.request.post(`${API_URL}/auth/signup`, {
    data: { email, password },
  });
  if (!signup.ok() && signup.status() !== 400) {
    throw new Error(`Signup failed for ${email}: ${signup.status()} ${await signup.text()}`);
  }

  const login = await page.request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });
  if (!login.ok()) {
    throw new Error(`Login failed for ${email}: ${login.status()} ${await login.text()}`);
  }
  const loginPayload = await login.json();
  const token = loginPayload?.access_token;
  if (!token) {
    throw new Error(`Login for ${email} did not return access_token`);
  }
  const scheme = String(loginPayload?.token_type ?? "bearer").toLowerCase() === "bearer"
    ? "Bearer"
    : String(loginPayload?.token_type ?? "Bearer");

  const profile = await page.request.get(`${API_URL}/auth/me`, {
    headers: { Authorization: `${scheme} ${token}` },
  });
  if (!profile.ok()) {
    throw new Error(`/auth/me failed for ${email}: ${profile.status()} ${await profile.text()}`);
  }
  const userProfile = await profile.json();
  const authState = {
    accessToken: token,
    tokenType: scheme,
    user: {
      id: userProfile?.id ?? null,
      username: userProfile?.username ?? email,
      email: userProfile?.email ?? email,
    },
    isAuthenticated: true,
  };

  await page.addInitScript((state) => {
    window.localStorage.setItem("mgx_auth", JSON.stringify(state));
  }, authState);

  return { email, password, authState };
}

export async function enterTitleIfPresent(page: Page) {
  const titleButton = page.getByTestId("title-enter-button").first();
  if (await titleButton.count()) {
    await titleButton.waitFor({ state: "visible", timeout: 15000 });
    await titleButton.click();
    return;
  }

  const legacyStartButton = page.getByRole("button", { name: /start|press enter/i }).first();
  if (await legacyStartButton.count()) {
    await legacyStartButton.click().catch(() => {});
  }
}

export async function openAuthenticatedMenu(page: Page, url = APP_URL) {
  await createAuthenticatedSession(page);
  await gotoWithRetry(page, url);
  await dismissTranslateOverlay(page);
  await enterTitleIfPresent(page);
  await page.getByTestId("menu-ring").waitFor({ state: "visible", timeout: 20000 });
}

export async function openAuthenticatedGame(page: Page, url = APP_URL) {
  await openAuthenticatedMenu(page, url);
  await page.getByTestId("menu-ring").click();
  const variantTestId = variantTestIdFromUrl(url);
  await page.getByTestId(`game-selector-play-${variantTestId}`).first().click();
  await Promise.race([
    page
      .getByRole("button", { name: /Leaderboard|ランキング/i })
      .first()
      .waitFor({ state: "visible", timeout: 20000 }),
    page.getByTestId("decision-panel").waitFor({ state: "visible", timeout: 20000 }),
  ]);
}
