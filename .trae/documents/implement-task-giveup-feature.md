# 待办任务放弃功能实现计划

## 需求概述
实现待办任务的放弃功能，支持在 "已放弃的任务" 界面中查看被放弃的任务。

---

## 实现步骤

### 1. 在任务详情页 Footer 组件中添加放弃选项
**文件**: [apps/web/src/layouts/tasks/task-details/footer/index.vue](file:///home/nathan/Development/nao-todo/apps/web/src/layouts/tasks/task-details/footer/index.vue)

**具体操作**:
- 在 "删除或恢复" 下拉分组中新增 `InnerDropdownOption` 组件
- 根据任务状态动态显示：
  - 未放弃时显示 "放弃待办任务"，图标使用 "clear"
  - 已放弃时显示 "恢复待办任务（取消放弃）"，图标使用 "restore"
- 设置对应的 `execute-id`：`giveup-todo`（放弃）和 `restore-giveup-todo`（恢复放弃）
- 参考现有 "删除或恢复" 选项的实现方式

### 2. 实现放弃和恢复的处理逻辑
**文件**: [apps/web/src/layouts/tasks/task-details/footer/index.vue](file:///home/nathan/Development/nao-todo/apps/web/src/layouts/tasks/task-details/footer/index.vue)

**具体操作**:
- 在 `handleDropdownExecute` 方法中添加对 `giveup-todo` 和 `restore-giveup-todo` 的处理分支
- 放弃操作前调用 `NueConfirm` 进行确认，确认文案：
  - title: "确认放弃该任务吗？"
  - content: "放弃后该任务将移至「已放弃的待办」清单中。是否继续？"
  - confirmButtonText: "确认放弃"
  - cancelButtonText: "取消"
- 恢复操作不需要确认（或根据需要添加确认）

### 3. 调用 Update UseCase 更新数据
**文件**: [apps/web/src/layouts/tasks/task-details/footer/index.vue](file:///home/nathan/Development/nao-todo/apps/web/src/layouts/tasks/task-details/footer/index.vue)

**具体操作**:
- 放弃时调用 `taskUseCase.updateTask`，设置 `givenUpAt` 为当前时间字符串（ISO 格式）
- 恢复放弃时调用 `taskUseCase.updateTask`，设置 `givenUpAt` 为 `null`
- 处理错误情况，使用 `NueMessage` 显示成功/失败提示

### 4. 检查数据转换器中的 isGivenUp 属性设置
**需要搜索**: usecase 中 TaskViewObject 的转换器

**具体操作**:
- 查找将领域模型转换为 TaskViewObject 的转换器代码
- 确保 `isGivenUp` 属性正确根据 `givenUpAt` 是否有效进行判断
- 使用 dayjs 进行判断：`isGivenUp: dayjs(givenUpAt).isValid()`
- 项目已安装 dayjs，可直接引入使用

### 5. 验证 "已放弃的任务" 界面请求参数
**文件**: [packages/infrastructure/built-in/project/default.ts](file:///home/nathan/Development/nao-todo/packages/infrastructure/built-in/project/default.ts)

**具体操作**:
- 检查 `givenup` 内置项目的 `getTasksOptions` 配置
- 确认当前配置 `{"isGivenUp": true, "limit": 80}` 正确
- 如需调整参数则进行修改（当前配置看起来已正确）

---

## 技术要点

### 数据结构
- **属性名**: `givenUpAt`（时间字符串，ISO格式），整个调用链保持一致
- **辅助属性**: `isGivenUp`（布尔值，用于视图快速判断）

### 调用流程
1. 用户点击下拉选项 → 触发 `handleDropdownExecute`
2. 放弃操作：弹出确认框 → 确认后调用 `updateTask({ givenUpAt: new Date().toISOString() })`
3. 恢复操作：直接调用 `updateTask({ givenUpAt: null })`
4. Store 更新内存数据 → UI 自动响应更新

### 参考实现
- 删除/恢复任务逻辑：footer 组件中已有的 `delete-todo` / `restore-todo` 处理
- NueConfirm 使用：tag-manager.vue 或 project-manager.vue 中的示例
- InnerDropdownOption 使用：footer 组件中现有的选项实现

---

## 验收标准
1. 任务详情页下拉菜单中显示正确的放弃/恢复选项
2. 点击放弃时弹出确认框，确认后任务标记为放弃
3. 放弃的任务在 "已放弃的待办" 清单中显示
4. 已放弃的任务可以通过同样的菜单恢复
5. 恢复后任务从 "已放弃的待办" 清单中移除
