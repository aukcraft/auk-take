#!/usr/bin/env node
/**
 * Dependency-direction guard (spec: host-shell "依赖方向守卫").
 *
 * Rules:
 * - core: no platform deps (react/react-native/tauri/...) and no
 *   internal deps — core purity (0a guard, unchanged)
 * - ui-contracts: only @auktake/core (peer, types) + react (peer,
 *   types); no react-native, no other internal packages
 * - platform-rn / platform-tauri / ui-nav: only @auktake/core (peer) +
 *   their own platform libraries; no cross-dependencies
 * - plugin-*: ONLY @auktake/core + @auktake/ui-contracts (+ ui-nav for
 *   tab keys); inter-plugin deps, platform-* deps and app deps FAIL;
 *   react/react-native allowed as peers only
 * - apps: core + platform package + ui-nav + ui-contracts + plugin-*
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const PLATFORM_LIBS = [
  "react",
  "react-dom",
  "react-native",
  "react-native-web",
  "@tauri-apps/api",
  "@tauri-apps/cli",
  "@tauri-apps/plugin-fs",
  "@op-engineering/op-sqlite",
];

// runtime libs a plugin may depend on beyond @auktake/* (ulid: edit's record ids)
const PLUGIN_EXTRA_LIBS = ["ulid"];

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
for (const internal of [
  "@auktake/platform-rn",
  "@auktake/platform-tauri",
  "@auktake/ui-nav",
  "@auktake/ui-contracts",
]) {
  if (coreDeps[internal]) fail("core-no-internal-deps", `packages/core depends on ${internal}`);
}

// Rule 2: per-package allowed internal dependency sets
const allowed = {
  "packages/core": [],
  "packages/ui-contracts": ["@auktake/core"],
  "packages/platform-rn": ["@auktake/core"],
  "packages/platform-tauri": ["@auktake/core"],
  "packages/ui-nav": ["@auktake/core"],
  "packages/plugin-edit": ["@auktake/core", "@auktake/ui-contracts", "@auktake/ui-nav"],
  "packages/plugin-display": ["@auktake/core", "@auktake/ui-contracts", "@auktake/ui-nav"],
  "packages/plugin-record": ["@auktake/core", "@auktake/ui-contracts", "@auktake/ui-nav"],
  "packages/plugin-timeline": ["@auktake/core", "@auktake/ui-contracts", "@auktake/ui-nav"],
  "packages/plugin-tmdb": ["@auktake/core", "@auktake/ui-contracts"],
  "packages/plugin-tag": ["@auktake/core", "@auktake/ui-contracts", "@auktake/ui-nav"],
  "packages/plugin-search": ["@auktake/core", "@auktake/ui-contracts", "@auktake/ui-nav"],
  "packages/plugin-stats": ["@auktake/core", "@auktake/ui-contracts", "@auktake/ui-nav"],
};

const packageDirs = fs
  .readdirSync(path.join(root, "packages"))
  .map((d) => `packages/${d}`)
  .filter((d) => fs.existsSync(path.join(root, d, "package.json")));

for (const dir of packageDirs) {
  const allow = allowed[dir];
  if (!allow) {
    fail("unknown-package", `${dir} has no dependency allow-list entry`);
    continue;
  }
  const pkg = readPkg(dir);
  const deps = depsOf(pkg);

  for (const dep of Object.keys(deps)) {
    if (!dep.startsWith("@auktake/")) continue;
    if (!allow.includes(dep)) {
      if (dep.startsWith("@auktake/plugin-")) {
        fail("plugin-no-inter-plugin-deps", `${dir} depends on ${dep} (插件间依赖被禁止)`);
      } else if (dep.startsWith("@auktake/platform-")) {
        fail("plugin-no-platform-deps", `${dir} depends on ${dep} (storage 经 ServiceRegistry 注入)`);
      } else {
        fail(`${dir}-deps`, `unexpected internal dep ${dep}`);
      }
    }
  }

  // ui-contracts must stay renderer-free beyond the react TYPE peer
  if (dir === "packages/ui-contracts") {
    for (const lib of ["react-native", "react-native-web"]) {
      if (deps[lib]) fail("ui-contracts-no-platform-deps", `${dir} depends on ${lib}`);
    }
  }

  // plugins: react系 as peers only; other runtime libs whitelisted
  if (dir.startsWith("packages/plugin-")) {
    for (const lib of Object.keys(pkg.dependencies ?? {})) {
      if (lib.startsWith("@auktake/")) continue;
      if (PLATFORM_LIBS.includes(lib)) {
        fail("plugin-platform-lib-in-deps", `${dir} lists ${lib} in dependencies (must be peerDependencies)`);
      } else if (!PLUGIN_EXTRA_LIBS.includes(lib)) {
        fail("plugin-unexpected-lib", `${dir} depends on ${lib}`);
      }
    }
  }
}

// Rule 3: apps may depend on core + platform + ui-nav + ui-contracts + plugins
for (const app of ["apps/mobile", "apps/desktop"]) {
  const deps = depsOf(readPkg(app));
  for (const dep of Object.keys(deps)) {
    if (
      dep.startsWith("@auktake/") &&
      !/^@auktake\/(core|platform-rn|platform-tauri|ui-nav|ui-contracts|plugin-[a-z-]+)$/.test(dep)
    ) {
      fail(`${app}-deps`, `unexpected internal dep ${dep}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("OK: dependency directions valid");
