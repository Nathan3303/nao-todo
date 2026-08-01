# 优化 TagManager 对话框组件

## 目标

参照 ProjectManager 组件优化 TagManager 组件，保留原有功能，由于 Tag 删除是硬删除不可恢复，所以提醒等级提高为 Danger（红色）。

## 主要改动

### 1. 修改 TagUseCase (`packages/application/web/usecases/tag.ts`)

- 移除 `delete` 方法中的 `NueConfirm` 确认对话框，只保留实际删除逻辑
- 保持其他方法不变

### 2. 修改 TagBoard (`packages/components/tag-board/tag-board.vue`)

- 添加 ops slot scope，传递 tag 数据
- 更新 types.ts 添加 slot 相关类型

### 3. 重构 TagManager 组件 (`apps/web/src/components/tasks/dialogs/tag-manager/`)

- 修改 `tag-manager.vue`：
    - 将 dialog 主题改为 "fullscreen"
    - 添加统计卡片（标签总数等）
    - 添加 Danger 级别的删除功能重要提醒（使用 NueTooltip）
    - 使用 inject 获取 DIALOG_MANAGER_CONTEXT_KEY 中的 tagUseCase
    - 添加 loadingTags Map 管理删除加载状态
    - 实现 handleDeleteTag 方法，使用红色确认对话框
    - 通过 slot scope 传递 tag 和 loading 给删除按钮
- 更新 `type.ts` 和 `use-tag-manager.ts` 移除不需要的 emit 等

### 4. 修改 tasks dialogs 父组件 (`apps/web/src/layouts/tasks/dialogs/index.vue`)

- 移除传递给 tag-manager 的 tags、tagCreatorOpener、tagColorUpdaterOpener props（改为通过 context 获取）

## 关键细节

- 确认对话框使用红色 Danger 主题
- 确认按钮文字为红色
- 删除提示文字说明这是永久删除，不可恢复
- Tag 不支持恢复操作，不需要恢复相关功能