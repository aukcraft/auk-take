const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");

/**
 * Metro config for the monorepo mobile shell.
 * - watchFolders: source-direct linking of packages/* (no prebuild step)
 * - pnpm symlinks resolve to real locations under .pnpm/<pkg>/node_modules,
 *   where hierarchical lookup finds sibling deps
 * - TS sources use ESM-style ".js" extension imports; a fallback
 *   resolver retries without the extension (Metro maps to .ts/.tsx)
 */
const projectRoot = __dirname;
const workspaceRoot = require("path").resolve(projectRoot, "../..");

const config = {
  projectRoot,
  watchFolders: [workspaceRoot],
  resolver: {
    disableHierarchicalLookup: false,
    nodeModulesPaths: [
      require("path").resolve(projectRoot, "node_modules"),
      require("path").resolve(workspaceRoot, "node_modules"),
    ],
    resolveRequest(context, moduleName, platform) {
      if (/\.js$/.test(moduleName)) {
        try {
          return context.resolveRequest(context, moduleName.replace(/\.js$/, ""), platform);
        } catch {
          // fall through to the default resolution
        }
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
