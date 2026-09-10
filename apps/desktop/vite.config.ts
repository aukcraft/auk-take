import { createRequire } from "node:module";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const require = createRequire(import.meta.url);
/** Absolute RNW location so aliasing also works for imports from packages/*. */
const rnwDist = path.dirname(require.resolve("react-native-web/package.json"));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // RNW renderer: shared RN-syntax components resolve to web impls.
      "react-native": rnwDist,
    },
  },
  // monorepo source-direct linking: workspace packages expose TS source
  server: {
    fs: { allow: [path.resolve(import.meta.dirname, "../..")] },
  },
  preview: {
    // sandbox preview proxies via external host names
    allowedHosts: true,
  },
});
