import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => {
  const isDev = command === "serve";

  return {
    plugins: [react()],
    base: isDev ? "/dev/" : "/",
    resolve: {
      alias: {
        "@core": path.resolve(projectRoot, "src/core"),
        "@games": path.resolve(projectRoot, "src/games"),
        "@ui": path.resolve(projectRoot, "src/ui"),
        "@utils": path.resolve(projectRoot, "src/utils"),
        "@audio": path.resolve(projectRoot, "src/audio"),
      },
    },
    server: {
      // ★ここが重要：Host ブロック回避
      allowedHosts: ["mgx-poker.com", "www.mgx-poker.com", "162.43.19.143"],
      // iPhoneから https 経由で /dev/ に来るので HMR も wss に寄せる（白画面/更新不能の回避）
      hmr: {
        protocol: "wss",
        host: "mgx-poker.com",
        clientPort: 443,
        path: "/dev/",
      },
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8000",
          changeOrigin: true,
        },
      },
    },
  };
});
