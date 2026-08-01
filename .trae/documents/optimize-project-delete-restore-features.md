# 优化项目删除和恢复功能实施计划

## 概述

移除永久删除功能，优化删除和恢复功能，添加 loading 状态，使用 provide/inject 解耦。

---

## 当前架构分析

### 现有组件层级

```
TasksViewDialogs (layouts/tasks/dialogs)
  └─ provides: DIALOG_MANAGER_CONTEXT_KEY (包含 projectUseCase)
      └─ ProjectManager (components/tasks/dialogs/project-manager)
          └─ ProjectBoard (packages/components/project-board)
              └─ ProjectCard
              └─ ProjectDeleteButton
```

### 现有方法

- **ProjectUseCase** (packages/application/web/usecases/project.ts)

    - `delete(projectId)` - 删除项目（包含确认弹窗）

    - `archive(projectId)` - 归档项目（包含确认弹窗）

- **ProjectDomain** (packages/domain/project/services.ts)

    - `remove(projectId)` - 执行删除

    - `restore(projectId)` - 执行恢复

    - `archive(projectId)` - 执行归档

    - `unarchive(projectId)` - 取消归档

---

## 详细实施步骤

### 第一步：完善 ProjectUseCase 并移除确认逻辑

**文件：** `packages/application/web/usecases/project.ts`

1. 添加 `restore` 方法
2. 移除 `delete` 和 `archive` 中的确认弹窗逻辑（因为现在在 ProjectManager 中，用户操作更直观，不需要二次确认）
3. 保持方法是异步的

```typescript
async delete(projectId: ProjectViewObject['id']): GoAsync<void> {
    // 直接调用，不做确认
    return await this.projectDomain.remove(projectId)
}

async restore(projectId: ProjectViewObject['id']): GoAsync<void> {
    // 新增恢复方法
    return await this.projectDomain.restore(projectId)
}

async archive(projectId: ProjectViewObject['id']): GoAsync<void> {
    // 直接调用，不做确认
    return await this.projectDomain.archive(projectId)
}

async unarchive(projectId: ProjectViewObject['id']): GoAsync<void> {
    // 新增取消归档方法
    return await this.projectDomain.unarchive(projectId)
}
```

---

### 第二步：优化 ProjectDeleteButton 组件

**文件：** `packages/components/project-delete-button/project-delete-button.vue`
**相关：** `packages/components/project-delete-button/types.ts`

1. 添加 `loading` prop
2. 将按钮主题调整为支持 loading 状态
3. 保持现有的 emit 接口不变

```typescript
// types.ts 新增
export type ProjectDeleteButtonProps = {
    isDeleted?: boolean
    loading?: boolean  // 新增 loading 状态
}

// Vue 组件
<nue-button
    :loading="loading"  // 添加 loading
    ...
>
```

---

### 第三步：重构 ProjectBoard 组件

**文件：** `packages/components/project-board/project-board.vue`
**相关：** `packages/components/project-board/types.ts`

1. 移除 `deleteProjectPermanently` 相关事件和 UI
2. 添加 loading 状态管理（每个项目独立的 loading）
3. 从 props 改为直接传入处理函数，或者保持 emit 方式

**方案选择：** 保持 emit 方式，由父组件处理 loading 状态（推荐，更解耦）

---

### 第四步：重构 ProjectManager 组件

**文件：** `apps/web/src/components/tasks/dialogs/project-manager/index.vue`
**相关：** `apps/web/src/components/tasks/dialogs/project-manager/types.ts`

1. 移除 `hardDeleteProject` 相关代码
2. 使用 `inject` 获取 `DIALOG_MANAGER_CONTEXT_KEY`
3. 添加每个项目的 loading 状态管理（使用 `Map<string, boolean>`）
4. 修改 `use-project-manager.ts` 处理 loading 状态

修改 `types.ts`：

- 移除 `hardDeleteProject` 事件

修改 `index.vue`：

