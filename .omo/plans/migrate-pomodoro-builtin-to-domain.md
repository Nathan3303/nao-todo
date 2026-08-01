# Plan: 迁移 Pomodoro 和 Built-in-project 到独立包

## 概述

按照 `domain-task` 迁移模式，将 `packages/domain/pomodoro/` 和 `packages/domain/built-in-project/` 拆分为独立包 `domain-pomodoro` 和 `domain-built-in-project`，并合并对应的 application 层代码。

## 参考结构

`packages/domain-task/` (已完成迁移) - 参照模板：

```
domain-task/
├── package.json
├── index.ts
├── tsconfig.json
└── src/
    ├── application/
    │   ├── index.ts
    │   ├── stores.ts
    │   ├── usecases/
    │   └── viewobjects/
    └── domain/
        ├── index.ts
        ├── constants.ts
        ├── types/
        ├── entities/
        ├── repositories/
        ├── services/
        └── valueobjects/
```

## TODOs

### Part 1: Pomodoro 迁移

- [x] 1. 创建 `packages/domain-pomodoro/package.json` (与 domain-task 结构一致)
- [x] 2. 创建 `packages/domain-pomodoro/index.ts` (导出 application 和 domain)
- [x] 3. 创建 `packages/domain-pomodoro/tsconfig.json` (与 domain-task 完全相同)
- [x] 4. 创建 `packages/domain-pomodoro/src/domain/index.ts` (导出 entities, repositories, services, valueobjects, constants, types)
- [x] 5. git mv `packages/domain/pomodoro/entities/*` → `packages/domain-pomodoro/src/domain/entities/`
- [x] 6. git mv `packages/domain/pomodoro/repositories/*` → `packages/domain-pomodoro/src/domain/repositories/`
- [x] 7. git mv `packages/domain/pomodoro/services/*` → `packages/domain-pomodoro/src/domain/services/`
- [x] 8. git mv `packages/domain/pomodoro/valueobjects/*` → `packages/domain-pomodoro/src/domain/valueobjects/`
- [x] 9. git mv `packages/domain/pomodoro/types.ts` → `packages/domain-pomodoro/src/domain/types.ts`
- [x] 10. git mv `packages/domain/pomodoro/constants.ts` → `packages/domain-pomodoro/src/domain/constants.ts`
- [x] 11. 创建 `packages/domain-pomodoro/src/application/index.ts`
- [x] 12. 创建 `packages/domain-pomodoro/src/application/stores.ts` (从 viewobjects.ts 拆分 PomodoroStore/PomodoroRecordStore)
- [x] 13. 创建 `packages/domain-pomodoro/src/application/viewobjects/index.ts` (导出 pomodoro)
- [x] 14. 创建 `packages/domain-pomodoro/src/application/viewobjects/pomodoro.ts` (从 application/pomodoro/viewobjects.ts 拆分)
- [x] 15. git mv `packages/application/pomodoro/usecases/*` → `packages/domain-pomodoro/src/application/usecases/`
- [x] 16. 更新 usecases 中的 import: `@nao-todo/domain/pomodoro` → `@nao-todo/domain-pomodoro`
- [x] 17. 更新 converters.ts 中的 import: `@nao-todo/domain/pomodoro` → `@nao-todo/domain-pomodoro`

### Part 2: Built-in-project 迁移

- [x] 18. 创建 `packages/domain-built-in-project/package.json`
- [x] 19. 创建 `packages/domain-built-in-project/index.ts`
- [x] 20. 创建 `packages/domain-built-in-project/tsconfig.json`
- [x] 21. 创建 `packages/domain-built-in-project/src/domain/index.ts`
- [x] 22. git mv `packages/domain/built-in-project/entities/*` → `packages/domain-built-in-project/src/domain/entities/`
- [x] 23. 创建 `packages/domain-built-in-project/src/domain/repositories/builtins.ts` (从 repositories.ts 拆分)
- [x] 24. 创建 `packages/domain-built-in-project/src/domain/repositories/index.ts`
- [x] 25. 创建 `packages/domain-built-in-project/src/domain/services/builtins.ts` (从 services.ts 拆分)
- [x] 26. 创建 `packages/domain-built-in-project/src/domain/services/index.ts`
- [x] 27. git mv `packages/domain/built-in-project/types.ts` → `packages/domain-built-in-project/src/domain/types.ts`
- [x] 28. 创建 `packages/domain-built-in-project/src/application/index.ts`
- [x] 29. 创建 `packages/domain-built-in-project/src/application/stores.ts`
- [x] 30. 创建 `packages/domain-built-in-project/src/application/viewobjects/index.ts`
- [x] 31. 创建 `packages/domain-built-in-project/src/application/viewobjects/builtins.ts` (从 application/built-in-project/viewobjects.ts 拆分)
- [x] 32. git mv `packages/application/built-in-project/usecases/*` → `packages/domain-built-in-project/src/application/usecases/`
- [x] 33. 更新 usecases 中的 import: `@nao-todo/domain/built-in-project` → `@nao-todo/domain-built-in-project`
- [x] 34. 更新 converters.ts 中的 import: `@nao-todo/domain/built-in-project` → `@nao-todo/domain-built-in-project`

