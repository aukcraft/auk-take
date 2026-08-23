# 平台 fork 机制：扩展名解析与双构建器配置

## 文件约定

```
src/
├── PlayerScreen.native.tsx   # 平台 A（Metro/RN）
├── PlayerScreen.web.tsx      # 平台 B（Vite/web）
└── index.ts                  # export { PlayerScreen } from './PlayerScreen';  ← 无扩展名
```

两个 fork 文件必须导出**同名、同 props 类型**的组件（fork 实现不 fork 契约）。

## 构建器配置

### Metro（RN 侧）
- 平台扩展自动生效：platform 为 ios/android 时 `.native.tsx` 命中，`.web.tsx` 不会被 native 构建选中
- monorepo 必须：`watchFolders` 覆盖 workspace 包、nodeModulesPaths 解析 pnpm symlink
- 源码直连：各包 package.json 加 `"react-native": "src/index.ts"` → 改包无需预构建

### Vite（web 侧）
```ts
// vite.config.ts
export default {
  resolve: {
    extensions: ['.web.tsx', '.web.ts', '.tsx', '.ts', ...],  // .web 优先
    alias: { 'react-native': 'react-native-web' },            // 渲染器别名
  },
};
```

## tsconfig moduleSuffixes（与运行时解析对齐）

```jsonc
// native 消费方（rn-app）
{ "compilerOptions": { "moduleSuffixes": [".native", ".web", ""] } }

// web 消费方（desktop-app）
{ "compilerOptions": { "moduleSuffixes": [".web", ""] } }
```

忘配的症状：类型检查过了但加载的是另一个平台的实现，或类型报错指向"不存在"的导出。

## 排查表：一端好一端坏

1. 两端实际解析到同一文件了吗？（构建器 resolve 日志 / 临时 console.log 探针）
2. fork 文件 props 契约一致吗？
3. moduleSuffixes / extensions 配对了吗？
4. 共享文件里用了 RNW 不支持的 API？（web 静默渲染空）
5. 平台指纹（如 `'__TAURI_INTERNALS__' in window`）在模块顶层只算一次
