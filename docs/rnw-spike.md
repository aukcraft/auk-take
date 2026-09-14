# RNW 渲染 spike（Phase 1 任务 2.1）

目标：在铺开插件 UI 前，验证 react-native-web 0.21.2 对 Phase 1 关键 RN 子集的
支持情况，锁定「单源 RN 语法」的可行边界与降级决策。方法：直接审查
`apps/desktop` 锁定版本 RNW 0.21.2 的发行源码（`node_modules/.pnpm/
react-native-web@0.21.2*/dist`），结论在 7.4 双端冒烟时做运行时复核。

## 结论一览

| RN API | RNW 0.21.2 支持 | 证据（vendor/exports 源码） | 决策 |
| --- | --- | --- | --- |
| `FlatList numColumns` | 支持 | `vendor/react-native/FlatList/index.js`：`numColumnsOrDefault` 分块渲染行（`index * numColumns + kk`），行数 `Math.ceil(data.length / numColumns)`，支持 `columnWrapperStyle` | 单源使用 FlatList 网格；不用手写 ScrollView 列 |
| `flexWrap: "wrap"` 于 VirtualizedList | 明确不支持 | VirtualizedList 源码对 `flexWrap: wrap` 输出 console.warn 并建议改用 numColumns | 网格一律 numColumns，禁 wrap |
| `Modal` | 支持 | `exports/Modal/`：ModalPortal（document.body 挂载）+ ModalAnimation + ModalFocusTrap，`visible/transparent/animationType/onRequestClose` 全实现 | 编辑弹层/详情弹层单源用 RN `<Modal>`；absolute View 遮罩降级路径不需要启用 |
| `TextInput` 多行 | 支持 | `exports/TextInput/index.js`：`multiline` 映射 `<textarea>`（`component = multiline ? 'textarea' : 'input'`），支持 `numberOfLines→rows` | 观后感多行输入单源 TextInput |
| `KeyboardAvoidingView` | 有效 no-op | 源码 `onKeyboardChange(event) {}` 空实现，render 退化为普通 `<View>` | 与 design D8 预期一致：桌面端无软键盘，包裹不产生副作用；移动端正常生效 |

## 降级决策记账

- 若冒烟发现 RNW Modal 在 Tauri WebView 有焦点/层级异常 → 降级为 absolute
  View 遮罩（同文件分支），结构已按「Modal 内内容独立组件」组织，替换只动容器。
- 网格列数：移动 3 列固定；桌面按 `useWindowDimensions` 宽度断点增列
  （≥640px 4 列、≥960px 6 列，实现期以 2:3 卡片实测定，design 开放问题）。

## 运行时复核状态

- [x] 静态源码验证（本文件）
- [ ] 7.4 双端冒烟运行时复核（Tauri 窗口内逐项点检）
