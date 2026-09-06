# 2026-09-06 搜索节点样式优化（SEA-02）验收归档

- **交付**：任务节点令牌化/层级对齐/键盘可达/吸顶工具栏 + 描述恒显与展示件复用 + meta 对齐列表口径
- **commit**：`0ba23a65`（P0+P1 样式）、`829b3a28`（描述恒显+TaskTagBar 复用）、`97a06fc9`（meta 对齐 TaskDateInfo/TaskBasicInfo）
- **终签**：✅ 通过（用户冒烟 + 用户自行样式微调后复验）

## 1. 主题与背景

搜索节点为自实现样式，与任务界面（表格行/列表行）令牌语言不一致 → 视觉漂移与可扫读性问题 → **按 nue-ui-theme-shadlike 令牌体系对齐任务节点层级**（明暗自适应），并**复用 shared 任务展示组件**避免双份实现。

## 2. 风格基线（实证）

NueUI + nue-ui-theme-shadlike：HSL 推导 ramp，primary ramp=中性灰阶（0/100/200/500/700/800/900），error/warning/success 语义 ramp；暗色 `--nue-dark-switch` 自动翻转。任务行基线（table.css/list 行）：名称 df2/primary-900、描述 sm/primary-500、meta sm/primary-800、done=整行 opacity .8；`relativeDateParser` 相对日期（今天 14:00/昨天/本周…）。

## 3. 决策留痕

| 决策                 | 结论                                                                                                                               | 依据              |
| :------------------- | :--------------------------------------------------------------------------------------------------------------------------------- | :---------------- |
| 颜色纪律（用户硬性） | 仅 shadlike 令牌；禁新增 hex/rgb（移除 #2563eb 兜底）；唯一豁免=标签用户数据色点                                                   | 明暗切换适配      |
| 范围分级             | P0（令牌/层级/done/键盘焦点/长名 clamp）+ P1（吸顶滚动/hover/active/chips）                                                        | 用户批推荐        |
| 描述恒显             | 有描述即显示（未命中整段纯文本、命中高亮窗口、空不占行），clamp≤3+title 对齐列表行                                                 | 用户要求          |
| 展示件复用           | TaskTagBar ✅ 复用（全 props 驱动零耦合）；TaskBasicInfo/TaskDateInfo 经用户追问后裁定=**对齐列表口径复用**（相对日期+时刻级过期） | 用户追问 → 方向 a |
| 不复用（含理由）     | TaskPriorityInfo（icon+文字 vs 圆点+title 已验收表示）；TaskStateInfo（无 state 展示）；TaskList 整体（inject 上下文耦合）         | 选型对比表        |
| UI 接管              | 用户后续自行优化界面样式（commit `cca0c161` 前序），此后 PM/RD 禁动 UI                                                             | 用户指令          |

## 4. 验收

SR-1~11 + SEA-D2/SEA-D3 系列 AC 全过：字号/层级令牌化；done 整行 .8+删划线；行 role/tabindex/Enter/Esc/焦点环；优先级 title；长名 clamp2+title；吸顶工具栏；无字面量色（rg 0 命中）；任务列表/表格/日历零回归；明暗双主题走查通过（用户复验+自行样式微调）。

## 5. 遗留项

- **P2**：日期与过期色跨页统一（表格 error-30 vs 节点 error-60 口径）；搜索历史；骨架动画。