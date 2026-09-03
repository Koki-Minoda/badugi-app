import type { Page } from "@playwright/test";

export const APP_URL =
  process.env.E2E_APP_URL ??
  (process.env.LIVE_PREVIEW === "1" ? "https://mgx-poker.com/" : "http://127.0.0.1:3000/");
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
  super_holdem: "super_holdem",
  b03: "super_holdem",
  fl_super_holdem: "fl_super_holdem",
  b04: "fl_super_holdem",
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
  dramaha_hi: "dramaha_hi",
  h01: "dramaha_hi",
  dramaha_27: "dramaha_27",
  h02: "dramaha_27",
  dramaha_a5: "dramaha_a5",
  h03: "dramaha_a5",
  dramaha_zero: "dramaha_zero",
  h04: "dramaha_zero",
  dramaha_hidugi: "dramaha_hidugi",
  h05: "dramaha_hidugi",
  dramaha_badugi: "dramaha_badugi",
  h06: "dramaha_badugi",
  chinese_poker: "chinese_poker",
  chinese: "chinese_poker",
  cp1: "chinese_poker",
  ofc: "ofc",
};

const VARIANT_CATEGORY_BUTTON_BY_TEST_ID: Record<string, RegExp> = {
  nlh: /Board|Hold'em|Omaha|ボード|ホールデム|オマハ/i,
  flh: /Board|Hold'em|Omaha|ボード|ホールデム|オマハ/i,
  super_holdem: /Board|Hold'em|Omaha|ボード|ホールデム|オマハ/i,
  fl_super_holdem: /Board|Hold'em|Omaha|ボード|ホールデム|オマハ/i,
  plo: /Board|Hold'em|Omaha|ボード|ホールデム|オマハ/i,
  plo8: /Board|Hold'em|Omaha|ボード|ホールデム|オマハ/i,
  flo8: /Board|Hold'em|Omaha|ボード|ホールデム|オマハ/i,
  big_o: /Board|Hold'em|Omaha|ボード|ホールデム|オマハ/i,
  five_card_plo: /Board|Hold'em|Omaha|ボード|ホールデム|オマハ/i,
  stud: /Stud|スタッド/i,
  stud8: /Stud|スタッド/i,
  razz: /Stud|スタッド/i,
  razzdugi: /Stud|スタッド/i,
  razzducey: /Stud|スタッド/i,
  razz27: /Stud|スタッド/i,
  deuce_to_seven_triple_draw: /Triple Draw|トリプルドロー/i,
  ace_to_five_triple_draw: /Triple Draw|トリプルドロー/i,
  badeucey_triple_draw: /Triple Draw|トリプルドロー/i,
  badacey_triple_draw: /Triple Draw|トリプルドロー/i,
  hidugi_triple_draw: /Triple Draw|トリプルドロー/i,
  archie_triple_draw: /Triple Draw|トリプルドロー/i,
  deuce_to_seven_single_draw: /Single Draw|シングルドロー/i,
  ace_to_five_single_draw: /Single Draw|シングルドロー/i,
  five_card_single_draw: /Single Draw|シングルドロー/i,
  badugi_single_draw: /Single Draw|シングルドロー/i,
  badeucey_single_draw: /Single Draw|シングルドロー/i,
  badacey_single_draw: /Single Draw|シングルドロー/i,
  hidugi_single_draw: /Single Draw|シングルドロー/i,
  dramaha_hi: /Dramaha|ドラマハ/i,
  dramaha_27: /Dramaha|ドラマハ/i,
  dramaha_a5: /Dramaha|ドラマハ/i,
  dramaha_zero: /Dramaha|ドラマハ/i,
  dramaha_hidugi: /Dramaha|ドラマハ/i,
  dramaha_badugi: /Dramaha|ドラマハ/i,
  chinese_poker: /Chinese|OFC|チャイニーズ/i,
  ofc: /Open-Face Chinese|OFC/i,
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

export async function selectGameVariantFromSelector(
  page: Page,
  variantId: string,
) {
  const alias = String(variantId || "badugi").toLowerCase();
  const variantTestId = VARIANT_TEST_ID_BY_ALIAS[alias];
  if (!variantTestId) {
    throw new Error(`Missing game selector mapping for variant ${variantId}`);
  }
  const playButton = page
    .getByTestId(`game-selector-play-${variantTestId}`)
    .first();
  if (!(await playButton.count())) {
    const categoryName = VARIANT_CATEGORY_BUTTON_BY_TEST_ID[variantTestId];
    if (!categoryName) {
      throw new Error(`Missing game selector category mapping for variant ${variantId}`);
    }
    await page.getByRole("button", { name: categoryName }).first().click();
  }
  await page.getByTestId(`game-selector-play-${variantTestId}`).first().click();
}

async function waitForGameLaunchReady(page: Page, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const ready = await Promise.all([
      page
        .getByRole("button", { name: /Leaderboard|ランキング/i })
        .first()
        .isVisible()
        .catch(() => false),
      page.getByTestId("decision-panel").isVisible().catch(() => false),
      page.getByTestId("chinese-poker-screen").isVisible().catch(() => false),
    ]);
    if (ready.some(Boolean)) {
      return;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`Game launch did not become ready within ${timeout}ms`);
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

export async function deleteAuthenticatedSession(
  page: Page,
  session: Awaited<ReturnType<typeof createAuthenticatedSession>>,
) {
  const token = session?.authState?.accessToken;
  const scheme = session?.authState?.tokenType ?? "Bearer";
  if (!token) throw new Error("Cannot delete E2E account without an access token");
  const deletion = await page.request.delete(`${API_URL}/auth/account`, {
    headers: { Authorization: `${scheme} ${token}` },
    data: { password: session.password },
  });
  if (!deletion.ok()) {
    throw new Error(`E2E account deletion failed: ${deletion.status()} ${await deletion.text()}`);
  }
  const payload = await deletion.json();
  if (payload?.deleted !== true) throw new Error("E2E account deletion was not confirmed");
  const staleAuth = await page.request.get(`${API_URL}/auth/me`, {
    headers: { Authorization: `${scheme} ${token}` },
  });
  if (staleAuth.status() !== 401) {
    throw new Error(`Deleted E2E account remained accessible: ${staleAuth.status()}`);
  }
}

export async function enterTitleIfPresent(page: Page) {
  const titleButton = page.getByTestId("title-enter-button").first();
  const legacyStartButton = page.getByRole("button", { name: /start|press enter/i }).first();
  const readyScreen = page
    .getByTestId("menu-ring")
    .or(page.getByTestId("decision-panel"))
    .or(page.getByTestId("auth-email"))
    .first();
  const deadline = Date.now() + 15000;
  let lastClickError: unknown = null;

  while (Date.now() < deadline) {
    if (await readyScreen.isVisible().catch(() => false)) return;

    const button = (await titleButton.isVisible().catch(() => false))
      ? titleButton
      : (await legacyStartButton.isVisible().catch(() => false))
        ? legacyStartButton
        : null;
    if (button) {
      try {
        await button.click({ timeout: 2500 });
        // The production title transition is animated and can briefly leave the
        // button visible after the click.  Do not report success until the
        // destination screen is actually ready; otherwise the caller can time
        // out on the title screen during long serial device-QM runs.
        await page.waitForTimeout(200);
        continue;
      } catch (error) {
        lastClickError = error;
      }
    }
    await page.waitForTimeout(200);
  }

  if (lastClickError) throw lastClickError;
}

export async function openAuthenticatedMenu(page: Page, url = APP_URL) {
  const session = await createAuthenticatedSession(page);
  await gotoWithRetry(page, url);
  await dismissTranslateOverlay(page);
  await enterTitleIfPresent(page);
  await page.getByTestId("menu-ring").waitFor({ state: "visible", timeout: 20000 });
  return session;
}

export async function openAuthenticatedGame(page: Page, url = APP_URL) {
  const session = await openAuthenticatedMenu(page, url);
  await page.getByTestId("menu-ring").click();
  const variantTestId = variantTestIdFromUrl(url);
  await selectGameVariantFromSelector(page, variantTestId);
  await waitForGameLaunchReady(page);
  return session;
}
