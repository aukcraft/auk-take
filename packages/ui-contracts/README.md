# @auktake/ui-contracts

中立跨插件契约包：能力 key / 事件名常量、命令与组件契约类型、最小设计令牌、
共享投影工具 `createCollectionProjection`。零平台 API，纯 Node 可 import 与测试
（react 仅为类型 peer）。

## moduleSuffixes 约定

本包**不分发任何 `.native` / `.web` 平台分叉文件**，因此采用默认模块解析
（无 `moduleSuffixes`）。双端壳（mobile: `[".native",""]`，desktop:
`[".web",""]`）解析本包无后缀源文件时行为完全一致，即「moduleSuffixes 与
双端一致」的落地方式是：共享包不产生后缀分叉。后续包如需分叉，fork 必须成对
提供并在包内 tsconfig 显式声明双端后缀。

## 依赖方向

- peer: `@auktake/core`（仅类型）、`react`（仅组件类型）
- 禁止：任何平台 API、运行时渲染器、其他 @auktake/* 包
