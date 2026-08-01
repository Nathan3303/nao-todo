# 项目管理器组件优化计划

## 目标

优化 `project-manager` 组件的布局和展示方式，使用 NueUI 组件库，保持原有功能完整，让用户打开对话框时有一种管理的全局感。

## 当前组件功能分析

- 展示项目列表
- 按名称筛选项目
- 筛选已删除项目
- 新增项目
- 删除/恢复/永久删除项目

## 优化方案

### 1. 新增统计卡片区域

在对话框顶部展示项目统计信息

- 项目总数
- 正常项目数
- 已删除项目数
- 使用 `nue-div` 和 `nue-text` 组件布局

### 2. 新增标签导航

使用标签页来切换不同状态的项目视图

- 全部
- 正常
- 已删除
- 使用 `nue-link` 或类似组件实现

### 3. 优化筛选区域布局

- 将筛选输入框和新增按钮重新组织
- 保持功能不变

### 4. 优化项目卡片展示

- 增强项目卡片视觉效果
- 增加更多项目信息（如任务数量）
- 保持现有操作功能

### 5. 增强对话框主题

- 调整对话框尺寸和样式
- 让整体布局更加专业和有管理感

## 文件修改计划

- `apps/web/src/components/tasks/dialogs/project-manager/index.vue` - 主要布局修改
- `apps/web/src/components/tasks/dialogs/project-manager/use-project-manager.ts` - 状态管理扩展（如需）
- `apps/web/src/components/tasks/dialogs/project-manager/types.ts` - 类型定义扩展（如需）