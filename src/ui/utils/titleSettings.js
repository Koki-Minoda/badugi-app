const DEFAULT_SETTINGS = {
  playerName: "You",
  playerTitle: "Badugi Rookie",
  avatar: "/characters/hero.png",
  avatarSourceVersion: 2,
};

const STORAGE_KEY = "badugi.titleSettings";
const LEGACY_DEFAULT_AVATARS = new Set(["♦️", "♦︎", "default_avatar"]);

function safeWindow() {
  return typeof window !== "undefined" ? window : undefined;
}

export function loadTitleSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    const migrated = { ...DEFAULT_SETTINGS, ...parsed };
    if (
      parsed.avatarSourceVersion == null &&
      LEGACY_DEFAULT_AVATARS.has(parsed.avatar)
    ) {
      migrated.avatar = DEFAULT_SETTINGS.avatar;
      migrated.avatarSourceVersion = DEFAULT_SETTINGS.avatarSourceVersion;
    }
    return migrated;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveTitleSettings(nextSettings = {}) {
  const payload = {
    ...DEFAULT_SETTINGS,
    ...nextSettings,
  };
  const win = safeWindow();
  if (win) {
    try {
      win.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore quota errors
    }
    win.dispatchEvent(new Event("badugi:titleSettings-updated"));
  }
  return payload;
}

export function resetTitleSettings() {
  const win = safeWindow();
  if (win) {
    try {
      win.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    win.dispatchEvent(new Event("badugi:titleSettings-updated"));
  }
  return { ...DEFAULT_SETTINGS };
}

export function getDefaultTitleSettings() {
  return { ...DEFAULT_SETTINGS };
}

export function resolveHeroPlayerName(playerName, authenticatedUsername) {
  const configuredName =
    typeof playerName === "string" ? playerName.trim() : "";
  const accountName =
    typeof authenticatedUsername === "string"
      ? authenticatedUsername.trim()
      : "";

  // The shipped "You" value is a placeholder, not a deliberate profile
  // override. Once authentication is hydrated, show the account identity.
  if (configuredName && configuredName !== DEFAULT_SETTINGS.playerName) {
    return configuredName;
  }
  return accountName || configuredName || DEFAULT_SETTINGS.playerName;
}
