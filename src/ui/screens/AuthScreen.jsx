import React, { useCallback, useMemo, useState } from "react";
import { useAuth } from "../state/authStore.js";

const API_BASE = import.meta.env?.VITE_API_BASE ?? "http://127.0.0.1:8000/api";

async function postJson(path, payload, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data?.detail ||
      data?.message ||
      data?.error ||
      `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

async function fetchCurrentUser(token) {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch user profile");
  }
  return res.json();
}

export default function AuthScreen({ onAuthenticated }) {
  const { loginSuccess } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [info, setInfo] = useState(null);

  const title = useMemo(() => {
    return mode === "signup" ? "Create an Account" : "Welcome Back";
  }, [mode]);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (loading) return;
      setErrorMessage(null);
      setInfo(null);

      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail || !password) {
        setErrorMessage("Email and password are required.");
        return;
      }

      if (mode === "signup") {
        if (password !== confirmPassword) {
          setErrorMessage("Passwords do not match.");
          return;
        }
        setLoading(true);
        try {
          await postJson("/auth/signup", {
            email: trimmedEmail,
            password,
          });
          setInfo("Signup successful. Please login.");
          // TODO: automatically sign in once email verification is implemented.
          setMode("login");
        } catch (err) {
          setErrorMessage(err.message || "Signup failed.");
        } finally {
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const loginPayload = await postJson("/auth/login", {
          email: trimmedEmail,
          password,
        });
        const token = loginPayload?.access_token;
        if (!token) {
          throw new Error("Invalid login response");
        }
        const userProfile = await fetchCurrentUser(token);
        const user = {
          id: userProfile?.id ?? null,
          username: userProfile?.username ?? trimmedEmail,
        };
        loginSuccess({ accessToken: token, user });
        if (onAuthenticated) {
          onAuthenticated(user);
        }
      } catch (err) {
        setErrorMessage(err.message || "Login failed.");
      } finally {
        setLoading(false);
      }
    },
    [
      confirmPassword,
      email,
      loading,
      loginSuccess,
      mode,
      onAuthenticated,
      password,
    ],
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/70 p-8 shadow-2xl backdrop-blur">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-white">{title}</h2>
          <div className="flex gap-2 text-xs uppercase tracking-[0.3em]">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded-full px-3 py-1 ${
                mode === "login"
                  ? "bg-emerald-500/20 text-emerald-200"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-full px-3 py-1 ${
                mode === "signup"
                  ? "bg-emerald-500/20 text-emerald-200"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Signup
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-emerald-400 focus:outline-none"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-emerald-400 focus:outline-none"
              placeholder="••••••••"
              required
            />
          </div>
          {mode === "signup" && (
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-emerald-400 focus:outline-none"
                placeholder="••••••••"
                required
              />
            </div>
          )}
          {errorMessage && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {errorMessage}
            </div>
          )}
          {info && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {info}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl border border-emerald-400/60 bg-emerald-500/20 px-4 py-3 text-sm font-semibold uppercase tracking-[0.4em] text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50"
          >
            {loading
              ? "Processing..."
              : mode === "signup"
              ? "Create Account"
              : "Login"}
          </button>
        </form>
        {mode === "signup" && (
          <p className="mt-4 text-center text-xs text-slate-400">
            Already have an account?{" "}
            <button
              type="button"
              className="text-emerald-300 underline-offset-2 hover:underline"
              onClick={() => setMode("login")}
            >
              Login here
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
