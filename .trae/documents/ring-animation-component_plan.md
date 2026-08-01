# 环形动画组件抽离计划

## 需求分析

将 `/home/nathan/Projects/nao-todo/apps/web/src/components/pomodoro/focus/focus.vue` 中的环形动画模板抽离成一个可复用的 UI 组件。

### 当前状态

**focus.vue 中的环形动画结构**：

- 背景圆环（SVG circle，灰色）
- 进度圆环（SVG circle，带渐变，支持旋转动画）
- 容器 div 包裹进度圆环，通过 `running` 类控制动画显示

### 现有组件模式

项目中组件遵循以下模式：

- 组件位于 `apps/web/src/components/pomodoro/` 目录
- 组件命名为 `pomodoro-[功能名].vue`
- 使用 `<script setup lang="ts">` 语法
- CSS 样式使用 scoped

---

## 实现方案

### 1. 创建新的可复用组件

**组件名称**：`PomodoroFocusRing`

**位置**：`apps/web/src/components/pomodoro/pomodoro-focus-ring.vue`

**文件结构**：

```
pomodoro-focus-ring.vue    # 组件主文件（包含类型定义）
```

### 2. 组件 Props 设计

```typescript
interface PomodoroFocusRingProps {
    /** 是否运行中（显示旋转动画） */
    isRunning: boolean
    /** 外环颜色（默认灰色） */
    outerColor?: string
    /** 圆环尺寸（默认 300px） */
    size?: number
    /** 圆环宽度（默认 3px） */
    strokeWidth?: number
    /** 动画周期（默认 12s） */
    duration?: number
}
```

### 3. 组件实现

#### pomodoro-focus-ring.vue 核心功能：

- 渲染两个 SVG circle（背景和进度）
- 使用 `linearGradient` 实现渐变效果（深色 → 浅色）
- 根据 `isRunning` 状态控制动画显示
- 支持自定义颜色、尺寸、动画周期
- 内嵌类型定义

### 4. 组件导出

在 `components/pomodoro/index.ts` 中添加导出：

```typescript
export { default as PomodoroFocusRing } from './pomodoro-focus-ring.vue'
```

### 5. 修改 focus.vue

将原有的环形动画模板替换为新组件：

**Before**：

```vue
<nue-div theme="circle">
    <svg class="progress-ring-bg" viewBox="0 0 100 100">
        <circle class="progress-outter-bar" ... />
    </svg>
    <div class="progress-ring-progress-container" :class="{ running: isRunning }">
        <svg class="progress-ring-progress" viewBox="0 0 100 100">
            <!-- 进度圆环（带渐变和动画） -->
        </svg>
    </div>
</nue-div>
```

**After**：

```vue
<PomodoroFocusRing :is-running="isRunning" />
```

---

## 修改文件清单

| 文件路径                                                   | 操作 | 说明               |
| ---------------------------------------------------------- | ---- | ------------------ |
| `apps/web/src/components/pomodoro/pomodoro-focus-ring.vue` | 创建 | 可复用环形动画组件 |
| `apps/web/src/components/pomodoro/index.ts`                | 修改 | 导出新组件         |
| `apps/web/src/components/pomodoro/focus/focus.vue`         | 修改 | 使用新组件替换模板 |

---

## 步骤分解

### 步骤 1：创建组件文件

- 创建 `components/pomodoro/pomodoro-focus-ring.vue`
- 实现 SVG 环形动画结构
- 添加渐变效果和旋转动画
- 支持自定义属性
- 内嵌 TypeScript 类型定义

### 步骤 2：更新主模块导出

- 修改 `components/pomodoro/index.ts`
- 添加新组件导出

### 步骤 3：重构 focus.vue

- 导入新组件
- 替换环形动画模板
- 保留时间显示和操作按钮
- 移除不再需要的样式

---

## 组件 API 设计

### Props

| 属性        | 类型      | 默认值                           | 说明           |
| ----------- | --------- | -------------------------------- | -------------- |
| isRunning   | `boolean` | **必填**                         | 是否运行中     |
| outerColor  | `string`  | `'var(--nue-primary-color-200)'` | 外环颜色       |
| size        | `number`  | `300`                            | 圆环尺寸（px） |
| strokeWidth | `number`  | `3`                              | 圆环宽度（px） |
| duration    | `number`  | `12`                             | 动画周期（秒） |

### 使用示例

```vue
<!-- 基本用法 -->
<PomodoroFocusRing :is-running="isRunning" />

<!-- 自定义配置 -->
<PomodoroFocusRing :is-running="isRunning" :size="300" :stroke-width="3" :duration="12" />
```

---

## 验证步骤

1. **构建测试**：`pnpm build` 应成功
2. **功能测试**：
    - idle 状态：只显示灰色背景圆环
    - running 状态：显示渐变进度环并持续旋转
    - paused 状态：隐藏进度环动画
3. **样式一致性**：确保与原 design 保持一致