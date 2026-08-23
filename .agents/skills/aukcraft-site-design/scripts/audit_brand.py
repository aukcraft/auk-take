#!/usr/bin/env python3
"""aukcraft 品牌硬性规则静态审计。

扫描源码/样式文件，报告品牌设计系统 v2 的机器可查违规：

  shadow     box-shadow / drop-shadow / shadow-* 工具类（层次只能靠明度+发丝线）
  radius     超过 4px 的圆角（px 值 > 4，rem 值 > 0.25，及 rounded-lg/full 等）
  pure-bw    纯黑 #000 / 纯白 #fff（含 rgb(0,0,0) / rgb(255,255,255)）
  teal       Auk Teal 的出现位置——配给审计需人工确认语境，脚本全部列出

用法：
  python audit_brand.py <文件或目录...>

退出码：0 = 无 shadow/radius/pure-bw 违规；1 = 存在违规。
teal 出现位置仅为提示（INFO），不影响退出码。

已知豁免：
  - 注释行（// 与块注释内的命中仍会报告——人工甄别，宁多勿漏）
  - SVG 滤镜/画布绘制代码中的颜色常量不在本工具检查范围

显式豁免（绕过显性原则）：在某一行末尾加 `brand-audit:ignore` 注释
（必须带原因，如 `// brand-audit:ignore 离屏采样仅读 alpha，颜色无关`），
该行的所有违规检查跳过并以 SKIP 形式列出，供审计时复核。
"""

import re
import sys
from pathlib import Path

IGNORE = re.compile(r"brand-audit:ignore\s*\S*")

SCAN_EXTS = {".css", ".astro", ".tsx", ".jsx", ".ts", ".js", ".html", ".svelte", ".vue"}
SKIP_DIRS = {"node_modules", "dist", ".git", "build", ".next"}

RULES = [
    ("shadow", re.compile(r"box-shadow|drop-shadow|(?<![\w-])shadow-(?:sm|md|lg|xl|2xl|\[)"),
     "零阴影：层次只能靠明度差 + 1px 发丝线"),
    ("radius", re.compile(
        r"border-radius\s*:\s*(?:[5-9]|\d{2,})px"
        r"|border-radius\s*:\s*(?:0\.(?:[3-9]\d*|[1-9])|[1-9])rem"
        r"|rounded-(?:lg|xl|2xl|3xl|full)"),
     "圆角必须 ≤ 4px（rounded-lg/xl/full 等超限）"),
    ("pure-bw", re.compile(
        r"#[0][0][0](?:[0][0][0])?\b|#[fF]{3}(?:[fF]{3})?\b"
        r"|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\)|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\)"
        r"|(?<![\w-])(?:bg|text|border)-(?:black|white)\b"),
     "无纯黑/纯白：底色 #0B0E11，文字 #EDEDED"),
]

TEAL = re.compile(r"#14[Bb]8[Aa]6|(?<![\w-])(?:text|bg|border|stroke|fill)-teal\b")

# 「不艳即舒适」：霓虹区的颜色（HSV S > 0.90 且明度 ≥ 0.5）不得出现在界面上。
# 与 generate_theme.py 的入口门禁同一阈值；teal（S=0.89）等品牌色不受影响。
MAX_HSV_SATURATION = 0.90
MIN_VIVID_VALUE = 0.5
HEX = re.compile(r"#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b")


def vivid_hits(line: str):
    """返回行内过艳的 hex 颜色列表。"""
    hits = []
    for m in HEX.finditer(line):
        h = m.group(0)[1:]
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        rgb = (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
        mx, mn = max(rgb), min(rgb)
        if mx == 0:
            continue
        if (mx - mn) / mx > MAX_HSV_SATURATION and mx / 255 >= MIN_VIVID_VALUE:
            hits.append(m.group(0))
    return hits


def iter_files(paths: list[str]):
    for raw in paths:
        p = Path(raw)
        if p.is_file() and p.suffix in SCAN_EXTS:
            yield p
        elif p.is_dir():
            for f in sorted(p.rglob("*")):
                if f.suffix in SCAN_EXTS and not (set(f.parts) & SKIP_DIRS):
                    yield f


def main() -> int:
    if len(sys.argv) < 2:
        sys.exit("用法：python audit_brand.py <文件或目录...>")

    violations = 0
    for f in iter_files(sys.argv[1:]):
        try:
            lines = f.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError as exc:
            print(f"SKIP {f}: {exc}")
            continue
        for lineno, line in enumerate(lines, 1):
            if IGNORE.search(line):
                print(f"SKIP {f}:{lineno}: {line.strip()[:90]}")
                continue
            for name, pattern, advice in RULES:
                if pattern.search(line):
                    violations += 1
                    print(f"FAIL [{name}] {f}:{lineno}: {line.strip()[:100]}")
                    print(f"     → {advice}")
            for color in vivid_hits(line):
                violations += 1
                print(f"FAIL [vivid] {f}:{lineno}: {color} 饱和度过高 → {line.strip()[:90]}")
                print("     → 不艳即舒适：选更灰/更深的色阶（HSV S ≤ 0.90）")
            if TEAL.search(line):
                print(f"INFO [teal] {f}:{lineno}: {line.strip()[:100]}")
                print("     → 确认语境：仅链接/CTA/Flight Line/焦点/画布光标填充可用 teal")

    print()
    if violations:
        print(f"审计完成：{violations} 处违规。")
        return 1
    print("审计完成：无 shadow/radius/pure-bw 违规。（teal 提示见上方 INFO，需人工确认）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
