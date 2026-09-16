## ADDED Requirements

### Requirement: Phase 5 契约常量与类型
ui-contracts SHALL 以常量导出 Phase 5 的跨插件 key：`cmd:mood-add`、`ui:overlay:mood`（加入 OVERLAY_KEYS）、`ui:tab:read`、`cmd:share-poster`、事件名 `mood:created`（MOOD_EVENTS，payload `{id}`）。SHALL 导出契约类型：`MoodAddCommand`（`(recordId: string) => void`）、`SharePosterCommand`（`(recordId: string) => Promise<ShareResult>`）、`ShareResult`（`{status:"shared"|"downloaded"|"cancelled"} | {status:"error", message}`）、心情档语义 key 类型（`MoodKind = "love"|"ok"|"meh"|"bored"|"sad"`）。SHALL 导出 **motion 设计令牌**（`MOTION`：duration fast/base/slow 毫秒数与 easing 定义，JS 对象双端同源，与色板同构）。供需双方 SHALL 引用常量；新增 key 与 Phase 1–4 既有全部 key 全局唯一。

#### Scenario: 常量唯一性
- **WHEN** 校验 Phase 5 新增 key
- **THEN** 与 Phase 1–4 既有 key 无重复

#### Scenario: motion 令牌双端同源
- **WHEN** ui-nav 转场与 display 淡入读取动画参数
- **THEN** 均取自同一 `MOTION` 对象，无各自硬编码
