# 实现代办任务删除、恢复以及永久删除功能

## 1. 项目调研结论

### 1.1 现有架构
项目采用分层架构设计：
- **Domain 层**：`packages/domain/task/` - 包含任务实体、领域服务、仓库接口
- **Application 层**：`packages/application/web/usecases/task.ts` - 任务用例
- **Infrastructure 层**：`packages/infrastructure/backend/task/repoImpl.ts` - 仓库实现
- **Web 层**：`apps/web/src/` - 前端界面实现

### 1.2 现有功能状态
- ✅ **删除任务**：已有 `removeTask` 用例、`remove` 仓库方法
- ✅ **恢复任务**：已有 `restoreTask` 用例、`restore` 仓库方法
- ❌ **永久删除任务**：完全缺失
- ⚠️ **UI 集成**：表格、列表、详情面板已有相关 UI 元素，但功能未完全实现（部分处于 disabled 状态）
- ❌ **Handler**：task-handler 中缺少删除、恢复、永久删除的处理方法

### 1.3 关键文件位置
- 领域服务：`packages/domain/task/services.ts`
- 仓库接口：`packages/domain/task/repositories.ts`
- 仓库实现：`packages/infrastructure/backend/task/repoImpl.ts`
- 任务用例：`packages/application/web/usecases/task.ts`
- 任务 Handler：`apps/web/src/handlers/tasks/task-handler.ts`
- 表格视图：`apps/web/src/components/tasks/table/`
- 列表视图：`apps/web/src/components/tasks/list/`
- 任务详情：`apps/web/src/layouts/tasks/task-details/`

---

## 2. 实现计划

### 2.1 Domain 层修改
**文件**：`packages/domain/task/repositories.ts`
- 在 `TaskRepository` 接口中添加 `deletePermanently` 方法

**文件**：`packages/domain/task/services.ts`
- 在 `TaskDomain` 类中添加 `deletePermanently` 方法

### 2.2 Infrastructure 层修改
**文件**：`packages/infrastructure/backend/task/repoImpl.ts`
- 实现 `deletePermanently` 方法，调用后端永久删除接口

### 2.3 Application 层修改
**文件**：`packages/application/web/usecases/task.ts`
- 在 `TaskUseCase` 类中添加 `deleteTaskPermanently` 用例方法

### 2.4 Web 层 - Handler 修改
**文件**：`apps/web/src/handlers/tasks/task-handler.ts`
- 添加 `deleteTask` 方法（调用用例的 `removeTask`）
- 添加 `restoreTask` 方法（调用用例的 `restoreTask`）
- 添加 `deleteTaskPermanently` 方法（调用用例的 `deleteTaskPermanently`，使用 NueConfirm 确认）

### 2.5 Web 层 - 视图适配器
需要查看并修改视图适配器，确保事件正确传递到 handler。

### 2.6 Web 层 - 任务详情面板
**文件**：`apps/web/src/layouts/tasks/task-details/footer/index.vue`
- 启用删除、恢复、永久删除按钮（移除 disabled）
- 添加 `delete-todo-permanently` 的事件处理
- 集成到 taskHandler

**文件**：`apps/web/src/layouts/tasks/task-details/task-details.ts`
- 确保 context 中提供了完整的 taskHandler

**文件**：`apps/web/src/layouts/tasks/task-details/details.vue`
- 监听并处理 deleteTask、restoreTask、deleteTaskPermanently 事件

### 2.7 Web 层 - 表格视图
**文件**：`apps/web/src/components/tasks/table/table-main.vue`
- 当任务已删除时，显示永久删除选项
- 集成 NueConfirm 用于永久删除确认

**文件**：`apps/web/src/components/tasks/table/use-table.ts`
- 添加 `deleteTaskPermanently` 方法到 context
- 确保 events 正确 emit

### 2.8 Web 层 - 列表视图
**文件**：`apps/web/src/components/tasks/list/list-main.vue`
- 当任务已删除时，显示永久删除选项
- 集成 NueConfirm 用于永久删除确认

**文件**：`apps/web/src/components/tasks/list/use-list.ts`
- 添加 `deleteTaskPermanently` 方法到 context
- 确保 events 正确 emit

### 2.9 NueConfirm 组件使用
参考 `apps/web/src/components/settings/profile/avatar.vue` 中的使用方式：
```typescript
await NueConfirm({
    title: '确认永久删除吗？',
    content: '此操作不可恢复，任务将被永久删除。',
    confirmButtonText: '永久删除',
    cancelButtonText: '取消',
    onConfirm: async () => {
        // 执行删除
    }
})
```

---

## 3. 潜在依赖和注意事项

### 3.1 依赖项
- `nue-ui` 库中的 `NueConfirm` 和 `NueMessage` 组件
- 后端 API 需要支持永久删除接口（假设路径为 `/tasks/permanent/{taskId}` DELETE）

### 3.2 注意事项
- 永久删除操作是不可逆的，必须经过用户确认
- 删除/恢复操作需要更新 store 中的任务状态
- 永久删除后需要从 store 中移除该任务
- 在多个视图（表格、列表、详情）中保持功能一致
- 错误处理需要友好提示用户

### 3.3 风险处理
- **后端接口不存在**：先实现前端逻辑，接口路径后续可调整
- **NueConfirm 使用问题**：参考项目中已有的使用示例（avatar.vue）
- **Store 更新问题**：参考现有 `removeTask` 和 `restoreTask` 的实现方式

---

## 4. 实施步骤顺序

1. Domain 层：添加永久删除接口和方法
2. Infrastructure 层：实现永久删除仓库方法
3. Application 层：添加永久删除用例
4. Handler 层：添加所有删除相关处理方法
5. 任务详情面板：启用并集成功能
6. 表格视图：完善功能
7. 列表视图：完善功能
8. 测试验证
