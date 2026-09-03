# @nao-todo/domain-project

项目领域包，负责清单（项目）及其偏好的领域模型与用例。

## 📐 分层结构

遵循 DDD 分层，包内含 `domain/`（领域层）与 `application/`（应用层）两层：

- **`domain/`** — 纯 TypeScript 领域内核，零框架依赖
    - `entities/` — 领域实体：`ProjectEntity`（项目：名称、颜色、归档/删除状态）、`ProjectPreferenceEntity`（项目偏好：视图类型、列配置）
    - `repositories/` — 仓储接口：`ProjectRepository`、`ProjectPreferenceRepository`（由 `@nao-todo/infrastructure` 实现）
    - `services/` — 领域服务 `ProjectDomain`
    - `valueobjects/` — 值对象与入参校验：`CreateProject`、`UpdateProject`、`SaveProjectPreference`
- **`application/`** — 应用层
    - `usecases/project-service/` — 用例 `ProjectUseCase`（加载、创建、更新项目与偏好）
    - `viewobjects/` — 视图对象：`ProjectViewObject`、`ProjectPreferenceViewObject`
    - `stores.ts` — 用例存储接口（由表现层实现）

## 📁 目录结构

```text
packages/domain-project/
└── src/
    ├── application/
    │   ├── index.ts
    │   ├── stores.ts
    │   ├── usecases/
    │   │   ├── index.ts
    │   │   └── project-service/
    │   │       ├── converters.ts
    │   │       ├── index.ts
    │   │       └── project.ts
    │   └── viewobjects/
    │       ├── index.ts
    │       ├── project-preference.ts
    │       └── project.ts
    └── domain/
        ├── entities/
        │   ├── index.ts
        │   ├── project-preference.ts
        │   └── project.ts
        ├── repositories/
        │   ├── index.ts
        │   ├── project-preference.ts
        │   └── project.ts
        ├── services/
        │   ├── index.ts
        │   └── project.ts
        └── valueobjects/
            ├── create-project.ts
            ├── index.ts
            ├── save-project-preference.ts
            └── update-project.ts
```

## 🔗 依赖

- `@nao-todo/shared`（workspace）