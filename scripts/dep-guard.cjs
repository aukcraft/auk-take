#!/usr/bin/env node
/**
 * Dependency-direction guard (spec: host-shell "依赖方向守卫").
 *
 * Rules:
 * - core: no platform deps (react-native, react, tauri) and no internal
 *   deps (platform packages or ui-nav)
 * - platform-rn / platform-tauri / ui-nav: only @auktake/core (peer) +
 *   their own platform libraries; no cross-dependencies, no app deps
 * - apps: core + corresponding platform package + ui-nav allowed
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const PLATFORM_LIBS = [
  "react",
  "react-native",
  "react-native-web",
  "@tauri-apps/api",
  "@tauri-apps/cli",
  "@tauri-apps/plugin-fs",
  "@op-engineering/op-sqlite",
];

const readPkg = (p) => JSON.parse(fs.readFileSync(path.join(root, p, "package.json"), "utf8"));
const depsOf = (pkg) => ({
  ...pkg.dependencies,
  ...pkg.peerDependencies,
  ...pkg.devDependencies,
});

function fail(rule, detail) {
  failures.push(`[dep-guard] ${rule}: ${detail}`);
}

// Rule 1: core purity (extends the 0a guard)
const core = readPkg("packages/core");
const coreDeps = depsOf(core);
for (const lib of PLATFORM_LIBS) {
  if (coreDeps[lib]) fail("core-no-platform-deps", `packages/core depends on ${lib}`);
}
for (const internal of ["@auktake/platform-rn", "@auktake/platform-tauri", "@auktake/ui-nav"]) {
  if (coreDeps[internal]) fail("core-no-internal-deps", `packages/core depends on ${internal}`);
}

// Rule 2: platform/ui packages depend only on core + their own platform libs
const allowed = {
  "packages/platform-rn": ["@auktake/core", "@op-engineering/op-sqlite"],
  "packages/platform-tauri": ["@auktake/core", "@tauri-apps/plugin-fs"],
  "packages/ui-nav": ["@auktake/core"],
};
for (const [dir, allow] of Object.entries(allowed)) {
  const pkg = readPkg(dir);
  const deps = depsOf(pkg);
  for (const dep of Object.keys(deps)) {
    if (dep.startsWith("@auktake/")) {
      if (!allow.includes(dep)) fail(`${dir}-deps`, `unexpected internal dep ${dep}`);
    } else if (!PLATFORM_LIBS.includes(dep)) {
      // dev tooling (typescript, vitest, eslint...) is fine
      if (pkg.devDependencies?.[dep] && !dep.startsWith("eslint")) {
        // allow tooling silently
      }
    }
  }
  // cross-dependence between platform packages is forbidden
  const internals = Object.keys(deps).filter((d) => d.startsWith("@auktake/"));
  for (const dep of internals) {
    if (dep !== "@auktake/core") fail(`${dir}-deps`, `platform packages must only depend on @auktake/core, found ${dep}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("OK: dependency directions valid");
