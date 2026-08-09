# @nao-todo/domain-built-in-project

内置清单（内置项目）领域包，负责"今天 / 本周 / 全部"等内置清单的领域模型与用例。

## 📐 分层结构

遵循 DDD 分层，包内含 `domain/`（领域层）与 `application/`（应用层）两层：

- **`domain/`** — 纯 TypeScript 领域内核，零框架依赖
    - `entities/` — 领域实体：`BuiltInProjectEntity`（id / name / icon / description / createTaskOptions）、`BuiltInProjectPreferenceEntity`（视图类型、列配置等偏好）
    - `repositories/` — 仓储接口 `BuiltInProjectRepository`（由 `@nao-todo/infrastructure` 实现）
    - `services/` — 领域服务 `BuiltInProjectDomain`（内置清单的 get / list 与偏好读写）
    - `types.ts` — 创建任务选项等类型
- **`application/`** — 应用层
    - `usecases/` — 用例 `BuiltInProjectUseCase`（加载内置清单、加载/保存偏好）
    - `viewobjects/` — 视图对象：`BuiltInProjectViewObject`、`BuiltInProjectPreferenceViewObject`
    - `stores.ts` — 用例存储接口 `BuiltInProjectStore`（由表现层实现）

## 📁 目录结构

```text
packages/domain-built-in-project/
└── src/
    ├── application/
    │   ├── index.ts
    │   ├── stores.ts
    │   ├── usecases/
    │   │   ├── built-in-project.ts
    │   │   ├── converters.ts
    │   │   └── index.ts
    │   └── viewobjects/
    │       ├── builtins.ts
    │       └── index.ts
    └── domain/
        ├── entities/
        │   ├── built-in-project.ts
        │   ├── built-in-project-preference.ts
        │   └── index.ts
        ├── repositories/
        │   ├── builtins.ts
        │   └── index.ts
        ├── services/
        │   ├── builtins.ts
        │   └── index.ts
        ├── index.ts
        └── types.ts
```

## 🔗 依赖

- `@nao-todo/shared`（workspace）