import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ command }) => {
  const isDev = command === "serve";

  return {
    plugins: [react()],
    base: isDev ? "/dev/" : "/",
    resolve: {
      alias: {
        "@core": path.resolve(__dirname, "src/core"),
        "@games": path.resolve(__dirname, "src/games"),
        "@ui": path.resolve(__dirname, "src/ui"),
        "@utils": path.resolve(__dirname, "src/utils"),
        "@audio": path.resolve(__dirname, "src/audio"),
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
    },
  };
});
