import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

function readGitCommit() {
  try {
    return execSync("git rev-parse HEAD", {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig(({ command }) => {
  const isDev = command === "serve";
  const isRemoteDev = process.env.VITE_MGX_REMOTE_DEV === "1";
  const buildInfo = {
    commit: process.env.VITE_MGX_BUILD_COMMIT || readGitCommit(),
    buildTime: process.env.VITE_MGX_BUILD_TIME || new Date().toISOString(),
    appVersion: process.env.npm_package_version || "0.0.0",
  };

  return {
    plugins: [react()],
    base: isDev ? "/dev/" : "/",
    define: {
      __MGX_BUILD_INFO__: JSON.stringify(buildInfo),
    },
    resolve: {
      alias: {
        "@core": path.resolve(projectRoot, "src/core"),
        "@games": path.resolve(projectRoot, "src/games"),
        "@ui": path.resolve(projectRoot, "src/ui"),
        "@utils": path.resolve(projectRoot, "src/utils"),
        "@audio": path.resolve(projectRoot, "src/audio"),
      },
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("onnxruntime-web")) return "onnx-runtime";
              if (id.includes("react-router")) return "react-router";
              if (id.includes("react-dom") || id.includes("/react/")) return "react-vendor";
              return "vendor";
            }
            if (
              id.includes("/src/ai/") ||
              id.includes("/src/rl/") ||
              id.includes("/src/games/")
            ) return "game-runtime";
            if (id.includes("/src/tournament/")) return "tournament-engine";
            if (id.includes("/src/ui/") && !id.endsWith("/src/ui/App.jsx")) return "ui-support";
            return undefined;
          },
        },
      },
    },
    server: {
      // ★ここが重要：Host ブロック回避
      allowedHosts: ["mgx-poker.com", "www.mgx-poker.com", "162.43.19.143"],
      watch: {
        ignored: [
          "**/.venv/**",
          "**/node_modules/**",
          "**/rl/models/**",
          "**/test-results/**",
          "**/playwright-report/**",
        ],
      },
      // iPhoneから https 経由で /dev/ に来るので HMR も wss に寄せる（白画面/更新不能の回避）
      hmr: isRemoteDev
        ? {
            protocol: "wss",
            host: "mgx-poker.com",
            clientPort: 443,
            path: "/dev/",
          }
        : undefined,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8000",
          changeOrigin: true,
        },
        "/ws": {
          target: "ws://127.0.0.1:8000",
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
