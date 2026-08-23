import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // RNW renderer: shared RN-syntax components resolve to web impls.
      "react-native": "react-native-web",
    },
  },
  // monorepo source-direct linking: workspace packages expose TS source
  server: {
    fs: { allow: [path.resolve(__dirname, "../..")] },
  },
});
