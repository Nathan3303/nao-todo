# focus / focus-ring / timer 组件关联分析与复用优化

## 摘要

分析 `apps/web/src/components/pomodoro` 下 `focus`、`focus-ring`、`timer` 三个组件的关联关系，并按用户确认的方向优化：

1. **扩展** **`focus-ring`** **支持进度弧模式**，让 `timer` 用 `focus-ring` 替换 `nue-progress`，保留原有倒计时进度可视化。
2. **抽离** **`focus`** **/** **`timer`** **重复的时间格式化逻辑**到 `utils/pomodoro.ts`。

遵循现有代码风格（组件目录 `xxx.vue` + `index.ts` + `types.ts`，`nue-*` 组件，`@computed` 注释风格，`v-bind` CSS）。

## 当前状态分析

### 三者关联关系

- [focus-ring.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/components/pomodoro/focus-ring/focus-ring.vue)：纯装饰性 SVG 圆环。`isRunning=true` 时渲染带渐变的旋转圆环（`spin-ring` 动画），否则渲染静态灰环。**没有进度百分比能力**。当前被 [focus.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/components/pomodoro/focus/focus.vue#L69)（`:scale="3" :stroke-width="1"`）和 [indicator.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/components/pomodoro/indicator/indicator.vue#L47)（`:scale="0.28" :stroke-width="42"`）使用。

- [timer.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/components/pomodoro/timer/timer.vue#L90-L97)：使用 `nue-progress type="circle"`（`:scale="3" :stroke-width="1"`）根据 `已用/总时长` 显示倒计时进度弧。

- `focus` 与 `timer` **共用** [pomodoro-timer.css](file:///home/nathan/Projects/nao-todo/apps/web/src/infrastructure/themes/pomodoro-timer.css)（`theme="pomodoro-timer"` 布局），三者都通过 [layouts/pomodoro/index.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/index.vue) 按 `activeTab` 二选一渲染。

### 几何一致性（复用可行性关键）

`focus-ring` 与 `nue-progress` 的 circle 几何完全一致，因此可无缝替换：

| 维度     | focus-ring               | nue-progress circle      |
| -------- | ------------------------ | ------------------------ |
| viewBox  | `0 0 100 100`            | `0 0 100 100`            |
| 圆       | `cx/cy=50% r=50%`        | `cx=50 cy=50 r=50`       |
| 缩放     | `scale(.9)`              | `scale(.9)`              |
| 描边宽度 | `strokeWidth * scale` px | `strokeWidth * scale` px |
| 尺寸     | `scale*100` px           | `scale*100` px           |

`nue-progress` 进度弧算法（可移植到 focus-ring）：

- `dasharray = Math.ceil(2π·50) = 315`

- `dashoffset = Math.ceil((1 - percentage/100) · 315)`

- `transform: scale(.9) rotate(-90deg)`（从 12 点顺时针）

- 进度弧 `stroke-linecap: round`，轨道为完整圆环

### 重复逻辑（可抽离）

`focus.vue` 与 `timer.vue` 存在重复：

- **`fmt(d: Date)`** **→** **`HH:MM:SS`**：两个文件逐字重复（[focus.vue#L33-L38](file:///home/nathan/Projects/nao-todo/apps/web/src/components/pomodoro/focus/focus.vue#L33-L38)、[timer.vue#L34-L39](file:///home/nathan/Projects/nao-todo/apps/web/src/components/pomodoro/timer/timer.vue#L34-L39)）。

- **秒 → 时钟串**：focus 的 `displayTime`（`HH:MM:SS`/`MM:SS`，[focus.vue#L11-L26](file:///home/nathan/Projects/nao-todo/apps/web/src/components/pomodoro/focus/focus.vue#L11-L26)）。

- `utils/pomodoro.ts` 已有 `formatMinutes`（[pomodoro.ts#L13-L19](file:///home/nathan/Projects/nao-todo/apps/web/src/infrastructure/utils/pomodoro.ts#L13-L19)），风格可延续。

### 附带发现（不在本次改动范围）

- `focus-ring` 的 `innerColor` prop 此前**从未使用**；本方案将其**用作进度弧颜色**，使其获得实际用途（无需删除）。

- `timer` 的进度显示语义为 `MM:SS`（分钟可 >59，如 `180:00`），与 focus 的 `HH:MM:SS` 语义不同，**保持原样不合并**，避免行为变化。

## 提议的变更

### 1. 扩展 focus-ring 支持进度弧

**文件**：[focus-ring/types.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/components/pomodoro/focus-ring/types.ts)

新增可选 prop：

```ts
export interface PomodoroFocusRingProps {
    /** 是否运行中（显示旋转动画）；进度模式下忽略 */
    isRunning: boolean
    /** 进度百分比（0-100）。传入即启用「进度弧模式」，不传为「旋转/静态模式」 */
    percentage?: number
    /** 外环/轨道颜色（默认灰色） */
    outerColor?: string
    /** 圆环宽度（默认 6px） */
    strokeWidth?: number
    /** 进度弧颜色（进度模式下使用，默认主色） */
    innerColor?: string
    /** 缩放比例（默认 1） */
    scale?: number
}
```

**文件**：[focus-ring/focus-ring.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/components/pomodoro/focus-ring/focus-ring.vue)

- 新增 computed：`isProgress = computed(() => props.percentage !== undefined)`。

- 新增进度几何 computed（仅进度模式用）：

    ```ts
    const CIRCUMFERENCE = Math.ceil(2 * Math.PI * 50) // 315
    const dashOffset = computed(() =>
        Math.ceil((1 - Math.min(100, Math.max(0, props.percentage ?? 0)) / 100) * CIRCUMFERENCE)
    )
    ```

- 模板：`isProgress` 时渲染「轨道圆 + 进度弧圆」（沿用 nue-progress 结构），否则保留现有 `isRunning` 旋转/静态分支：

    ```html
    <svg class="focus-ring" viewBox="0 0 100 100">
        <template v-if="isProgress">
            <circle class="circle-path track-path" :stroke="outerColor" />
            <circle class="circle-path progress-path" :stroke="innerColor" />
        </template>
        <template v-else>
            <defs>...现有渐变...</defs>
            <circle
                v-if="isRunning"
                class="circle-path running-path"
                stroke="url(#focusRingGradient)"
            />
            <circle v-else class="circle-path" :stroke="outerColor" />
        </template>
    </svg>
    ```

- 样式：新增 `.progress-path`（`stroke-dasharray`、`stroke-dashoffset` 用 `v-bind`，`stroke-linecap: round`，`transform: scale(.9) rotate(-90deg)`，`transition: stroke-dashoffset .24s linear`）与 `.track-path`。现有 `.circle-path` 的 `scale: .9` 与旋转动画保持不变；为进度模式的两个 path 应用 `rotate(-90deg)`。

> 说明：`innerColor` 默认值仍为 `var(--nue-primary-color-900)`，与 timer 现有默认进度色一致。

### 2. timer 复用 focus-ring 替换 nue-progress

**文件**：[timer/timer.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/components/pomodoro/timer/timer.vue)

- 引入：`import { PomodoroFocusRing } from '@/components/pomodoro'`（与 focus.vue 同款引入方式）。

- 将 [L90-L97](file:///home/nathan/Projects/nao-todo/apps/web/src/components/pomodoro/timer/timer.vue#L90-L97) 的 `<nue-progress>` 替换为：

    ```html
    <pomodoro-focus-ring
        :percentage="progress"
        :inner-color="progressColor"
        :is-running="isRunning"
        :scale="3"
        :stroke-width="1"
    />
    ```

- `progress` / `progressColor` computed 保持不变。

### 3. 抽离时间格式化工具

**文件**：[utils/pomodoro.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/infrastructure/utils/pomodoro.ts)

新增两个导出（延续 `formatMinutes` 风格）：

```ts
/** 格式化 Date 为当日时间 HH:MM:SS */
export const formatTimeOfDay = (d: Date): string =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`

/** 格式化秒数为时钟串：>=1h 显示 HH:MM:SS，否则 MM:SS */
export const formatClock = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    const mm = String(m).padStart(2, '0')
    const ss = String(s).padStart(2, '0')
    return h > 0 ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`
}
```

**文件**：[focus/focus.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/components/pomodoro/focus/focus.vue)

- `displayTime` 改用 `formatClock(props.elapsedSeconds)`。

- `phaseLabel` 内 `fmt` 改用 `formatTimeOfDay`。

**文件**：[timer/timer.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/components/pomodoro/timer/timer.vue)

- `phaseLabel` 内 `fmt` 改用 `formatTimeOfDay`（`startTime - endTime`）。

- `displayTime` 保持原 `MM:SS` 逻辑不变（语义不同，见附带发现）。

## 假设与决策

- **通过** **`percentage`** **是否传入区分模式**：不新增独立 `mode` prop，`percentage !== undefined` 即进度弧模式，最小化 API 变更、符合"简单优先"。

- **`innerColor`** **复用为进度弧色**：避免新增 `color` prop，同时让原死 prop 获得实际用途（用户未选择删除死 prop）。

- **不改** **`indicator.vue`**：本次聚焦 focus/focus-ring/timer 三组件；indicator 的 timer 分支仍用 `nue-progress`（其 focus 分支已复用 focus-ring），保持范围克制。若后续需要可再统一。

- **timer** **`displayTime`** **不并入** **`formatClock`**：timer 为 `MM:SS`（分钟可 >59），与 focus 的 `HH:MM:SS` 语义不同，合并会改变显示行为，故保留。

- **视觉不退化**：进度弧模式复刻 nue-progress 的 dasharray/offset/旋转/圆头，timer 外观与当前一致。

## 验证步骤

1. `pnpm --filter @nao-todo/webapp dev` 启动 web 应用。
2. 番茄专注（timer）：开始倒计时 → 确认圆环进度弧随剩余时间从满到空、从 12 点顺时针、休息阶段为浅色（`progressColor`），与改动前视觉一致；`± 分钟` hover 显隐、暂停/结束/跳过按钮正常。
3. 正计时（focus）：开始 → 确认旋转动画环正常；`HH:MM:SS` / `MM:SS` 与"开始于 HH:MM:SS"显示正确。
4. 侧边栏 indicator：timer 与 focus 两种运行态指示器显示正常（未改动，回归确认）。
5. `npx vue-tsc --noEmit -p apps/web/tsconfig.json` 类型检查通过；IDE 无 diagnostics。