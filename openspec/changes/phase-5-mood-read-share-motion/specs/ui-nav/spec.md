## MODIFIED Requirements

### Requirement: 导航状态管理
ui-nav SHALL 提供导航状态（当前 tab id 与切换）。Phase 5 起，tab 切换 SHALL 承载转场动画：内容区淡入 + 短位移（时长/缓动取自 ui-contracts motion 令牌，双端同源；仅 RN 内置 Animated API，opacity/transform 优先 useNativeDriver）。`AccessibilityInfo.isReduceMotionEnabled()` 为 true 时动画 SHALL 瞬时完成。当前 tab 的内容组件 SHALL 经 `CapabilityRegistry.get(capabilityKey)` 拉取渲染。

#### Scenario: 切换 tab
- **WHEN** 用户点击另一 tab
- **THEN** 当前 tab id 更新，内容区渲染新 tab 的能力组件，并伴随淡入转场

#### Scenario: reduced-motion 降级
- **WHEN** 系统开启减弱动态效果
- **THEN** tab 切换无动画直接呈现

## ADDED Requirements

### Requirement: 横滑手势切 tab
移动端内容区 SHALL 支持横滑切换相邻 tab：仅 RN 内置 PanResponder 实现；手势判定 SHALL 要求横向主导（|dx| > 2|dy|）且位移超过阈值（60px）方触发切换，垂直滚动不受抢占；桌面端无此手势（指针设备无语义）。

#### Scenario: 横滑切换
- **WHEN** 移动端内容区横滑超过 60px 且横向主导
- **THEN** 切换到相邻 tab（含转场动画）

#### Scenario: 垂直滚动不误触
- **WHEN** 用户在内容区垂直滚动
- **THEN** 手势判定为纵向，tab 不切换
