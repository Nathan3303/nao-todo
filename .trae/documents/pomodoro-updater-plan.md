# 新增「常用专注」编辑功能

## Summary

为常用专注（Pomodoro）新增编辑能力：

1. 补齐后端到前端的「更新」调用链（Domain → UseCase → Store）。
2. 抽离 `PomodoroCreator` 对话框中的表单为独立可复用组件 `PomodoroForm`。
3. 新增 `PomodoroUpdater` 对话框组件，复用该表单。
4. 在 `PomodoroCollectionPage` 详情区名称一栏末尾添加编辑按钮，点击后打开更新对话框。

> 设计说明：本任务是在既有 NueUI 设计体系与对话框模式（参考 `ProjectUpdater` / `PomodoroCreator`）内新增功能，重点是**与现有交互/视觉保持一致**并复用组件，而非引入新的独立视觉风格。因此不套用全新的 frontend-design 激进美学方向，编辑按钮采用现有 `nue-button icon="edit" theme="icon,ghost,small"` 风格融入详情头部。

## Current State Analysis

更新链路当前缺失中间层（底层已具备）：

* 已存在（无需改动）：

  * [update-pomodoro.ts](file:///home/nathan/Projects/nao-todo/packages/domain/pomodoro/valueobjects/update-pomodoro.ts) — `UpdatePomodoroValueObject`

  * [pomodoro.ts](file:///home/nathan/Projects/nao-todo/packages/domain/pomodoro/repositories/pomodoro.ts) — 仓库接口 `update`

  * [pomodoro-repo-impl.ts](file:///home/nathan/Projects/nao-todo/packages/infrastructure/backend/pomodoro/pomodoro-repo-impl.ts#L62-L74) — `update` 实现（PUT `/pomodoros/:id`）

  * [converters.ts](file:///home/nathan/Projects/nao-todo/packages/infrastructure/backend/pomodoro/converters.ts#L72-L81) — `UpdatePomodoroValueObject2Req`

  * [index.ts](file:///home/nathan/Projects/nao-todo/packages/domain/pomodoro/index.ts) — 已导出 `UpdatePomodoroValueObject`

* 缺失（需新增）：

  * [services/pomodoro.ts](file:///home/nathan/Projects/nao-todo/packages/domain/pomodoro/services/pomodoro.ts) 领域服务无 `update`

  * [pomodoro.ts](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/pomodoro.ts) UseCase 无 `update`

  * [store.ts](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/store.ts) `PomodoroStore` 接口无更新方法

  * [base/pomodoro.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/base/pomodoro.ts) 与 [pomodoros-store.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-view/pomodoros-store.ts) 未暴露 `patchItem`

参考实现模式：

* 对话框注册/开关：`useDialogWrapper` + `dialogManager.register`（见 [pomodoro-creator.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/dialogs/pomodoro-creator/pomodoro-creator.vue)）

* 更新对话框范式：[project-updater.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/app/dialogs/project-updater/project-updater.vue) + [use-project-updater.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/app/dialogs/project-updater/use-project-updater.ts)（`open(id)` 载入数据、`update` 提交）

* 表单复用范式：[project-form.vue](file:///home/nathan/Projects/nao-todo/packages/components/project-form/project-form.vue)（v-model + `disabled`/`isNameEmpty` props）

* store 基类已提供 `patchItem`/`updateItem`（[use-mapper-store-base.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/hooks/use-mapper-store-base.ts)）

数据单位注意：视图对象 `duration` 单位为**秒**；创建/编辑表单展示为**分钟**。更新时需 秒 → 分钟（回填）与 分钟 → 秒（提交）转换。

## Proposed Changes

### A. 补齐更新调用链（Domain → UseCase → Store）

1. **[services/pomodoro.ts](file:///home/nathan/Projects/nao-todo/packages/domain/pomodoro/services/pomodoro.ts)** — 在 `PomodoroDomain` 新增：

   ```ts
   async update(updateVO: UpdatePomodoroValueObject): GoAsync<void> {
       const validateErr = updateVO.validate()
       if (validateErr !== null) return validateErr
       return await this.pomodoroRepo.update(updateVO)
   }
   ```

   需 import `UpdatePomodoroValueObject`（from `../valueobjects/update-pomodoro`）。

2. **[viewobjects.ts](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/viewobjects.ts)** — 新增 `UpdatePomodoroViewObject` 类型：

   ```ts
   export type UpdatePomodoroViewObject = Partial<CreatePomodoroViewObject>
   ```

3. **[converters.ts](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/converters.ts)** — 新增 `updatePomodoroViewObjectToValueObject(id, vo)`，返回填充字段后的 `UpdatePomodoroValueObject`（需从 `@nao-todo/domain/pomodoro` 引入 `UpdatePomodoroValueObject`）。

4. **[store.ts](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/store.ts)** — `PomodoroStore` 接口新增：

   ```ts
   patchPomodoro(id: string, patched: Partial<PomodoroViewObject>): void
   ```

5. **[pomodoro.ts](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/pomodoro.ts)** — `PomodoroUseCase` 新增 `update` 方法：

   * 视图对象 → 值对象（`updatePomodoroViewObjectToValueObject`）

   * `this.pomodoroDomain.update(valueObject)`（改为依赖 domain，而非直接 repo，保持与 create 一致）

   * 成功后 `this.store.patchPomodoro(id, patched)` 就地更新缓存

   * 返回 `GoAsync<void>`

6. **[base/pomodoro.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/base/pomodoro.ts)** — 从 `useMapperStoreBase` 解构并暴露 `patchItem as patchPomodoro`。

7. **[pomodoros-store.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoro-view/pomodoros-store.ts)** — 透传 `patchPomodoro`。

### B. 抽离可复用表单组件 `PomodoroForm`

新增本地组件（与 `pomodoro-creator` 同级，属应用层专用，不放 packages/components）：

* **`apps/web/src/layouts/pomodoro/dialogs/pomodoro-form/pomodoro-form.vue`** — 从 [pomodoro-creator.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/dialogs/pomodoro-creator/pomodoro-creator.vue#L38-L97) 的 `#content` 抽离，包含：名称输入 + 空校验提示、描述 textarea、专注类型 select、`type===1` 时的时长输入。

  * Props：`modelValue: { type; name; description; duration }`、`disabled?: boolean`、`isNameEmpty?: boolean`

  * Emits：`update:modelValue`

  * 模式：参照 [project-form.vue](file:///home/nathan/Projects/nao-todo/packages/components/project-form/project-form.vue)，用 `reactive` 内部态 + `watch` 双向同步。

* **`.../pomodoro-form/index.ts`** — 导出 `PomodoroForm`。

修改 **[pomodoro-creator.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/dialogs/pomodoro-creator/pomodoro-creator.vue)**：`#content` 内联表单替换为 `<pomodoro-form v-model="form" :disabled="creating" :is-name-empty="isNameEmpty" />`。其余逻辑（`usePomodoroCreator`、`handleSubmit`）不变。

### C. 新增 `PomodoroUpdater` 对话框

参照 `project-updater` 目录结构，新增 `apps/web/src/layouts/pomodoro/dialogs/pomodoro-updater/`：

1. **`use-pomodoro-updater.ts`** — 参照 [use-pomodoro-creator.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/dialogs/pomodoro-creator/use-pomodoro-creator.ts)：

   * inject `POMODORO_VIEW_CONTEXT_KEY` 拿 `dialogManager`、`pomodoroUseCase`；`usePomodorosStore` 取数据

   * `form`（分钟单位）、`updating`、`isNameEmpty`、`editingId`

   * `loadPomodoro(id)`：从 store 取 `PomodoroViewObject`，回填 form（`duration` 秒 → 分钟），无则 `NueMessage.error` 返回 false

   * `handleConfirm()`：名称/时长校验（复用 creator 的规则）→ `pomodoroUseCase.update(editingId, { type, name, description, duration*60 })` → 成功 `NueMessage.success('常用番茄专注修改成功')`

   * `resetStates()`
2. **`pomodoro-updater.vue`** — 参照 [project-updater.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/app/dialogs/project-updater/project-updater.vue)：

   * `open(id)`：`resetStates()` → `loadPomodoro(id)` 成功则 `visible=true`

   * `dialogManager.register(POMODORO_UPDATER_DIALOG_KEY, { open, close })`

   * 标题「编辑常用番茄专注」，`#content` 用 `<pomodoro-form v-model="form" :disabled="updating" :is-name-empty="isNameEmpty" />`，footer 主按钮「保存」
3. **`index.ts`** — 导出 `PomodoroUpdaterDialog`（与 [pomodoro-creator/index.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/dialogs/pomodoro-creator/index.ts) 一致的直接导出方式）。

### D. 注册对话框

1. **[dialog-keys.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/infrastructure/constants/dialog-keys.ts)** — 新增：

   ```ts
   export const POMODORO_UPDATER_DIALOG_KEY = 'pomodoro-updater-dialog'
   ```
2. **[dialog-adapter.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/dialogs/dialog-adapter.vue)** — 引入并挂载 `<pomodoro-updater-dialog />`。

### E. 详情区新增编辑按钮

1. **[use-pomodoro-collection.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/collection/use-pomodoro-collection.ts)** — 从注入的 context 中额外取出 `dialogManager` 并加入返回值；新增 `handleEdit()`：

   ```ts
   const handleEdit = () => {
       if (!selectedId.value) return
       dialogManager.open(POMODORO_UPDATER_DIALOG_KEY, selectedId.value)
   }
   ```

   （store 就地更新，`selectedPomodoro` computed 会自动刷新，无需 onClose 回调。）
2. **[collection/index.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/collection/index.vue#L83-L88)** — 详情头部 `.detail-header` 名称行末尾追加编辑按钮：

   ```html
   <nue-div theme="detail-header">
       <nue-text theme="detail-name">{{ selectedPomodoro.name }}</nue-text>
       <nue-text theme="detail-type">{{ typeToString(selectedPomodoro.type) }}</nue-text>
       <nue-button icon="edit" theme="icon,ghost,small" @click="handleEdit" />
   </nue-div>
   ```

   在 `<script setup>` 解构出 `handleEdit`。若需按钮靠右，`.detail-header` 现为 `align-items: baseline` 的 flex；追加 `margin-left: auto` 给按钮（通过内联或补一条 scoped 规则），保证编辑按钮位于名称栏末尾。

## Assumptions & Decisions

* `PomodoroForm` 放在应用层 `layouts/pomodoro/dialogs/pomodoro-form/`（应用专用，不进 `packages/components`）。

* `UseCase.update` 走 `PomodoroDomain.update`（新增），与 `create` 的分层一致；不直接调用 repo。

* 更新成功后仅 `patchPomodoro` 就地更新 store（不重新拉取列表），依赖 Pinia 响应式使详情/列表即时刷新。

* 编辑范围与创建一致：`type / name / description / duration`；`duration` 表单分钟、存储秒。

* 编辑按钮沿用现有图标按钮样式，保持视觉一致，不引入新设计语言。

## Verification

1. 类型检查/构建：在受影响包与应用运行 `pnpm -w typecheck`（或项目对应命令）确认无 TS 报错。
2. 手动验证：进入「常用专注」页 → 选中一条 → 点击详情名称栏编辑按钮 → 对话框回填正确（含分钟时长）→ 修改名称/描述/类型/时长 → 保存 → 详情与左侧列表即时更新、提示「修改成功」。
3. 校验：名称清空提示、时长 5–180 越界告警与创建一致。
4. 创建功能回归：确认抽离表单后 `PomodoroCreator` 新建流程仍正常。

