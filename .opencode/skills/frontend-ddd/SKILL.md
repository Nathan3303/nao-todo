---
name: frontend-ddd
description: Frontend ddd skill markdown. 本文档定义了本项目的领域驱动设计 (DDD) 架构原则和代码组织规范。
---

## 目录结构

```
packages/
├── domain/              # 领域层 - 核心业务逻辑
│   ├── {entity}/        # 按实体组织 (task, project, user, tag)
│   │   ├── entities.ts  # 实体定义
│   │   ├── repositories.ts  # 仓储接口
│   │   ├── service.ts   # 领域服务
│   │   └── index.ts     # 统一导出
├── application/         # 应用层 - 用例编排
│   └── web/
│       ├── usecases/   # 用例实现
│       ├── converters/ # DTO 转换器
│       └── stores/     # 状态管理
├── infrastructure/      # 基础设施层
│   ├── backend/        # 后端 API 实现
│   │   └── {entity}/
│   │       ├── repoImpl.ts    # 仓储实现
│   │       ├── converters.ts  # 转换器
│   │       └── types/         # 请求/响应类型
│   ├── hooks/         # React Hooks
│   ├── utils/         # 工具函数
│   ├── consts/        # 常量定义
│   └── requester/    # HTTP 请求封装
├── types/             # 类型定义
│   ├── models/        # 领域模型类型
│   ├── viewobjects/   # 视图对象类型
│   └── views/         # 视图类型
└── components/        # UI 组件
```

## 各层职责

### Domain Layer (领域层)

- **Entities**: 核心业务实体，包含业务规则和状态
- **Repositories (Interface)**: 仓储接口定义，仅声明方法签名
- **Services**: 领域服务，处理跨实体业务逻辑

```typescript
// domain/task/entities.ts
export class TaskEntity {
    public id: string = ''
    public name: string = ''
    public state: string = ''
    // ... 实体属性
}

// domain/task/repositories.ts
export interface TaskRepository {
    get(taskId: string): GoAsync<TaskEntity>
    create(createVO: CreateTask): GoAsync<TaskEntity>
    update(taskId: string, taskEntity: TaskEntity): GoAsync<string>
    remove(taskId: string): GoAsync<void>
    list(
        queryString?: string
    ): GoAsync<{ taskEntities: TaskEntity[]; pagination?: ResponseDataPagination }>
}
```

### Application Layer (应用层)

- **UseCases**: 用例类，协调领域服务完成业务流程
- **Converters**: DTO 转换器，负责实体与视图对象互转
- **Stores**: 状态管理

```typescript
// application/web/usecases/task.ts
export class TaskUseCase {
    constructor(
        private taskDomain: TaskDomain,
        private store: TaskStore
    ) {}

    async loadTasks(options: GetTasksOptions) {
        // 1. 调用领域服务
        const [res, err] = await this.taskDomain.list(options)
        if (err !== null) return [null, err]
        // 2. 转换为视图对象
        const tasks = res.taskEntities.map(taskEntity2ViewObject)
        // 3. 存储结果
        this.store.setTasks(tasks)
        return [{ taskIds: tasks.map((t) => t.id), pagination: res.pagination }, null]
    }
}
```

### Infrastructure Layer (基础设施层)

- **Repository Implementations**: 仓储具体实现，调用外部服务
- **Converters**: 数据转换，将 API 响应转为领域实体
- **Hooks**: React 组件复用逻辑
- **Utils**: 工具函数

```typescript
// infrastructure/backend/task/repoImpl.ts
export const useTaskRepository = (requester: Requester): TaskRepository => {
  const get = async (taskId: string): GoAsync<TaskEntity> => {
    // 1. 调用 API
    const response = await requester.get(`/tasks/${taskId}`, ...)
    // 2. 转换为实体
    const taskEntity = getTaskRes2TaskEntity(response.data)
    return [taskEntity, null]
  }
  return { get, create, update, remove, list }
}
```

### Types Layer (类型定义)

