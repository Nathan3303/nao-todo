# 番茄钟设置 LocalStorage 持久化实现计划

## 1. 需求分析

用户希望番茄钟设置对话框中的所有选项值都保存在 LocalStorage 中，在用户重新进入番茄专注页面时还原 LocalStorage 中所保存的数据。

## 2. 代码库现状

- 番茄钟设置由 `pomodoro-store.ts` 管理
- 设置对话框在 `timer-setting` 组件中实现
- 项目已有使用 LocalStorage 的范例（如 `theme-store.ts`）

## 3. 实现方案

### 3.1 方案概述

在 `pomodoro-store.ts` 中添加 LocalStorage 持久化功能，包括：

1. 定义 LocalStorage 键名常量
2. 添加从 LocalStorage 加载数据的函数
3. 添加保存数据到 LocalStorage 的函数
4. 在 store 初始化时加载已保存的数据
5. 在设置更新时自动保存到 LocalStorage

### 3.2 涉及文件

- `/home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-store.ts` - 主要修改文件

## 4. 具体步骤

1. 在 `pomodoro-store.ts` 中添加 LocalStorage 键名常量
2. 创建 `loadSavedSettings()` 函数，从 LocalStorage 读取并验证数据
3. 创建 `saveSettings()` 函数，将当前设置保存到 LocalStorage
4. 修改所有设置相关的 action，在设置更新后调用 `saveSettings()`
5. 在 store 初始化时调用 `loadSavedSettings()`

## 5. 需要保存的设置项

- `focusDuration` - 专注时长（秒）
- `breakDuration` - 短休息时长（秒）
- `longBreakDuration` - 长休息时长（秒）
- `sessionsUntilLongBreak` - 长休息触发轮数
- `autoStartNextFocusSession` - 是否自动开始下一轮专注
- `autoStartNextFocusSessionCount` - 自动开始专注次数
- `autoRest` - 是否自动休息

## 6. 潜在依赖与注意事项

- 遵循项目现有的 LocalStorage 使用模式（参考 `theme-store.ts`）
- 需要对从 LocalStorage 读取的数据进行类型和范围验证，避免无效数据
- 所有时长需要以秒为单位存储
- 保持向后兼容，首次使用时使用默认值

## 7. 风险处理

- LocalStorage 数据损坏或格式错误时，使用默认值
- 确保在非浏览器环境（如 SSR）下的安全性