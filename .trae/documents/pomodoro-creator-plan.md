# 常用番茄专注创建对话框 PomodoroCreator 实现计划

## Summary

为 `apps/web/src/layouts/pomodoro/dialogs` 新增 **PomodoroCreator**（常用番茄专注创建对话框），并打通完整创建执行链：

```
CreatePomodoroViewObject (usecases)
  → CreatePomodoroValueObject (domain)
    → CreatePomodoroReq (infrastructure)
      → POST /pomodoros/
        → PomodoroEntity
          → PomodoroViewObject
            → PomodoroStore
```

对话框基于领域实体 `PomodoroEntity` 对应的可创建字段（`type` / `name` / `description` / `duration`）组织表单，入口放在番茄页头部（`layouts/pomodoro/index.vue` 的 `actions` 区），成功后写入新增的 `PomodoroStore`。

严格遵循项目现有 DDD 分层与代码风格（参考 `project` 用例链与 `PomodoroRecord` 链）。

## Current State Analysis

### 已有基础设施（可直接复用）

* **domain 层已完备**：

  * [pomodoro.ts](file:///home/nathan/Projects/nao-todo/packages/domain/pomodoro/entities/pomodoro.ts) — `PomodoroEntity`（id/createdAt/updatedAt/deletedAt/type/name/description/duration/archivedAt/totalDuration）

  * [create-pomodoro.ts](file:///home/nathan/Projects/nao-todo/packages/domain/pomodoro/valueobjects/create-pomodoro.ts) — `CreatePomodoroValueObject(type, name, description, duration)`

  * [pomodoro.ts](file:///home/nathan/Projects/nao-todo/packages/domain/pomodoro/repositories/pomodoro.ts) — `PomodoroRepository.create()`

  * domain `index.ts` 已导出上述类型

* **infrastructure 层已完备**：

  * [pomodoro-repo-impl.ts](file:///home/nathan/Projects/nao-todo/packages/infrastructure/backend/pomodoro/pomodoro-repo-impl.ts) — `PomodoroRepoImpl.create()` 已实现（POST `/pomodoros/`，成功码 `70050`）

  * [converters.ts](file:///home/nathan/Projects/nao-todo/packages/infrastructure/backend/pomodoro/converters.ts) — `createPomodoroValueObject2Req` / `createPomodoroRes2Entity` / `pomodoroRes2Entity` 已实现

  * [pomodoro.ts (models)](file:///home/nathan/Projects/nao-todo/packages/infrastructure/backend/models/pomodoro.ts) — `CreatePomodoroReq` / `CreatePomodoroRes` 已定义

* **usecases 层缺口**：

  * [pomodoro.ts (usecase)](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/pomodoro.ts) — `PomodoroUseCase` 是空壳，**无** **`create`** **方法、无 store**

  * [viewobjects.ts](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/viewobjects.ts) — 只有 Record 相关 ViewObject，**缺** **`PomodoroViewObject`** **/** **`CreatePomodoroViewObject`**

  * [converters.ts (usecase)](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/converters.ts) — 只有 Record 相关转换，**缺 Pomodoro 的 entity↔viewObject / viewObject→valueObject**

  * [store.ts](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/store.ts) — 只有 `PomodoroRecordStore`，**缺** **`PomodoroStore`** **接口**

* **web 层**：

  * [dialogs/index.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/dialogs/index.ts) + [dialog-adapter.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/dialogs/dialog-adapter.vue) — 目前仅挂载 `timer-setting` 对话框

  * [dialog-keys.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/infrastructure/constants/dialog-keys.ts) — 需新增 key

  * [context.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/views/index/pomodoro/context.ts) + [pomodoro-view.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/views/index/pomodoro/pomodoro-view.ts) — 番茄视图上下文，需注入 `pomodoroUseCase`

  * [index.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/index.vue) — 头部 `actions` 区，添加"新建常用"按钮

  * 现有 `PomodoroStore`（Pinia）[pomodoro-store.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-store.ts) 是设置/记录状态，**与新增的"常用番茄专注列表 store"是不同概念**，需新建独立 Pinia store 避免污染。

### 关键约定（来自现有代码）

* `PomodoroType`：后端 `uint8`，`0=timer`（番茄钟）/ `1=focus`（专注正计时）。参考 [viewobjects.ts](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/viewobjects.ts#L7)。

* `duration` 单位为**秒**；表单以**分钟**展示（参考 timer-setting 的分钟↔秒换算）。

* 用例创建方法返回 `GoAsync<T>`，错误用 `unwrapError` 处理（参考 project-creator）。

* 存储通过依赖注入的 `Store` 接口解耦（usecases 定义接口，Pinia store 实现，`newXxxUseCase(store)` 注入）。

## Proposed Changes

### 一、usecases 层（补齐 Pomodoro 创建链）

#### 1. [viewobjects.ts](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/viewobjects.ts) — 新增视图对象

新增 `PomodoroViewObject` 与 `CreatePomodoroViewObject`（追加到文件末尾，保留现有 Record 定义）：

```ts
/**
 * 常用番茄专注视图对象
 */
export type PomodoroViewObject = ViewObjectBase & {
    type: PomodoroType
    name: string
    description: NullableString
    duration: number
    archivedAt: NullableString
    totalDuration: number
    // -- Others
    isArchived: boolean
}

/**
 * 创建常用番茄专注视图对象
 */
export type CreatePomodoroViewObject = {
    type: PomodoroViewObject['type']
    name: PomodoroViewObject['name']
    description: PomodoroViewObject['description']
    duration: PomodoroViewObject['duration']
}
```

* **why**：作为对话框表单与用例创建的输入/输出契约。

* 复用现有 `PomodoroType`、`ViewObjectBase`、`NullableString`。

#### 2. [converters.ts (usecase)](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/converters.ts) — 新增转换函数

新增（参考 project 的 `dayjs(archivedAt).isValid()` 计算 `isArchived`）：

```ts
export const pomodoroEntityToViewObject = (entity: PomodoroEntity): PomodoroViewObject => { ... }
export const pomodoroEntitiesToViewObjects = (entities: PomodoroEntity[]): PomodoroViewObject[] => { ... }
export const createPomodoroViewObjectToValueObject = (
    viewObject: CreatePomodoroViewObject
): CreatePomodoroValueObject => new CreatePomodoroValueObject(
    viewObject.type,
    viewObject.name,
    viewObject.description ?? '',
    viewObject.duration
)
```

* **why**：完成 ViewObject↔Entity、ViewObject→ValueObject 转换。

* 引入 `PomodoroEntity`、`CreatePomodoroValueObject`、`dayjs`。

#### 3. [store.ts](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/store.ts) — 新增 `PomodoroStore` 接口

参考 `PomodoroRecordStore` / `ProjectStore` 风格，追加：

```ts
export interface PomodoroStore {
    setPomodoros(pomodoros: PomodoroViewObject[]): void
    addPomodoro(pomodoro: PomodoroViewObject): void
}
```

* **why**：解耦用例与 Pinia store。仅按当前需求提供 `set`/`add`（不过度设计）。

#### 4. [pomodoro.ts (usecase)](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/pomodoro.ts) — 实现 `create` + 注入 store

* 构造函数新增 `private store: PomodoroStore`（取消原注释占位）。

* 新增 `create(createViewObject: CreatePomodoroViewObject): GoAsync<PomodoroViewObject>`，流程参考 `PomodoroRecordUseCase.createRecord` / `ProjectUseCase.create`：

  1. `createPomodoroViewObjectToValueObject`
  2. `this.pomodoroRepo.create(valueObject)`（domain `create` 未提供，直接用 repo，与 Record 用例一致地保持最短路径；见"Assumptions"）
  3. `pomodoroEntityToViewObject`
  4. `this.store.addPomodoro(viewObject)`
  5. 返回 `[viewObject, null]`

* `newPomodoroUseCase` 改为接收 `store: PomodoroStore` 参数并传入。

* **why**：打通用例层创建逻辑并落库到 store。

#### 5. [index.ts (usecase)](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/index.ts) — 导出 `PomodoroStore`

追加 `export type { PomodoroStore } from './store'`（与现有 `PomodoroRecordStore` 并列）。

### 二、web 层（对话框 + 入口 + Pinia store）

#### 6. 新增 Pinia store（使用 `useMapperStoreBase`）
严格遵循 `projects-store` 的两文件模式（base 组合式 hook + `defineStore` 包装），基于 `useMapperStoreBase`：

**6a. 新增 base hook：`apps/web/src/stores/base/pomodoro.ts`**
参考 [project.ts (base)](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/base/project.ts#L7-L62) 的 `useProjectsStoreBase`：

```ts
import type { PomodoroViewObject } from '@nao-todo/usecases/pomodoro'
import { useMapperStoreBase } from '../hooks/use-mapper-store-base'

export const usePomodorosStoreBase = () => {
    const {
        list: pomodoros,
        setList: setPomodoros,
        addItem: addPomodoro,
        getItem: getPomodoro
    } = useMapperStoreBase<PomodoroViewObject>()

    // @action 获取所有常用番茄专注
    const getAllPomodoros = () => [...pomodoros.value]

    // @returns
    return { pomodoros, setPomodoros, addPomodoro, getPomodoro, getAllPomodoros }
}
```

**6b. 新增 store：`apps/web/src/stores/pomodoros-store.ts`**
参考 [projects-store.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/projects-store.ts#L7-L80) 的 `defineStore` 组合方式：

```ts
export default defineStore('PomodorosStore', () => {
    const { pomodoros, setPomodoros, addPomodoro, getPomodoro, getAllPomodoros } =
        usePomodorosStoreBase()
    return { pomodoros, setPomodoros, addPomodoro, getPomodoro, getAllPomodoros }
})
```

- **why**：满足用户"新增 PomodoroStore"的选择，并复用 `useMapperStoreBase`（`Map<id, PomodoroViewObject>` 索引），与项目现有 store 分层一致。
- `setPomodoros`/`addPomodoro` 即实现 usecases 层 `PomodoroStore` 接口所需的两个方法。
- **命名说明**：现有 `usePomodoroStore`(`pomodoro-store.ts`，设置/记录) 保持不变；新 store 用复数 `usePomodorosStore`(`pomodoros-store.ts`)，语义为"常用番茄专注列表"。
- 若在 [stores/base/index.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/base/index.ts) 中统一 re-export base hooks，则同步追加 `usePomodorosStoreBase` 导出（执行时按现有约定确认）。

#### 7. [dialog-keys.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/infrastructure/constants/dialog-keys.ts) — 新增 key

追加：`export const POMODORO_CREATOR_DIALOG_KEY = 'pomodoro-creator-dialog'`

#### 8. 新增对话框目录 `apps/web/src/layouts/pomodoro/dialogs/pomodoro-creator/`

参考 `dialogs/timer-setting/` 与 `app/dialogs/project-creator/` 结构：

* **`use-pomodoro-creator.ts`**：`inject(POMODORO_VIEW_CONTEXT_KEY)` 取 `dialogManager` + `pomodoroUseCase`；`viewObject` ref（`{ type: 0, name: '', description: '', duration: 25 }`，duration 以分钟展示）；`creating`/`isNameEmpty` 状态；`clearInputsValue`；`handleConfirm`（校验 name 非空、duration 范围 5-180；调用 `pomodoroUseCase.create`，成功 `NueMessage.success('常用番茄专注创建成功')`，失败 `console.warn(unwrapError(error))`）。**分钟→秒换算在提交时进行**。

* **`pomodoro-creator.vue`**：`nue-dialog theme="pomodoro-creator"`，注册到 `dialogManager`（参考 timer-setting 的 `onMounted` 注册模式）；表单含：类型选择（`nue-select`：番茄钟=0 / 正计时=1）、名称（`nue-input`，`is-name-empty` 提示）、描述（`nue-input` textarea）、专注时长（分钟，`nue-input` number，min 5 max 180）。header/footer 结构参考 timer-setting。

* **`index.ts`**：`export const PomodoroCreatorDialog = PomodoroCreator`

#### 9. [dialogs/dialog-adapter.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/dialogs/dialog-adapter.vue) — 挂载新对话框

在模板中并列添加 `<pomodoro-creator-dialog />`，并在 `dialogs/index.ts` 无需改动（adapter 统一挂载）。

#### 10. [context.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/views/index/pomodoro/context.ts) — 上下文新增 `pomodoroUseCase`

`PomodoroViewContext` 类型追加 `pomodoroUseCase: PomodoroUseCase`。

#### 11. [pomodoro-view.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/views/index/pomodoro/pomodoro-view.ts) — 实例化并 provide

* `const pomodorosStore = usePomodorosStore()`

* `const pomodoroUseCase = newPomodoroUseCase(pomodorosStore)`

* 在 `provide(POMODORO_VIEW_CONTEXT_KEY, { ... pomodoroUseCase })` 中加入。

#### 12. [layouts/pomodoro/index.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/index.vue) — 头部按钮入口

* 在 `nue-div theme="actions"` 区、历史按钮旁新增"新建常用番茄专注"按钮（`nue-button icon="plus" theme="icon,ghost"` + `nue-tooltip`）。

* 从 `usePomodoroPage` 或直接用注入的 `dialogManager` 调用 `dialogManager.open(POMODORO_CREATOR_DIALOG_KEY)`。采用直接注入 `dialogManager`（`index.vue` 已注入）新增 `handleOpenCreator` 内联方法，最小改动。

## Assumptions & Decisions

1. **`PomodoroType`** **值**：ViewObject 层 `type` 用后端数值 `0 | 1`（沿用 usecases 现有 `PomodoroType = 0 | 1`），非 `'timer'|'focus'` 字符串（后者是 `views/index/pomodoro/types.ts` 中前端页面用的另一套，不复用）。
2. **创建走 repo 而非 domain**：`PomodoroDomain` 未暴露 `create`（仅 `list`/record 相关）。为保持最短且与现有能力一致，用例层直接调用 `this.pomodoroRepo.create`（构造函数已持有 `pomodoroRepo`）。**不新增 domain.create**，避免超出需求范围。
3. **新建独立 Pinia store** **`PomodorosStore`**：不复用/污染现有 `PomodoroStore`(设置+记录)。用复数命名区分。
4. **`description`** **传空字符串**：`CreatePomodoroValueObject` 的 `description: string`（非空类型），当用户未填时传 `''`。
5. **duration 单位**：表单分钟、存储/请求秒，提交时 `* 60`。默认 25 分钟。
6. **入口**：按用户选择放在番茄页头部 actions 区。
7. **不实现列表展示 UI**：本次仅创建链 + store 落库；侧边栏/列表渲染不在范围内（未被要求）。

## Verification

1. **类型检查**：`pnpm -C apps/web type-check` 或项目根 `pnpm build` 无 TS 报错（重点：新 ViewObject/Store 导出、`newPomodoroUseCase` 签名变更无遗漏调用点——已确认仅 `pomodoro-view.ts` 会调用）。
2. **运行时手测**：

   * 启动 web，进入 `/pomodoro/timer`，点击头部"新建常用番茄专注"按钮 → 对话框弹出。

   * 名称留空点创建 → 出现空名校验提示，不提交。

   * 填写名称、选类型、设时长，点创建 → `NueMessage.success`，对话框关闭，网络面板出现 `POST /pomodoros/`（返回码 `70050`）。

   * 创建后 `usePomodorosStore().pomodoros` 含新条目（可临时 console 验证）。
3. **回归**：timer-setting 对话框与番茄计时功能不受影响（未改动其逻辑）。

## 执行顺序（建议）

1. usecases 层：viewobjects → converters → store → pomodoro(usecase) → index（自底向上）
2. web Pinia store：pomodoros-store.ts
3. dialog-keys → 对话框目录（use + vue + index）→ dialog-adapter
4. context → pomodoro-view（注入）
5. index.vue 头部按钮
6. 类型检查 + 手测

