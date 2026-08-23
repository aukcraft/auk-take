## ADDED Requirements

### Requirement: pnpm workspace monorepo
仓库 SHALL 采用 pnpm workspace 多包结构，包置于 `packages/` 下（首个包为 `packages/core`，即 `@auktake/core`）。根目录 SHALL 提供统一脚本：lint、typecheck、test。

#### Scenario: 根级脚本运行
- **WHEN** 在仓库根执行 `pnpm test`
- **THEN** 所有 workspace 包的测试被执行且失败任一即整体失败

### Requirement: turbo 任务编排
构建 SHALL 使用 turbo 编排任务依赖（如 `build` 依赖其内部依赖包的 `build`），缓存生效。

#### Scenario: 增量构建命中缓存
- **WHEN** 未改动代码再次执行 `pnpm build`
- **THEN** turbo 命中缓存，任务瞬时完成且输出与上次一致

### Requirement: CI 流水线
GitHub Actions SHALL 在 PR 与 push 到主分支时运行 lint、typecheck、test 全部三类任务。

#### Scenario: PR 触发 CI
- **WHEN** 向主分支发起 PR
- **THEN** CI 运行 lint/typecheck/test，任一失败则检查不通过

### Requirement: 核心包零平台依赖约束
`@auktake/core` 的 `package.json` MUST NOT 声明 `react-native`、`react`、`@tauri-apps/*` 及任何平台专属依赖。此约束 SHALL 由 CI 显式校验。

#### Scenario: CI 拒绝平台依赖进入 core
- **WHEN** PR 向 `packages/core/package.json` 添加 `react-native` 依赖
- **THEN** CI 的依赖检查步骤失败并给出明确报错
