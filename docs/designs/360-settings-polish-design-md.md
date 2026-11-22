# DESIGN.md 增补草案 · 元素设计方式：以组件库主题为准（T749 / Issue #360）

> 状态：**草案**（uiux 起草）—— 待 PM 审定后由 `rd-fe` 并入 `DESIGN.md` `## 4 组件约定` 末尾，作为 **`### 4.9 元素设计方式：以组件库主题为准`**。
> ⛔ 本文件**不改动** `DESIGN.md` 任何既有条款（30px 例外已撤回、`LoadingError` 口径、§4.5 分段契约、§9 视口基线等一律不动）。
> 依据：PRD `docs/prds/2026-11-22-settings-polish.md` AC11「元素形态与现有组件库主题一致，且 `DESIGN.md` 有对应口径可查」。

## 拟增补正文（≤15 行）

- **原则**：新元素先「找现成的」，再考虑画。本项目视觉的唯一上游是组件库及其主题 —— `nue-ui@1.15.3` + `nue-ui-theme-shadlike@0.13.30`（`node_modules` 内可直接读 `dist/components/*.css` 与 `dist/global/variables.css`）。
- **取用顺序（必须按序，越靠前越优先）**：① **主题 token**（`--nue-*`；组件自有变量如 `--nue-button-*` / `--nue-link-*` / `--nue-input-*` 优先于全局色阶）→ ② **组件原生档位**（尺寸 / 主题变体：`nue-button` 默认 36、`small` 28、`large` 40；`nue-input` 36；`nue-link--route` 40 + 深底激活 + `-200` hover；`nue-switch small`）→ ③ **本仓主题覆盖**（`apps/web/src/themes/*.css`，如 `link.css` 的 route 变体、`div.css` 的 `form-item`、`container.css` 的 `--in-dialog`）→ ④ **本仓类**（`sd-*` 等业务类，只做组合与布局，不得重新定义颜色 / 字号 / 圆角 / 尺寸）→ ⑤ **确需新 token / 新档位 ⇒ 先报 PM**（⛔ 不得在组件 CSS 里就地造）。
- **正例·按钮**：`nue-button theme="primary|secondary|ghost,small"` —— 尺寸 / 圆角 / 边框 / hover 全由主题给；调用方 ⛔ 不写 `height` / `padding` / `font-size` / `border-radius`（#358 v4 撤回 30px 特例即按此口径）。
- **正例·输入与表单**：`nue-input`（36px、内距 `--nue-gap-sm`、边框 `--nue-divider-color`）+ `nue-div theme="form-item"`（label 14px / `-600` / gap 8）—— 表单字段间距由组件定义，页面 ⛔ 不另加壳。
- **正例·导航链接**：左栏 / 侧栏的选中项取 `nue-link--route` 的四态值（底透明 → hover `-200` → 激活 `-900` 底 + `-0` 字 + 600 → focus 环 `-600` + offset 2），⛔ 不用左侧竖线 / 自造指示条。
- **反例（现存待收敛项，不随本草案批量改）**：`.sd-quiet-hours__field input`（自绘 time 输入，40px + 自填边框）、`.sd-row__action`（自绘按钮，替代 `nue-button`）、`.sd-cat` 的 `2.75rem` / `.sd-row__text` 的 `2px` 等**非 token 字面值**。
- **一句话检验**：新块写完后扫一遍自己的 CSS —— 若出现 `height` / `padding` / `font-size` / `border-radius` / `background-color` 的**新字面值**（非 `--nue-*`、非组件既有档位），即视为漂移，须回上一步取件。

## 插入位置与影响面

- 插入点：`DESIGN.md` 第 4 节「组件约定」末尾（现末条为 §4.8 同步状态面板），新增 `### 4.9`；`§8 检查清单` 增一行 `- [ ] 元素形态取自组件库主题（§4.9 取用顺序），未自造尺寸 / 配色 / 圆角`。
- 与既有条款的关系：**不含**任何数值裁决 ⇒ 与 §2 色彩实测表、§3 30px 撤回记录、§4.5 分段契约、§4.1 `LoadingError` 硬规则**无冲突**；§4.9 只回答「取值从哪来」，不回答「值是多少」。
- 落地时序：PM 审定 → `rd-fe` 在 `feat/360-settings-polish` 内一并写入（文档随任务 PR，禁单开 PR）。