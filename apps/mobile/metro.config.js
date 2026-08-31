const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");

/**
 * Metro config for the monorepo mobile shell.
 * - watchFolders: source-direct linking of packages/* (no prebuild step)
 * - node_modules resolution follows symlinks (pnpm workspace)
 */
const projectRoot = __dirname;
const workspaceRoot = require("path").resolve(projectRoot, "../..");

const config = {
  projectRoot,
  watchFolders: [workspaceRoot],
  resolver: {
    // pnpm symlinks: resolve through them to real locations
    disableHierarchicalLookup: true,
    nodeModulesPaths: [
      require("path").resolve(projectRoot, "node_modules"),
      require("path").resolve(workspaceRoot, "node_modules"),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
