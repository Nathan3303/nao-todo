# 完善 builtInProject 模块的查询功能

## 研究结论

通过探索代码库，我已经了解了以下关键信息：

1. **后端 API**（`/home/nathan-lee/devs/nao-todo/docs/backend-api.md`）：GET /tasks 接口支持丰富的查询参数，包括：
   - projectId, tagId, name, description
   - state, priority
   - startAt, endAt
   - isDeleted, isArchived, isStarMarked, isGivenUp
   - relativeDate（today, tomorrow, week, -today）
   - sort, page, limit

2. **类型定义**：
   - `GetTasksOptions` 位于 `/home/nathan-lee/devs/nao-todo/packages/types/viewobjects/task.ts:40-55`
   - 使用 `isStarMarked` 而不是 `isFavorited`

3. **当前实现**：
   - 内置清单定义位于 `/home/nathan-lee/devs/nao-todo/packages/infrastructure/built-in/project/default.ts`
   - 内置清单偏好配置位于同一个文件
   - 当前部分内置清单的 `getTasksOptions` 配置需要完善

## 需要修改的文件

1. `/home/nathan-lee/devs/nao-todo/packages/infrastructure/built-in/project/default.ts` - 完善 defaultBuiltInProjectPreferences 中的 getTasksOptions

## 修改步骤

### 1. 完善 defaultBuiltInProjectPreferences 配置

在 `default.ts` 中更新每个内置清单的 `getTasksOptions`：

- **all**：保持现有配置（显示所有任务）
- **today**：使用 `relativeDate: "today"`
- **tomorrow**：使用 `relativeDate: "tomorrow"`
- **week**：使用 `relativeDate: "week"`
- **inbox**：使用 `projectId: "inbox"`（已确认是正确的查询码）
- **favourite**：使用 `isStarMarked: true`（替换当前的 `isFavorited`）
- **deleted**：使用 `isDeleted: true`
- **overdue**：使用 `relativeDate: "-today"`, `state: "todo,in-progress"`
- **givenup**：使用 `isGivenUp: true`

## 风险处理

1. **类型兼容性**：确保所有使用的字段都符合 GetTasksOptions 类型定义
2. **API 兼容性**：确保使用的查询参数与后端 API 一致
3. **向后兼容**：确保修改不会破坏现有功能
