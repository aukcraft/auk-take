import { createRequire } from "node:module";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const require = createRequire(import.meta.url);
/** Absolute RNW location so aliasing also works for imports from packages/*. */
const rnwDist = path.dirname(require.resolve("react-native-web/package.json"));
/** lucide: use the DOM build on web (the RN build needs react-native-svg,
 *  whose web entry still requires codegenNativeComponent). */
const lucideWeb = path.dirname(require.resolve("lucide-react/package.json"));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // RNW renderer: shared RN-syntax components resolve to web impls.
      "react-native": rnwDist,
      "lucide-react-native": lucideWeb,
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
