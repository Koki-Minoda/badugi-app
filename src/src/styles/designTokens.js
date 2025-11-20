export const designTokens = Object.freeze({
  colors: {
    background: "#030509",
    surface: "#0f172a",
    surfaceAlt: "#111b30",
    accent: "#34d399",
    accentSoft: "rgba(52, 211, 153, 0.15)",
    warning: "#fde047",
    warningSoft: "rgba(253, 224, 71, 0.18)",
    info: "#38bdf8",
    infoSoft: "rgba(56, 189, 248, 0.15)",
    textStrong: "#f8fafc",
    textMuted: "#94a3b8",
    divider: "rgba(148, 163, 184, 0.2)",
  },
  spaces: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 20,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: "8px",
    md: "16px",
    lg: "24px",
    pill: "999px",
  },
  typography: {
    caps: "0.75rem",
    body: "0.95rem",
    bodyLarge: "1.05rem",
    heading: "1.5rem",
    display: "2.75rem",
  },
  elevation: {
    card: "0 25px 50px rgba(15, 23, 42, 0.35)",
    surface: "0 12px 35px rgba(2, 6, 23, 0.55)",
  },
  breakpoints: {
    mobile: "640px",
    tablet: "1024px",
  },
});

export const layoutTokens = Object.freeze({
  maxWidth: "1200px",
  headerHeight: "72px",
  actionBarHeight: "88px",
});
