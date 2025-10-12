import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})

// --- Path Aliases Added ---
import path from 'path';
export default {
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'src/core'),
      '@games': path.resolve(__dirname, 'src/games'),
      '@ui': path.resolve(__dirname, 'src/ui'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@audio': path.resolve(__dirname, 'src/audio'),
    },
  },
};
