---
name: aukcraft-mobile-design
description: Design rules for aukcraft mobile application UIs (native iOS/Android, React Native, Flutter, Tauri Mobile, or any mobile toolkit). Use whenever designing, building, or auditing a mobile app's interface in the aukcraft family, or when a mobile UI must visually belong to the aukcraft brand. Shares the neutral token core and restraint philosophy with aukcraft-app-design (desktop) and aukcraft-site-design (web), adapted for touch, safe areas, one-handed use, and platform idioms. Includes a theme generator script (scripts/generate_theme.py, with a platform-neutral JSON format for non-CSS stacks) and touch/navigation pattern references.
---

# aukcraft 移动端设计规范

aukcraft 品牌在触屏上的落地。与桌面端规范同一哲学——**app 是安静的工具，不是舞台**——但面对的是一个没有 hover、默认没有键盘焦点、用拇指而非光标、OS 拥有更多 chrome 的环境。

## 设计观

与全家族共享的判断（详细论述见 `aukcraft-site-design` / `aukcraft-app-design` 的同名章节）：

- **一致性来自共享内核，不来自共享界面**——与桌面端/网站读作一家人靠的是 token 与纪律，不是移植元素。
- **美观是纪律的副产品**——限制让任何新增内容不破坏整体感。
- **accent 是产品身份，不是装饰**——一个产品一个 accent，只给引导视线之处。
- **每个屏幕只有一个视觉重心**——小屏尤其输不起第二个。
- **克制没有成本**——它只需要事先做出决定。

## 情形选择：先读对应的 reference

| 需求 | 读这个 |
|---|---|
| **新建移动端项目**（平台选择、布局语法、导航结构、平台事项） | `references/new-project.md` |
| **查具体模式**（触摸反馈、触控几何、密度字号、动效与电量） | `references/patterns.md` |

移动端目前只有新建场景；若未来出现升级既有移动 app 的需求，先读桌面端 skill 的 `references/upgrade.md`——审计先行、只改视觉层的思路同样适用，再回本 skill 查移动端特有规则。

## 主题生成脚本

与桌面端同一个生成器（本 skill 自带副本），移动端常用 `json` 格式喂给非 CSS 栈：

```bash
# 平台无关 token JSON（React Native / Flutter / SwiftUI 主题对象的原料）
python scripts/generate_theme.py --accent "#2563EB" --accent-soft "#60A5FA" --format json

# WebView 类栈（Tauri Mobile 等）直接用 css / shadcn / tailwind 格式
python scripts/generate_theme.py --accent "#2563EB" --format css
```

生成产物示例见 `assets/examples/peregrine-mobile-tokens.json`。

## 共享核心（与桌面端一致，不可协商）

- 中性色 token 原样落地：`base #0B0E11`、`raised #14181D`、发丝线 `rgba(255,255,255,0.08)`、`ink #EDEDED`、`muted #8A9199`、`ease-lock` 缓动。
- **每个 app 声明一个产品 accent**（Peregrine：品牌蓝 `#2563EB` 家族；组织级界面：Auk Teal）。配给制：只给唯一主操作、链接、选中标记、实时状态。绝不用于填充、徽标、装饰。暗色界面上用 accent 的 400 浅阶保证对比度。
- app 自有界面零阴影；层次 = 明度差 + 1px 发丝线；圆角 ≤ 4px。
- 仅暗色主题；绝不纯 `#000` / `#FFF`。抵抗 OLED 上用纯黑的诱惑——`#0B0E11` 的蓝调才是家族辨识度的来源。
- 不要动态背景、不要玻璃拟态、不要环境或循环动效。静止的屏幕就是品牌签名。
- Micro 标签（mono、全大写、`0.15em` 字距、`muted` 色）用于分组标题与状态。
- emoji 极度克制；开源口吻；技术术语在所有语言中保持英文。

## 移动端的三条总原则（细节都在 references/patterns.md）

1. **触摸取代 hover**——按压反馈即时（accent 边框 + 不透明度/缩放，不播描边动画），选中态常驻可见，不可交互元素零响应。
2. **平台惯习高于品牌**——导航、选择器、权限、分享面板用原生；品牌活在 app 自己的表面上。和平台对着干的 app，在被读出品牌之前就先被读成了"坏了"。
3. **每个像素都有电量成本**——没有 rAF 循环、没有待机动画、没有视差；过渡 ≤ 300ms。

## 与其他 aukcraft 规范的关系

- `aukcraft-site-design`——网站外壳（编辑式、动态背景、双语路由）。其中没有任何东西可以移植到移动端 app。
- `aukcraft-app-design`——桌面端规范；与本 skill 共享核心与哲学。同时发布桌面与移动的 app 家族应该读作同一个产品：同样的 token、同样的 accent、同样的标签语气，不同的几何。

## 交付前检查清单

- [ ] 中性色核心原样落地；只声明一个产品 accent，暗色下用 400 浅阶；仅暗色、无纯黑
- [ ] 圆角 ≤ 4px；app 自有界面零阴影；明度 + 发丝线分层
- [ ] 所有触控目标 ≥ 44pt/48dp、间距 8px；主操作在拇指区；安全区 inset 已处理
- [ ] 按压反馈即时（accent 边框 + 不透明度/缩放）；选中态常驻可见
- [ ] accent 审计：仅主操作 / 链接 / 选中 / 实时状态
- [ ] 导航遵循平台惯习（底部 tab / 原生栈 / 返回手势）；弹层可滑动关闭
- [ ] 动效 ≤ 300ms、无环境循环、reduced-motion 降级；触感可选且稀少
- [ ] 原生选择器/权限/分享面板零改动；动态字体缩放下布局不破
- [ ] 分组标题/状态用 micro 标签；chrome 无衬线；emoji 克制