- **models**: 领域模型类型，用于创建/更新操作
- **viewobjects**: 视图对象类型，用于 UI 显示
- **views**: 视图类型定义

## 依赖规则

```
┌─────────────────────────────────────┐
│           Application               │
│   (usecases, converters, stores)   │
├─────────────────────────────────────┤
│              Domain                  │
│   (entities, repositories, services)│
├─────────────────────────────────────┤
│            Infrastructure            │
│   (repoImpl, hooks, utils, requester)│
├─────────────────────────────────────┤
│              Types                   │
│      (models, viewobjects, views)    │
└─────────────────────────────────────┘
```

- **依赖方向**: 只能从外层指向内层
- **Domain 层**: 不依赖任何其他层，是最核心的模块
- **Application 层**: 依赖 Domain 层
- **Infrastructure 层**: 实现 Domain 定义的接口
- **Types 层**: 被所有层引用

## 命名约定

### 文件命名

| 类型                      | 命名规则          | 示例                       |
| ------------------------- | ----------------- | -------------------------- |
| Entity                    | `entities.ts`     | `task/entities.ts`         |
| Repository Interface      | `repositories.ts` | `task/repositories.ts`     |
| Repository Implementation | `repoImpl.ts`     | `backend/task/repoImpl.ts` |
| Service                   | `service.ts`      | `task/service.ts`          |
| UseCase                   | `{entity}.ts`     | `usecases/task.ts`         |
| Converter                 | `{entity}.ts`     | `converters/task.ts`       |
| Types                     | `types.ts`        | `backend/types/task.ts`    |

### 导出命名

```typescript
// domain/task/index.ts
export { TaskEntity } from './entities'
export type { TaskRepository } from './repositories'
export { TaskDomain } from './services'
```

### 转换器命名

- **Entity → ViewObject**: `taskEntity2ViewObject`
- **Response → Entity**: `getTaskRes2TaskEntity`
- **Entity → Request**: `taskEntity2CreateTaskReq`

## 代码组织规范

### 1. 每个包必须包含 index.ts

```typescript
// packages/domain/task/index.ts
export { TaskEntity } from './entities'
export type { TaskRepository } from './repositories'
export { TaskDomain } from './services'
```

### 2. 错误处理模式

使用元组返回 `[data, error]` 模式：

```typescript
type GoAsync<T> = [T, null] | [null, string]

async function getTask(id: string): GoAsync<TaskEntity> {
    try {
        const res = await api.get(id)
        return [transform(res), null]
    } catch (e) {
        return [null, e.message]
    }
}
```

### 3. 仓储工厂模式

```typescript
// infrastructure 层使用 hook 模式创建仓储实例
export const useTaskRepository = (requester: Requester): TaskRepository => {
    return {
        /* 实现 */
    }
}
```

### 4. 用例依赖注入

```typescript
class TaskUseCase {
    constructor(
        private taskDomain: TaskDomain,
        private store: TaskStore
    ) {}
}
```

## 开发流程

1. **定义 Domain 层**

    - 创建实体 (`entities.ts`)
    - 定义仓储接口 (`repositories.ts`)
    - 实现领域服务 (`service.ts`)

2. **实现 Infrastructure 层**

    - 创建 API 类型 (`backend/types/`)
    - 实现仓储 (`backend/{entity}/repoImpl.ts`)
    - 实现转换器 (`backend/{entity}/converters.ts`)

3. **构建 Application 层**

    - 实现用例 (`usecases/`)
    - 创建转换器 (`converters/`)
    - 管理状态 (`stores/`)

4. **使用 Types 层**
    - 定义模型类型 (`models/`)
    - 定义视图对象 (`viewobjects/`)

## 注意事项

- Domain 层是纯业务逻辑，不包含任何技术实现细节
- Repository 接口定义在 Domain 层，实现放在 Infrastructure 层
- Application 层负责协调，不包含业务逻辑
- 所有层通过 Types 定义共享类型
