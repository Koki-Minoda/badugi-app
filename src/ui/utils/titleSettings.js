const DEFAULT_SETTINGS = {
  playerName: "You",
  playerTitle: "Badugi Rookie",
  avatar: "♦️",
};

const STORAGE_KEY = "badugi.titleSettings";

function safeWindow() {
  return typeof window !== "undefined" ? window : undefined;
}

export function loadTitleSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
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
