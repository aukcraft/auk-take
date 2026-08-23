# 向现有 aukcraft 家族站点添加板块 / 页面

底盘已经在了，新内容要读起来像「本来就长在这里」。核心思路：**先审计既有页面用了什么，再用原语拼新板块，让差异只来自内容**。

## 流程

### 1. 布局家族审计

列出目标页面（及全站）已使用的布局家族。同一页面内布局家族不得重复——可用的家族包括：

- 卡片网格（`raised` 表面 + 发丝线）
- 发丝线行列表（行间 1px 发丝线，无卡片）
- 终端/代码块（mono、`base` 上的 `raised` 块）
- 散文 + 行内链接（`max-w-prose`、`.link-line`）
- 大字号声明段（衬线点缀标题 + 短正文）

新板块先从「本页还没用过的家族」里选；全站层面也尽量避免相邻页面结构雷同。

### 2. 板块结构

- 每个板块以 `SectionHeading` 开场：`NN ─ LABEL`（两位编号、JetBrains Mono、全大写、`0.15em` 字距）+ 发丝线
- 节奏：`mx-auto max-w-5xl px-6`，板块内边距 `py-40 md:py-56`
- 需要渐现的块加 `data-reveal`（同级自动级联 70ms）；reduced-motion 下自动降级，不用额外处理

### 3. CTA 与链接层级

- 同一页面同一意图只保留**一个** flight 级 CTA（`.flight` + `text-teal`）；次要操作 `text-ink`
- 同一目的地的重复入口降级为 `.link-line` 行内链接
- 正文里的链接一律 `.link-line`，不要给正文链接加按钮样式

### 4. 双语

- 新页面按既有模式建双路由：`/path/` 与 `/zh/path/`，`lang` prop 传给 `Layout`（canonical / hreflang / og 由 Layout 自动生成）
- 新板块英文、中文文案成对维护；技术术语（crate、CI、PR、SDD、TDD）保持英文
- 衬线点缀：英文用 Newsreader italic 关键词，中文用 `.serif-zh`，两者不混用

### 5. 页面级检查

- 页头仍单行渲染（新增导航项时最易破）
- 页脚 `base` prop 的 `#anchor` 链接在新页面上仍然有效
- 新页面加入后整站 `npm run build` 通过，双语路由都渲染

## 扩展情形检查清单

在 SKILL.md 共用清单之外额外确认：

- [ ] 新板块布局家族与本页既有板块不重复
- [ ] CTA 层级未被新内容破坏（仍是一个 flight 主操作）
- [ ] 新页面双路由、hreflang、页脚锚点全部验证
- [ ] 跑一遍 `scripts/audit_brand.py <项目src>` 无违规
