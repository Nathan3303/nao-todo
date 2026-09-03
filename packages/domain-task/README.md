# @nao-todo/domain-task

任务领域包，负责任务、检查事项（子任务）与评论的领域模型和用例。

## 📐 分层结构

遵循 DDD 分层，包内含 `domain/`（领域层）与 `application/`（应用层）两层：

- **`domain/`** — 纯 TypeScript 领域内核，零框架依赖
    - `entities/` — 领域实体：`TaskEntity`（任务：优先级、状态、截止日期、提醒、附件等）、`TaskCheckItemEntity`（检查事项）、`TaskCommentEntity`（评论）
    - `repositories/` — 仓储接口：`TaskRepository`、`TaskCheckItemRepository`、`TaskCommentRepository`（由 `@nao-todo/infrastructure` 实现）
    - `services/` — 领域服务 `TaskDomain`
    - `valueobjects/` — 值对象与入参校验：`CreateTask`、`UpdateTask`、`CreateTaskCheckItem`、`UpdateTaskCheckItem`、`CreateTaskComment`、`UpdateTaskComment`
    - `constants.ts` / `errors.ts` / `types/` — 常量、错误码与类型
- **`application/`** — 应用层
    - `usecases/` — 用例：`TaskUseCase`（任务加载/创建/更新/删除/排序等）、`TaskCheckItemUseCase`、`TaskCommentUseCase`
    - `viewobjects/` — 视图对象：`TaskViewObject` 等
    - `stores.ts` — 用例存储接口（由表现层实现）

## 📁 目录结构

```text
packages/domain-task/
└── src/
    ├── application/
    │   ├── index.ts
    │   ├── stores.ts
    │   ├── usecases/
    │   │   ├── converters.ts
    │   │   ├── index.ts
    │   │   ├── task-check-item.ts
    │   │   ├── task-comment.ts
    │   │   └── task.ts
    │   └── viewobjects/
    │       ├── index.ts
    │       └── task.ts
    └── domain/
        ├── constants.ts
        ├── entities/
        │   ├── index.ts
        │   ├── task-check-item.ts
        │   ├── task-comment.ts
        │   └── task.ts
        ├── errors.ts
        ├── repositories/
        │   ├── index.ts
        │   ├── task-check-item.ts
        │   ├── task-comment.ts
        │   └── task.ts
        ├── services/
        │   ├── index.ts
        │   └── task.ts
        ├── types/
        │   └── index.ts
        └── valueobjects/
            ├── create-task-check-item.ts
            ├── create-task-comment.ts
            ├── create-task.ts
            ├── index.ts
            ├── update-task-check-item.ts
            ├── update-task-comment.ts
            └── update-task.ts
```

## 🔗 依赖

- `@nao-todo/shared`（workspace）
- `dayjs`