```typescript
const dialogManagerContext = inject<DialogManagerContext>(DIALOG_MANAGER_CONTEXT_KEY)!
const loadingProjects = ref<Map<string, boolean>>(new Map())

const handleDeleteProject = async (projectId: string) => {
    loadingProjects.value.set(projectId, true)
    const err = await dialogManagerContext.projectUseCase.delete(projectId)
    if (err !== null) {
        // 可以显示错误提示
    }
    loadingProjects.value.delete(projectId)
}

const handleRestoreProject = async (projectId: string) => {
    loadingProjects.value.set(projectId, true)
    const err = await dialogManagerContext.projectUseCase.restore(projectId)
    if (err !== null) {
        // 可以显示错误提示
    }
    loadingProjects.value.delete(projectId)
}
```

修改模板中的 ProjectBoard：

```vue
<project-board
    :projects="filteredProjects"
    @delete-project="handleDeleteProject"
    @restore-project="handleRestoreProject"
>
    <!-- 在 slot 中传递 loading 状态 -->
    <template #default="{ project }">
        <project-delete-button
            :is-deleted="project.isDeleted"
            :loading="loadingProjects.get(project.id)"
            @delete="handleDeleteProject(project.id)"
            @restore="handleRestoreProject(project.id)"
        />
    </template>
</project-board>
```

**或：** 修改 ProjectBoard 支持传递 loading 状态到 slot scope

---

### 第五步：清理相关代码

**文件：**

- `apps/web/src/components/tasks/dialogs/project-manager/use-project-manager.ts`

- `apps/web/src/components/tasks/dialogs/project-manager/types.ts`

1. 移除 `hardDeleteProject` 相关的处理函数和类型定义
2. 保持 `use-project-manager.ts` 专注于筛选和 tab 管理

---

## 关键设计决策

### 1. Loading 状态管理位置

**选择：** 在 `ProjectManager` 中管理，而不是 `ProjectBoard` 中
**理由：**

- ProjectManager 已经有 inject 的 projectUseCase

- 更符合职责分离：ProjectBoard 负责展示，ProjectManager 负责业务逻辑

- 避免在 ProjectBoard 中引入业务逻辑依赖

### 2. 移除确认弹窗

**选择：** 完全移除，因为用户在 ProjectManager 对话框中已经是明确的管理操作
**理由：**

- 用户在 ProjectManager 中的操作意图明确

- 与现有的警告提示配合，已有足够的提醒

- 减少操作步骤，提升用户体验

### 3. 数据传递方式

**选择：** 保持 emit 事件机制，在 ProjectManager 中处理
**理由：** 保持组件解耦，ProjectBoard 和 ProjectCard 不需要知道具体的业务逻辑

---

## 文件修改清单

| 文件路径                                                                       | 修改内容                                                |
| ------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `packages/application/web/usecases/project.ts`                                 | 添加 restore/unarchive，移除确认弹窗                    |
| `packages/components/project-delete-button/types.ts`                           | 添加 loading prop 类型                                  |
| `packages/components/project-delete-button/project-delete-button.vue`          | 添加 loading 状态渲染                                   |
| `packages/components/project-board/types.ts`                                   | 移除 deleteProjectPermanently 事件                      |
| `packages/components/project-board/project-board.vue`                          | 移除永久删除按钮，优化 slot 支持 loading 传递           |
| `apps/web/src/components/tasks/dialogs/project-manager/types.ts`               | 移除 hardDeleteProject 事件                             |
| `apps/web/src/components/tasks/dialogs/project-manager/use-project-manager.ts` | 移除 hardDeleteProject 处理                             |
| `apps/web/src/components/tasks/dialogs/project-manager/index.vue`              | 实现完整的删除/恢复逻辑，添加 loading 管理，使用 inject |

---

## 注意事项

1. **向后兼容：** 确保其他使用 ProjectUseCase 的地方不受影响（删除确认弹窗的移除）
2. **错误处理：** 添加适当的错误提示（可以使用 NueMessage）
3. **类型安全：** 确保所有类型定义正确更新
4. **用户体验：** 确保 loading 状态清晰，按钮在执行期间不可重复点击

---

## 实施顺序建议

1. 完善 ProjectUseCase（最小改动）
2. 优化 ProjectDeleteButton（添加 loading）
3. 清理 ProjectBoard（移除永久删除）
4. 重构 ProjectManager（核心改动）
5. 清理类型定义
6. 测试验证