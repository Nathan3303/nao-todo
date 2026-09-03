# @nao-todo/domain-pomodoro

番茄钟领域包，负责专注计时器、番茄钟记录与统计的领域模型和用例。

## 📐 分层结构

遵循 DDD 分层，包内含 `domain/`（领域层）与 `application/`（应用层）两层：

- **`domain/`** — 纯 TypeScript 领域内核，零框架依赖
    - `entities/` — 领域实体：`PomodoroEntity`（番茄钟：时长、休息、任务关联）、`PomodoroRecordEntity`（番茄钟记录）
    - `repositories/` — 仓储接口：`PomodoroRepository`、`PomodoroRecordRepository`（由 `@nao-todo/infrastructure` 实现）
    - `services/` — 领域服务 `PomodoroDomain`
    - `valueobjects/` — 值对象与入参校验：`CreatePomodoro`、`UpdatePomodoro`、`ListPomodoro`、`CreatePomodoroRecord`
    - `constants.ts` / `types.ts` — 领域常量与类型
- **`application/`** — 应用层
    - `usecases/` — 用例：`PomodoroUseCase`（番茄钟 CRUD 与状态流转）、`PomodoroRecordUseCase`（记录与统计）
    - `viewobjects/` — 视图对象：`PomodoroViewObject` 等
    - `stores.ts` — 用例存储接口（由表现层实现）

## 📁 目录结构

```text
packages/domain-pomodoro/
└── src/
    ├── application/
    │   ├── index.ts
    │   ├── stores.ts
    │   ├── usecases/
    │   │   ├── converters.ts
    │   │   ├── index.ts
    │   │   ├── pomodoro-record.ts
    │   │   └── pomodoro.ts
    │   └── viewobjects/
    │       ├── index.ts
    │       └── pomodoro.ts
    └── domain/
        ├── constants.ts
        ├── entities/
        │   ├── index.ts
        │   ├── pomodoro-record.ts
        │   └── pomodoro.ts
        ├── repositories/
        │   ├── index.ts
        │   ├── pomodoro-record.ts
        │   └── pomodoro.ts
        ├── services/
        │   ├── index.ts
        │   └── pomodoro.ts
        ├── types.ts
        └── valueobjects/
            ├── create-pomodoro-record.ts
            ├── create-pomodoro.ts
            ├── index.ts
            ├── list-pomodoro.ts
            └── update-pomodoro.ts
```

## 🔗 依赖

- `@nao-todo/shared`（workspace）
- `dayjs`