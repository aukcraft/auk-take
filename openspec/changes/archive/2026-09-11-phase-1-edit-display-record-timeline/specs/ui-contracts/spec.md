## ADDED Requirements

### Requirement: 能力 key 与事件名单一来源
`packages/ui-contracts` SHALL 以常量导出全部跨插件协作的能力 key（`cmd:record-edit`、`cmd:record-delete`、`cmd:record-detail`、`ui:view:timeline`、`ui:overlay:root`）与事件名（`record:created`、`record:updated`、`record:deleted`，payload 均为 `{ id: string }`）。提供方与消费方插件 SHALL 引用这些常量而非硬编码字符串字面量。

#### Scenario: 供需双方引用同一常量
- **WHEN** edit 插件注册命令能力且 display 插件拉取该命令
- **THEN** 双方均引用 `ui-contracts` 导出的同一 key 常量，key 漂移在编译期不可表示

#### Scenario: 事件 payload 契约
- **WHEN** edit 插件发布任一 `record:*` 事件
- **THEN** payload 为 `{ id }`，id 为被变更记录的 ULID，类型由 ui-contracts 契约类型约束

### Requirement: 契约类型零平台依赖
ui-contracts 导出的命令与组件契约类型（如 `RecordEditCommand`、`RecordDeleteCommand`、`RecordDetailCommand`、`TimelineComponent`）SHALL 为纯 TypeScript 类型；ui-contracts 包 SHALL NOT import 任何平台 API 或运行时模块（react 仅以 peer 形式用于组件类型标注），MUST 在纯 Node 环境下可被 import 并完成类型检查。

#### Scenario: 纯 Node 可消费
- **WHEN** 在 vitest（纯 Node，无 jsdom）测试中 import ui-contracts 的全部导出
- **THEN** 加载成功且无渲染器/平台 API 依赖

### Requirement: 设计令牌双端同源
ui-contracts SHALL 导出最小设计令牌集（颜色、间距、圆角、字重、海报占位色板 ≥8 色、热力图 5 级强度色），以普通 JS 对象供移动端与桌面端共同消费。海报占位色板 SHALL 提供确定性映射函数（输入记录标题文本，输出唯一色槽）；相同标题在双端 MUST 得到相同颜色（重看同片新纪录颜色一致）。

#### Scenario: 占位色确定性
- **WHEN** 对同一记录标题在两端分别调用占位色映射
- **THEN** 返回相同色板槽位（颜色值相等）

#### Scenario: 热力图分级色完整
- **WHEN** 渲染日历热力图
- **THEN** 0 至最高强度每一级均有明确令牌色，无未定义档位

### Requirement: 共享投影工具
ui-contracts SHALL 提供 `createCollectionProjection` headless 工具：以注入的 Storage 服务加载指定集合，订阅指定事件名列表触发失效，microtask 级合并去抖后重载；暴露不可变快照 `getState()` 与 `subscribe(listener)` 退订句柄。该工具 SHALL 为纯 TS（平台能力经参数注入），在纯 Node 环境可测。

#### Scenario: 事件失效与合并去抖
- **WHEN** 同一 tick 内连续发布 `record:created`、`record:updated` 两个失效事件
- **THEN** 投影仅触发一次重新 loadAll，订阅者仅被通知一次

#### Scenario: 启动全量加载
- **WHEN** 投影初始化
- **THEN** 从 Storage `loadAll` 拉取集合全量，状态从初始空转为就绪

### Requirement: 依赖方向约束
ui-contracts SHALL 仅以 peer 依赖 `@auktake/core`（仅类型引用）；plugin-* 包 SHALL 仅依赖 `@auktake/core` 与 `@auktake/ui-contracts`（ui-nav 仅在需要 tab key 时）；插件包之间 SHALL NOT 互相依赖，SHALL NOT 依赖 platform-* 或 apps。违规 MUST 被 CI 依赖守卫拒绝。

#### Scenario: 插件互相依赖被 CI 拒绝
- **WHEN** PR 向 plugin-display 添加对 plugin-edit 的依赖
- **THEN** CI 依赖守卫步骤失败并指明「插件间依赖被禁止」
