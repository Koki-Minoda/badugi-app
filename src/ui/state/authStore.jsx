// src/ui/state/authStore.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { normalizeTokenType } from "../utils/auth.js";
import { AuthContext, defaultAuthState } from "./authContext.js";

const AUTH_STORAGE_KEY = "mgx_auth";
const API_BASE_RAW = import.meta.env?.VITE_API_BASE ?? "/api";
const API_BASE = API_BASE_RAW.endsWith("/api")
  ? API_BASE_RAW
  : `${API_BASE_RAW.replace(/\/$/, "")}/api`;

function sanitizeStoredAuth(raw) {
  if (!raw || typeof raw !== "object") return null;
  const accessToken =
    typeof raw.accessToken === "string" && raw.accessToken.length > 0
      ? raw.accessToken
      : null;
  const user =
    raw.user && typeof raw.user === "object"
      ? {
          id:
            typeof raw.user.id === "number" || typeof raw.user.id === "string"
              ? raw.user.id
              : null,
          username:
            typeof raw.user.username === "string"
              ? raw.user.username
              : null,
          email:
            typeof raw.user.email === "string"
              ? raw.user.email
              : null,
        }
      : null;
  if (!accessToken) return null;
  return {
    accessToken,
    tokenType:
      typeof raw.tokenType === "string" && raw.tokenType.length > 0
        ? normalizeTokenType(raw.tokenType)
        : null,
    user,
  };
}

function readStoredAuth() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? sanitizeStoredAuth(JSON.parse(raw)) : null;
  } catch (err) {
    console.warn("[auth] failed to parse stored state", err);
    return null;
  }
}

function writeStoredAuth(state) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        accessToken: state.accessToken,
        tokenType: state.tokenType,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    );
  } catch (err) {
    console.warn("[auth] failed to persist state", err);
  }
}

function clearStoredAuth() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (err) {
    console.warn("[auth] failed to clear state", err);
  }
}

async function fetchCurrentUserProfile(token, tokenType) {
  const scheme = normalizeTokenType(tokenType);
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: {
      Authorization: `${scheme} ${token}`,
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || "Failed to validate token");
  }
  return res.json();
}

function normalizeUserProfile(payload) {
  if (!payload) return null;
  return {
    id: payload.id ?? null,
    username: payload.username ?? payload.email ?? "Player",
    email: payload.email ?? null,
  };
}

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(defaultAuthState);
  const hydratedRef = useRef(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const validatingRef = useRef(false);

  // hydrateFromStorage restores persisted credentials when the app boots.
  const hydrateFromStorage = useCallback(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const stored = readStoredAuth();
    if (stored) {
      setAuthState({
        isAuthenticated: !!(stored.accessToken && stored.user),
        accessToken: stored.accessToken,
        tokenType: normalizeTokenType(stored.tokenType),
        user: stored.user,
      });
    } else {
      setAuthState(defaultAuthState);
    }
    setHasHydrated(true);
  }, []);

  const loginSuccess = useCallback(({ accessToken, tokenType, user }) => {
    if (!accessToken) {
      console.warn("[auth] loginSuccess missing accessToken");
      return;
    }
    const nextState = {
      isAuthenticated: !!user,
      accessToken,
      tokenType: normalizeTokenType(tokenType),
      user: user ?? null,
    };
    setAuthState(nextState);
    writeStoredAuth(nextState);
  }, []);

  const logout = useCallback(() => {
    setAuthState(defaultAuthState);
    clearStoredAuth();
  }, []);

  // validateToken ensures persisted JWTs are still valid on cold start.
  const validateToken = useCallback(async () => {
    const token = authState.accessToken;
    if (!token || validatingRef.current) return;
    validatingRef.current = true;
    try {
      const profile = await fetchCurrentUserProfile(token, authState.tokenType);
      const normalizedUser = normalizeUserProfile(profile);
      if (!normalizedUser) {
        throw new Error("Invalid profile payload");
      }
      const nextState = {
        isAuthenticated: true,
        accessToken: token,
        tokenType: normalizeTokenType(authState.tokenType),
        user: normalizedUser,
      };
      setAuthState(nextState);
      writeStoredAuth(nextState);
    } catch (err) {
      console.warn("[auth] token validation failed", err);
      logout();
    } finally {
      validatingRef.current = false;
    }
  }, [authState.accessToken, authState.tokenType, logout]);

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!authState.accessToken) return;
    if (authState.isAuthenticated && authState.user) return;
    validateToken();
  }, [
    authState.accessToken,
    authState.isAuthenticated,
    authState.user,
    hasHydrated,
    validateToken,
  ]);

  const contextValue = useMemo(
    () => ({
      authState,
      loginSuccess,
      logout,
      hydrateFromStorage,
      validateToken,
    }),
    [authState, loginSuccess, logout, hydrateFromStorage, validateToken],
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}
