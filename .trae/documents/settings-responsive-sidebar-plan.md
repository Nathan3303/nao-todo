# Settings 页面响应式侧边栏实现计划

## 仓库研究结论

通过分析 Tasks 页面和 Settings 页面的代码，发现：

1. **Tasks 页面侧边栏实现方式**：
    - 使用 `useResponsiveAside` 钩子管理侧边栏状态
    - 使用 `AppAsideAdapter` 组件实现响应式侧边栏（移动端浮动，桌面端固定）
    - 提供侧边栏宽度调整功能（`handleResizeAside`）

2. **Settings 页面当前状态**：
    - `settings-view.ts` 已经提供了完整的侧边栏上下文（`asideWidth`、`isDisplayAside`、`handleResizeAside` 等）
    - `aside.vue` 直接使用 `nue-aside`，未使用 `AppAsideAdapter`
    - 没有实现响应式侧边栏功能

## 需要修改的文件

1. `apps/web/src/layouts/settings/aside/aside.vue` - 修改侧边栏组件，使用 AppAsideAdapter
2. `apps/web/src/layouts/settings/aside/index.ts` - 更新导出方式

## 实现步骤

1. 修改 `apps/web/src/layouts/settings/aside/aside.vue`：
    - 注入 SettingsViewContext 以获取侧边栏状态
    - 使用 AppAsideAdapter 替换当前的 nue-aside
    - 添加侧边栏内容的条件渲染（根据 isDisplayAside）

2. 更新 `apps/web/src/layouts/settings/aside/index.ts`，统一导出方式

## 注意事项

- 保持与 Tasks 页面一致的侧边栏风格和交互
- 确保响应式功能正常工作
- 不破坏现有的 Settings 页面功能