import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "src/core"),
      "@games": path.resolve(__dirname, "src/games"),
      "@ui": path.resolve(__dirname, "src/ui"),
      "@utils": path.resolve(__dirname, "src/utils"),
      "@audio": path.resolve(__dirname, "src/audio"),
    },
  },
});
