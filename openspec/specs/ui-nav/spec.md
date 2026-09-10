# ui-nav Specification

## Purpose

Defines the tab navigation data model (TabDefinition), visibility driven by CapabilityRegistry registration state, and the navigation state shell (bottom TabBar on mobile / left Sidebar on desktop). The shell renders platform skeletons; content components are pulled from the CapabilityRegistry by key.

## Requirements

### Requirement: TabDefinition 数据模型
`packages/ui-nav` SHALL 定义 `TabDefinition { id, capabilityKey, iconKey, titleKey, order, required? }`：id 为稳定标识（'records' | 'calendar' | 'read' | 'profile'，可扩展）；capabilityKey 指向 CapabilityRegistry 中的内容组件能力（如 'ui:tab:records'）；iconKey 为图标能力 key；titleKey 为文案 key（0b 硬编码中文）；order 决定排序；required 标记不可隐藏的 tab。

#### Scenario: 默认 tab 集合
- **WHEN** ui-nav 初始化
- **THEN** 输出 records/calendar/read/profile 四个 TabDefinition，order 递增，均携带各自的 capabilityKey

### Requirement: tab 可见性由能力注册状态决定
壳渲染 tab 列表时 SHALL 仅展示其 capabilityKey 已在 CapabilityRegistry 注册的 tab（按 order 排序）；未注册的 key 对应 tab 隐藏，壳不含任何插件特定逻辑。开发模式下未注册的 key SHALL 输出 console.warn 以便排查"tab 消失"问题。

#### Scenario: 插件关闭导致 tab 隐藏
- **WHEN** mood 插件（'read' tab 的能力提供者）未注册其能力且壳刷新 tab 列表
- **THEN** 'read' tab 不出现在导航中，其余 tab 正常展示，壳代码无 mood 相关分支

#### Scenario: dev 模式警告
- **WHEN** 开发模式下某 TabDefinition 的 capabilityKey 未注册
- **THEN** 控制台输出包含该 capabilityKey 的警告

### Requirement: 导航状态管理
ui-nav SHALL 提供导航状态（当前 tab id 与切换），切换仅更新状态不承载转场动画（动画属 Phase 5）。当前 tab 的内容组件 SHALL 经 `CapabilityRegistry.get(capabilityKey)` 拉取渲染。

#### Scenario: 切换 tab
- **WHEN** 用户点击另一 tab
- **THEN** 当前 tab id 更新，内容区渲染新 tab 的能力组件

### Requirement: 壳骨架平台分叉
导航骨架 SHALL 由壳渲染并按平台分叉：移动端为自绘底部 TabBar，桌面端为自绘左侧 Sidebar。骨架 SHALL NOT 使用 react-navigation/expo-router。tab 骨架的视觉数据（标题、图标）来自 TabDefinition，骨架本身不持有 tab 定义。

#### Scenario: 移动端骨架形状
- **WHEN** apps/mobile 渲染 AppShell
- **THEN** 出现底部 TabBar，tab 按'order 排列，点击可切换

#### Scenario: 桌面端骨架形状
- **WHEN** apps/desktop 渲染 AppShell
- **THEN** 出现左侧 Sidebar，同一份 TabDefinition 渲染，点击可切换