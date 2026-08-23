---
name: aukcraft-site-design
description: Reproduce the aukcraft.org page shell and design system (dark editorial style, interactive dot-field dynamic background, Flight Line motion language, bilingual routes) on a new Astro + Tailwind static site. Use whenever creating a new aukcraft project site or sub-site (e.g. peregrine.aukcraft.org style pages), when the user asks to copy/reuse the aukcraft website's overall look, dynamic background, header, footer, or motion style, when adding sections or pages to an existing aukcraft-family site, or when a page must visually match aukcraft.org. Provides drop-in asset files, scenario references for new sites vs extending existing ones, a brand audit script (scripts/audit_brand.py), and the hard design rules that keep the result consistent.
---

# aukcraft 网站设计规范

aukcraft.org 的完整、经生产验证的「外壳」，以可直接套用的文件形式打包在 `assets/`。应用本 skill 后，新站点获得与 aukcraft.org 相同的 token、动态背景、页头页脚与交互原语——内容不同，可见的形制完全一致。

内容板块（Philosophy、Projects、Workflow 等）刻意不包含在内：那些是站点自己的文案。本 skill 覆盖的是可复用的底盘 + 让新板块与底盘保持一致的规则。

## 设计观

这套规则为什么长这样：

- **一致性来自共享内核，不来自共享界面。** 网站、桌面 app、移动 app 读作一家人，靠的是同一套中性色 token、同一套分层与动效纪律——而不是把网站的元素搬进别的载体。载体不同，表达不同；内核相同，家族成立。
- **美观是纪律的副产品。** 零阴影、发丝线、≤4px 圆角、accent 配给——这些限制的目的不是限制，而是让任何页面被任何人（或任何 agent）添加内容之后仍然保持整体感。规则越硬，发挥的余地反而越大。
- **accent 是产品身份，不是装饰。** 每个产品一个 accent，只出现在引导视线的地方：焦点、主操作、链接、选中、实时状态。颜色越少，出现的那一处越有力量。
- **每个页面只有一个视觉重心。** 字标点阵在 Hero、flight 级 CTA 一页面一意图一个——读者的视线落点是被设计出来的，不是碰运气的。
- **克制没有成本。** 这套规则里没有一条需要预算，它只需要事先做出决定。

## 情形选择：先读对应的 reference

| 情形 | 读这个 | 思路概要 |
|---|---|---|
| **新建站点/子站**（如 peregrine.aukcraft.org 风格） | `references/new-site.md` | 脚手架 → 复制 assets → 只定制三个身份点 |
| **向现有 aukcraft 家族站点添加板块/页面** | `references/extend-site.md` | 布局家族审计 → 用原语拼板块 → 双语路由与 CTA 层级 |

## 品牌审计脚本

`scripts/audit_brand.py` 静态扫描源码/样式文件中的硬性规则违规：

```bash
# 扫描整站的 CSS / Astro / TSX 文件
python scripts/audit_brand.py <路径...>

# 示例：审计网站源码
python scripts/audit_brand.py website/src
```

检查项：box-shadow、超过 4px 的圆角、纯黑/纯白、**过艳颜色**（HSV S > 0.90 的霓虹区，「不艳即舒适」的机器执行）、teal 的出现位置（配给审计需人工确认语境，脚本负责把每一处列出来）。退出码非零 = 存在违规，可挂 CI。

## 硬性设计规则（品牌设计系统 v2）

这些规则是站点看起来浑然一体的原因。新增任何内容时全部执行：

