## ADDED Requirements

### Requirement: 插件注册与生命周期
PluginManager SHALL 支持注册实现 `AukPlugin` 契约的插件，并以 connect/create 分离的两阶段初始化：connect 在配置期执行一次（校验+握手，产生 opaque 持久化状态），create 在每次启动时从持久化状态纯重建实例，不再握手。

#### Scenario: 首次注册触发 connect
- **WHEN** 插件首次被注册且无持久化状态
- **THEN** PluginManager 调用 `connect(ctx)` 一次，并将返回的 connection state 以 opaque 形式持久化（核心不解释其内容）

#### Scenario: 重启走 create 纯重建
- **WHEN** 插件已有持久化 connection state 且应用重启
- **THEN** PluginManager 跳过 connect，直接调用 `create(ctx, conn)` 重建实例，过程不产生网络或凭证交互

#### Scenario: 配置期失败要响
- **WHEN** `connect` 抛出错误
- **THEN** 错误被上抛给调用方（host/设置界面）呈现给用户，插件不进入已加载状态

#### Scenario: 运行期失败静默隔离
- **WHEN** 某一插件在事件分发或实例方法调用中抛出运行期错误
- **THEN** PluginManager 逐插件 try/catch，跳过该失败插件，其余插件与核心功能不受阻塞

### Requirement: 插件分级
每个插件 SHALL 声明 `tier: 'locked' | 'recommended' | 'optional'`。`locked` 插件不可卸载；`recommended` 卸载需二次确认与风险提示；`optional` 自由开关。PluginManager MUST 拒绝卸载 `locked` 插件。

#### Scenario: 拒绝卸载核心插件
- **WHEN** 调用卸载一个 tier 为 `locked` 的插件
- **THEN** PluginManager 拒绝该操作并返回明确错误

### Requirement: 权限声明与校验
每个插件 SHALL 在契约中声明所需权限列表（如 `storage:read`、`network:fetch`）。PermissionManager SHALL 提供 `assertPermission(pluginId, permission)` 校验 API，未声明权限的调用 MUST 抛出权限错误。

#### Scenario: 校验已声明权限
- **WHEN** 插件已声明 `storage:read` 并调用 `assertPermission(pluginId, 'storage:read')`
- **THEN** 校验通过

#### Scenario: 未声明权限被拒绝
- **WHEN** 插件调用 `assertPermission(pluginId, 'network:fetch')` 但未声明该权限
- **THEN** 抛出权限错误

### Requirement: 三层通信
核心 SHALL 提供三个通信通道且边界明确：(1) EventBus 用于通知类 fire-and-forget 事件（如 `record:created`）；(2) CapabilityRegistry 用于 UI 组件等能力的注册与拉取（如 `ui:rating-input`）；(3) ServiceRegistry 用于核心服务接口的运行时绑定与获取（如 `storage`）。插件 SHALL NOT import 其他插件的内部实现文件，仅允许依赖 `@auktake/core` 的接口定义。

#### Scenario: 事件发布订阅
- **WHEN** 插件 A `emit('record:created', payload)` 且插件 B 已 `on('record:created')`
- **THEN** 插件 B 的回调收到该 payload，且事件监听器抛错不影响发布方

#### Scenario: 能力注册与拉取
- **WHEN** rating 插件 `register('ui:rating-input', Component)` 且 edit 插件 `get('ui:rating-input')`
- **THEN** edit 拿到同一 Component 引用；未注册的 key 返回 undefined 而非抛错

#### Scenario: 服务注入与获取
- **WHEN** host 在引导时 `services.register('storage', sqliteImpl)` 且插件 `services.get<Storage>('storage')`
- **THEN** 插件获得该实现引用；core 不依赖任何具体实现类型

### Requirement: 核心零平台依赖
`@auktake/core` 包 SHALL NOT 依赖 `react-native`、`react`、`@tauri-apps/*` 或任何浏览器/Node 专属 API，MUST 在纯 Node 环境（vitest）下可完整测试。CapabilityRegistry SHALL 以泛型方式持有组件（`register<T>(key, value: T)`），不引入 React 类型。

#### Scenario: 删除任一插件核心照常通过
- **WHEN** 仓库中移除任何插件实现代码后运行核心测试
- **THEN** `@auktake/core` 全部单测通过（核心通过 fake plugin 泛化验证，不依赖真实插件）
