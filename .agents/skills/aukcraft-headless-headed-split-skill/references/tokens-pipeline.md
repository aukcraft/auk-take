# 设计令牌流水线（单源 → 多端代码生成）

## 结构

```
design-tokens/
├── tokens.ts        # 唯一事实来源：const tokens = { colors: {...}, spacing: {...}, radii, typography }
└── build.mjs        # 读取 tokens.ts → 生成各端产物
    ├── lib/rn.ts    # RN 主题对象（TS import）
    └── dist/tokens.css  # CSS 自定义属性（web 注入）
```

可扩端：Kotlin 主题、Swift Assets、Flutter ThemeData、JSON（设计工具）。

## tokens.ts 形状（示例）

```ts
export const tokens = {
  colors: { bgCanvas: '#0b0d10', bgSurface: '#15181d', accent: '#3ddc97', textPrimary: '#e8eaed', ... },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  radii: { sm: 6, md: 10, full: 9999 },
  typography: { fontSizeSm: 12, fontSizeMd: 14, fontWeightBold: '700' },
} as const;
```

## build.mjs 要点

1. import tokens.ts（或经 tsx/esbuild 读取）
2. 每端一个写出函数：
   - RN：`export const theme = ${JSON.stringify(tokens, null, 2)};`
   - CSS：遍历叶子生成 `--color-bg-canvas: #0b0d10;`（路径转 kebab-case）
3. 产物进 .gitignore 或提交皆可（提交利于消费方无构建使用；生成物标注"DO NOT EDIT"头注释）
4. package.json 挂 `build` 脚本；CI 校验产物与源一致（重新生成无 diff）

## 消费规则

- RN/共享组件：`import { theme } from '@x/design-tokens/rn'` → `theme.colors.bgCanvas`
- Web：入口注入 `dist/tokens.css` → `var(--color-bg-canvas)`
- **屏幕代码禁止手写十六进制/魔法数字** —— review 检查项
- 语义命名（bgCanvas 而非 gray900）：换主题时只改令牌不改屏幕

## 关键原则

一致性靠构造：两端 import 同一次生成的产物，漂移在构造上不可能。
手写映射 = 允许漂移；生成映射 = 漂移不可表示。