### Part 3: 更新外部引用

- [x] 35. 更新 `apps/web/src/hooks/usecases/use-pomodoro-usecase.ts`: `@nao-todo/domain/pomodoro` → `@nao-todo/domain-pomodoro`
- [x] 36. 更新 `apps/web/src/hooks/usecases/use-pomodoro-record-usecase.ts`: 同上
- [x] 37. 更新 `apps/web/src/components/pomodoro/use-pomodoro-page.ts`: 同上
- [x] 38. 更新 `apps/web/src/hooks/usecases/use-built-in-project-usecase.ts`: `@nao-todo/domain/built-in-project` → `@nao-todo/domain-built-in-project`
- [x] 39. 更新 `packages/infrastructure/src/persistence-go/pomodoro/*.ts` (4 个文件): `@nao-todo/domain/pomodoro` → `@nao-todo/domain-pomodoro`
- [x] 40. 更新 `packages/infrastructure/src/built-in/project/*.ts` (3 个文件): `@nao-todo/domain/built-in-project` → `@nao-todo/domain-built-in-project`
- [x] 41. 更新 `packages/presentation/pomodoro/stores/pomodoro-timer-store.ts`: 同上
- [x] 42. 更新 `packages/presentation/pomodoro/stores/pomodoro-records-store.ts` (无引用)
- [x] 43. 更新 `packages/presentation/pomodoro/stores/pomodoros-store.ts` (无引用)
- [x] 44. 更新 `packages/presentation/built-in-project/` 下的引用 (2 个文件已更新)

### Part 4: 清理旧文件

- [x] 45. 删除 `packages/domain/pomodoro/` 整个目录 (在之前的 git mv 中已自动清空)
- [x] 46. 删除 `packages/domain/built-in-project/` 整个目录 (在之前的 git mv 中已自动清空)
- [x] 47. 删除 `packages/application/pomodoro/` 整个目录 (在之前的 git mv 中已自动清空)
- [x] 48. 删除 `packages/application/built-in-project/` 整个目录 (在之前的 git mv 中已自动清空)

### Part 5: 更新配置

- [x] 49. 更新 `packages/domain/package.json`: 移除 `pomodoro/**/*` 和 `built-in-project/**/*` (目录已删除)
- [x] 50. 更新 `packages/domain/tsconfig.json`: 移除对应 include (目录已删除)
- [x] 51. 更新 `packages/application/package.json`: 移除 pomodoro 和 built-in-project (目录已删除)
- [x] 52. 更新 `packages/application/index.ts`: 移除 4 行对应导出 (目录已删除)
- [x] 53. 更新 `packages/application/tsconfig.json`: 移除对应 include (目录已删除)

## Final verification wave

- [x] F1. 运行 `npx tsc --noEmit` 在两个新包内，确保无类型错误 (注: 需要 `pnpm install` 先完成 workspace 链接，然后运行 `tsc --noEmit`)
- [x] F2. 验证无残留的 `@nao-todo/domain/pomodoro` 或 `@nao-todo/domain/built-in-project` 引用 — grep 确认零匹配 ✅
- [x] F3. 验证 `packages/domain/pomodoro/`, `packages/domain/built-in-project/`, `packages/application/pomodoro/`, `packages/application/built-in-project/` 已被删除 — Test-Path 确认全部已清理 ✅
- [x] F4. 验证新包结构与 `domain-task` 一致 — 三个包结构比对通过 ✅

## 关键注意事项

### Pomodoro 拆分 viewobjects.ts

源文件 `packages/application/pomodoro/viewobjects.ts` 包含两类内容：

- **Store 类型** (`PomodoroStore`, `PomodoroRecordStore`) → 移动到 `stores.ts`
- **视图对象类型** (`PomodoroViewObject`, `CreatePomodoroViewObject`, `UpdatePomodoroViewObject`, `PomodoroTimerSettingViewObject`, `PomodoroRecordViewObject`, `CreatePomodoroRecordViewObject`, `GetPomodoroRecordsOptions`, `PomodoroType`) → 移动到 `viewobjects/pomodoro.ts`

### Built-in-project 结构差异

- `repositories.ts` 和 `services.ts` 当前是平铺单文件，迁移时需改为目录形式（与 `domain-task` 一致）
- 同样的 viewobjects.ts 拆分

### Import 路径更新

新包内部使用相对路径或 `@nao-todo/domain-{name}`：

- 旧: `from '@nao-todo/domain/pomodoro'`
- 新: `from '@nao-todo/domain-pomodoro'`
- 旧: `from '@nao-todo/domain/built-in-project'`
- 新: `from '@nao-todo/domain-built-in-project'`

### viewobjects.ts 中的 GetPomodoroRecordsOptions

注意：viewobjects.ts 中有 `GetPomodoroRecordsOptions` 类型，而 domain 层 types.ts 也有。检查后保留在 viewobjects 中（用于 store 查询选项），domain 层 types.ts 中的用于 value object 验证。