- **零阴影，恒成立。** 层次靠表面明度（`base #0B0E11` 在下、`raised #14181D` 在上）+ 1px 发丝线（`rgba(255,255,255,0.08)`）表达。
- **圆角一律 ≤ 4px**（Tailwind 默认圆角已设为 4px；Flight Line 环用 `rx: 3`）。
- **Auk Teal `#14B8A6` 是配给制**：只给链接、CTA、Flight Line、焦点环、画布中的光标填充。绝不装饰、绝不铺背景。
- **单一暗色主题。** 无亮色板块，无纯 `#000` 或 `#fff`。
- **动效尊重 `prefers-reduced-motion`**：描边/渐现降级为直接变色或静态。无自动播放或循环动画（唯一例外是 HeroCanvas 的待机波浪，品牌签名）。
- **衬线斜体点缀仅限英文关键词**（Newsreader italic，如 "Craft the *architecture*."）；中文点缀用 `.serif-zh`（Noto Serif SC）。绝不随意撒衬线。
- **CTA 层级**：带 `text-teal` 的 `.flight` 按钮是主操作；`text-ink` 是次要操作。同一页面同一意图只保留一个 flight 级 CTA；同一目的地的重复入口降级为 `.link-line`。
- **布局家族在同一页面内不得重复**（卡片网格、发丝线行列表、终端块、散文+链接是不同家族）。加板块前先审计。
- **板块节奏**：`mx-auto max-w-5xl px-6`，板块内边距 `py-40 md:py-56`。每个板块以 `SectionHeading`（`NN ─ LABEL` 等宽小字 + 发丝线）开场。
- **emoji 极度克制**；仅开源口吻，无公司化语言。

## 文件地图（`assets/`）

| 资产 | 复制到（目标项目） | 提供 |
|---|---|---|
| `global.css` | `src/styles/global.css` | 全部设计 token（颜色、`--ease-lock`、4 个动效时长、z-index 梯度）+ 原语：`.flight` / `.flight-line`、`.link-line`、`[data-reveal]` + 级联、`.glass` / `.glass-deep`、`.noise`、`.skip-link`、`.micro`、`.serif-zh`、`.puffin-mark` 配色、scroll-snap、focus-visible、reduced-motion 降级 |
| `tailwind.config.mjs` | 项目根目录 | token 到 Tailwind 的映射：6 色、字体栈、圆角 4px、`max-w-prose 65ch`、`ease-lock` |
| `Layout.astro` | `src/layouts/Layout.astro` | 页面外壳：字体加载、由 `lang` prop 驱动的 SEO/canonical/hreflang/og、`skip-link`、`<DotField />`、噪点叠加、滚动渐现 IntersectionObserver、`html.js` 门控 |
| `components/DotField.astro` | `src/components/` | 全站动态背景：固定画布点阵（30px 间距、5% ink 空心环）；光标附近点填 teal 并带缓动距离衰减；轨迹稳定后休眠；reduced-motion 下静态 |
| `components/HeroCanvas.astro` | `src/components/` | Hero 背景：字标（默认 `AUKCRAFT`）采样为点阵；空心环、光标附近 teal 填充、缓慢待机波浪；字体加载与 resize 时重采样 |
| `components/FlightLine.astro` | `src/components/` | SVG 周长描边元素；放进任意 `.flight` 元素，可选 `duration` prop |
| `components/SectionHeading.astro` | `src/components/` | `01 ─ LABEL` 板块开场 + 发丝线 |
| `components/Hero.astro` | `src/components/` | 页头（字标 + 语言切换 + GitHub 链接，单行）与 hero（衬线点缀标题、≤20 词正文、层级正确的双 CTA）的参考实现 |
| `components/Footer.astro` | `src/components/` | 页脚：字标、板块锚点导航、带角色说明的联系邮箱、发丝线分隔的版权行 |
| `components/PuffinMark.astro` | `src/components/` | aukcraft 海鹦吉祥物（内联 SVG，暗色 `.pm-*` 类）。aukcraft 家族站点保留；非 aukcraft 品牌站点替换 |

## 交付前检查清单（共用）

情形特有项在各自的 reference 里；以下是都要过的（其中大部分可用 `scripts/audit_brand.py` 机器检查）：

- [ ] teal 审计：仅链接 / CTA / 动效线 / 焦点 / 画布光标填充
- [ ] 圆角审计：无超过 4px；零阴影
- [ ] 单一暗色主题；无纯黑/纯白
- [ ] reduced-motion：描边、渐现、画布全部降级为静态/变色
- [ ] 每个板块以 SectionHeading 开场；节奏 `max-w-5xl px-6 py-40 md:py-56`
- [ ] 布局家族无重复；CTA 层级（teal 主 / ink 次）成立
- [ ] 页头单行渲染；页脚符合参考结构
- [ ] `npm run build` 通过；双语路由（如适用）均可渲染
