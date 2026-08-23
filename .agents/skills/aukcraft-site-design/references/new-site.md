# 新建站点 / 子站

从零搭建一个 aukcraft 家族站点（如 peregrine.aukcraft.org 风格的项目站）。核心思路：**复制生产验证过的外壳，只定制身份点，不重写底盘**。

## 流程

### 1. 脚手架

Astro + Tailwind v3（`@astrojs/tailwind`），`output: 'static'`。

### 2. 安装字体

`@fontsource-variable/inter`、`@fontsource-variable/newsreader`、`@fontsource/jetbrains-mono`。（Noto Sans SC / Noto Serif SC 通过 Layout 中的 Google Fonts `<link>` 加载——保留，用于 CJK 支持。）

### 3. 复制资产

按 SKILL.md 的文件地图把 `assets/` 全部复制到位。

### 4. 组织页面

`Layout` 包裹 `<main id="main">`，一个板块一个组件；把 `lang`（`'en' | 'zh'`）一路传下去。**双语 = 分离路由**（`/` 与 `/zh/`），绝不内联混排。

### 5. 用原语拼板块，不发明新原语

`.flight` + `<FlightLine />` 做按钮，`.link-line` 做行内链接，需要淡入上移的块加 `data-reveal`，DotField 之上的表面用 `.glass` / `.glass-deep`，小号大写 mono 标签用 `.micro`。

### 6. 只定制三个身份点

1. `HeroCanvas.astro` 里的字标字符串（`const text = 'AUKCRAFT'`）
2. `Layout.astro` 里的 title / description / canonical URL
3. 非 aukcraft 品牌站点替换 `PuffinMark.astro` 吉祥物

### 7. 文案约定

关键技术术语（crate、CI、PR、SDD、TDD）即使在中文文案中也保持英文。开源口吻，无公司化语言，emoji 极度克制。

## 新建情形检查清单

在 SKILL.md 共用清单之外额外确认：

- [ ] 外壳文件与 `assets/` 逐字节一致（除三个身份点外无"顺手改进"）
- [ ] 只有三个身份点被定制：字标、SEO 元信息、（非家族站点时）吉祥物
- [ ] 双语路由分离，`/` 与 `/zh/` 均渲染，hreflang/canonical 正确
- [ ] 跑一遍 `scripts/audit_brand.py <项目src>` 无违规
- [ ] `npm run build` 通过
