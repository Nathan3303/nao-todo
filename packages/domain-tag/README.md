# @nao-todo/domain-tag

标签领域包，负责标签及其偏好的领域模型与用例。

## 📐 分层结构

遵循 DDD 分层，包内含 `domain/`（领域层）与 `application/`（应用层）两层：

- **`domain/`** — 纯 TypeScript 领域内核，零框架依赖
    - `entities/` — 领域实体：`TagEntity`（标签：名称、颜色、排序）、`TagPreferenceEntity`（标签偏好）
    - `repositories/` — 仓储接口：`TagRepository`、`TagPreferenceRepository`（由 `@nao-todo/infrastructure` 实现）
    - `services/` — 领域服务 `TagDomain`
    - `valueobjects/` — 值对象与入参校验：`CreateTag`、`UpdateTag`
- **`application/`** — 应用层
    - `usecases/` — 用例 `TagUseCase`（加载、创建、更新标签与偏好）
    - `viewobjects/` — 视图对象：`TagViewObject`、`TagPreferenceViewObject`
    - `stores.ts` — 用例存储接口（由表现层实现）

## 📁 目录结构

```text
packages/domain-tag/
└── src/
    ├── application/
    │   ├── index.ts
    │   ├── stores.ts
    │   ├── usecases/
    │   │   ├── converters.ts
    │   │   ├── index.ts
    │   │   └── tag.ts
    │   └── viewobjects/
    │       ├── index.ts
    │       ├── tag-preference.ts
    │       └── tag.ts
    └── domain/
        ├── entities/
        │   ├── index.ts
        │   ├── tag-preference.ts
        │   └── tag.ts
        ├── repositories/
        │   ├── index.ts
        │   ├── tag-preference.ts
        │   └── tag.ts
        ├── services/
        │   ├── index.ts
        │   └── tag.ts
        └── valueobjects/
            ├── create-tag.ts
            ├── index.ts
            └── update-tag.ts
```

## 🔗 依赖

- `@nao-todo/shared`（workspace）