# 常用专注查看页面（PomodoroCollection）实现计划

## Summary

新增「常用专注」查看页面：独立 Layout 组件，路由 `/pomodoro/pomodoros`，由 [routes.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/views/index/pomodoro/routes.ts) 引用，与 `timer` / `focus` 并列。页面查询走 `PomodoroUseCase` 执行链（补齐 `loadPomodoros` 方法），结果存入 `PomodoroStore`（`pomodoros-store.ts`）。页面包含两个区域：**列表区域**（罗列用户创建的常用专注）与**详细区域**（展示选中项的数据）。

查询执行链（补齐 usecase 的 list）：

```
loadPomodoros(options)  ← PomodoroUseCase (新增)
  → ListPomodoroValueObject (domain, 已存在)
    → PomodoroDomain.list() (已存在)
      → PomodoroRepoImpl.list() → GET /?<query> (已存在)
        → PomodoroEntity[]
          → pomodoroEntitiesToViewObjects (usecase converters, 已存在)
            → PomodoroStore.setPomodoros() (已存在)
```

## Current State Analysis

### 已具备（可直接复用）

* **domain**：`PomodoroDomain.list(listVO)` 已实现（[services/pomodoro.ts](file:///home/nathan/Projects/nao-todo/packages/domain/pomodoro/services/pomodoro.ts#L26-L34)）；`ListPomodoroValueObject`（[list-pomodoro.ts](file:///home/nathan/Projects/nao-todo/packages/domain/pomodoro/valueobjects/list-pomodoro.ts)）已导出。

* **infrastructure**：`PomodoroRepoImpl.list(queryString)` 已实现（[pomodoro-repo-impl.ts](file:///home/nathan/Projects/nao-todo/packages/infrastructure/backend/pomodoro/pomodoro-repo-impl.ts#L120-L137)，成功码 `70090`）。

* **usecase converters**：`pomodoroEntitiesToViewObjects` 已存在（[converters.ts](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/converters.ts#L37-L41)）。

* **store**：`PomodoroStore.setPomodoros` 接口已定义（[store.ts](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/store.ts#L7-L19)）；Pinia `PomodorosStore` 已实现 `setPomodoros`/`pomodoros`/`getPomodoro`/`getAllPomodoros`（[pomodoros-store.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/pomodoros-store.ts) + [base/pomodoro.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/stores/base/pomodoro.ts)）。

* **上下文**：`POMODORO_VIEW_CONTEXT_KEY` 已注入 `pomodoroUseCase`（[context.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/views/index/pomodoro/context.ts#L10) + [pomodoro-view.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/views/index/pomodoro/pomodoro-view.ts)）。

* **视图对象**：`PomodoroViewObject`（含 `type/name/description/duration/archivedAt/totalDuration/isArchived`）已定义（[viewobjects.ts](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/viewobjects.ts#L42-L51)）。

### 缺口（需新增）

1. **`PomodoroUseCase`** **缺** **`loadPomodoros`** **查询方法**（[pomodoro.ts](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/pomodoro.ts) 仅有 `create`）。
2. **路由缺** **`pomodoros`** **子路由**（[routes.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/views/index/pomodoro/routes.ts)）。
3. **缺常用专注页面 Layout 组件**（参考 [layouts/pomodoro/index.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/index.vue) 的头部 + 双区域结构）。
4. **头部 tabs 缺「常用专注」入口链接**。

### 约定

* `PomodoroType`：`1=番茄专注`, `2=正计时`（[viewobjects.ts](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/viewobjects.ts#L7)）。

* Layout 组件页面结构、CSS 命名、`inject(POMODORO_VIEW_CONTEXT_KEY)` 用法、composable 拆分（`use-xxx.ts`）均需严格对齐现有 `layouts/pomodoro/` 风格。

* `duration` 单位为秒，展示需换算（参考 [records/row.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/components/pomodoro/records/row.vue) 的 `durationToString`）。

## Proposed Changes

### 1. usecase 层：补齐查询执行链

**文件**：[packages/usecases/pomodoro/pomodoro.ts](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/pomodoro.ts)

新增 `loadPomodoros` 方法（参考 `ProjectUseCase.loadProjects` / `PomodoroRecordUseCase.getRecords` 风格）：

```ts
/**
 * 加载常用番茄专注列表
 * @param options 查询选项
 * @returns 错误信息
 */
async loadPomodoros(options?: {
    type?: PomodoroType
    name?: string
    isArchived?: boolean
}): GoAsync<void> {
    // 1. 构建查询值对象
    const listValueObject = new ListPomodoroValueObject()
    if (options?.type !== void 0) listValueObject.type = options.type
    if (options?.name !== void 0) listValueObject.name = options.name
    if (options?.isArchived !== void 0) {
        listValueObject.isArchived = String(options.isArchived)
    }
    // 2. 调用领域服务
    const [result, err] = await this.pomodoroDomain.list(listValueObject)
    if (err !== null) return err
    // 3. 实体 → 视图对象
    const viewObjects = pomodoroEntitiesToViewObjects(result.pomodoroEntities)
    // 4. 存储到状态管理
    this.store.setPomodoros(viewObjects)
    // 5. 返回
    return null
}
```

* **补充导入**：`ListPomodoroValueObject`（from `@nao-todo/domain/pomodoro`）、`pomodoroEntitiesToViewObjects`（from `./converters`）、`PomodoroType`（from `./viewobjects`）。

* **why**：这是「页面查询方法使用 PomodoroUseCase 中的执行链，返回数据存入 PomodoroStore」的落地。方法走 `pomodoroDomain.list`（domain 已实现，非直接 repo），保持与 `ProjectUseCase` 一致的最短用例链。

* **返回** **`GoAsync<void>`**：数据落 store，页面从 store 读取（对齐 `ProjectUseCase.loadProjects`）。

### 2. 路由：新增 pomodoros 子路由

**文件**：[apps/web/src/views/index/pomodoro/routes.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/views/index/pomodoro/routes.ts)

在 `children` 中新增（放在 `:type(timer|focus)` 之前，避免路径歧义）：

```ts
{
    path: 'pomodoros',
    name: 'pomodoro-collection',
    component: () => import('@/layouts/pomodoro/collection/index.vue')
},
```

* **why**：独立 Layout 组件由 routes.ts 引用，与 timer/focus 并列。

* 注意：现有 `:type(timer|focus)/:taskId?` 用了正则约束，`pomodoros` 不匹配该正则，两者不冲突；但为清晰仍将静态路径置前。

### 3. 新增 Layout 组件：常用专注页面

**目录**：`apps/web/src/layouts/pomodoro/collection/`（对齐现有 `layouts/pomodoro/` 组织方式：`index.vue` + `use-*.ts`）

#### 3a. `use-pomodoro-collection.ts`（composable）

参考 [use-pomodoro-page.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/use-pomodoro-page.ts) 与 `use-project-creator.ts` 风格：

* `inject(POMODORO_VIEW_CONTEXT_KEY)!` 取 `pomodoroUseCase`。

* `usePomodorosStore()` 取 `pomodoros`（列表数据源）。

* 状态：`loading`（ref）、`selectedId`（ref\<string | null>）。

* `computed pomodoros`（从 store）、`computed selectedPomodoro`（按 `selectedId` 从 store `getPomodoro`）。

* `loadData()`：`loading=true` → `await pomodoroUseCase.loadPomodoros()` → 错误 `console.warn(unwrapError(error))`（对齐现有错误处理）→ 若无选中且列表非空则默认选中第一项 → `finally loading=false`。

* `handleSelect(id)`：设置 `selectedId`。

* `onMounted(loadData)`。

* 返回上述状态与方法。

#### 3b. `index.vue`（页面，两个区域）

参考 [layouts/pomodoro/index.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/index.vue) 的 `nue-container#Pomodoro` + `nue-header`（title-wrapper / tabs / actions）+ `nue-main > nue-content` grid 结构：

* **头部**：复用同样的 `nue-header`（含浮动侧栏按钮 + 标题「番茄专注」+ tabs）。tabs 中新增「常用专注」链接（见第 4 项）。

* **`nue-content`** **双区域 grid**：`grid-template-areas: 'list detail'`（列表左、详情右；窄屏堆叠）。

  * **列表区域**（`grid-area: list`）：

    * 标题「常用专注」+ 计数。

    * 空态：`loading===false && pomodoros.length===0` 显示「暂无常用专注」（参考 records.vue 空态）。

    * 列表：`v-for` 渲染每个 `PomodoroViewObject` 为可点击卡片（`nue-div theme="card,..."`，参考 [records/row.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/components/pomodoro/records/row.vue)），显示 `name`、类型标签（`type===1?'番茄专注':'正计时'`）、`duration` 换算后的时长；点击 `handleSelect(item.id)`，选中项高亮（`data-selected`）。

  * **详细区域**（`grid-area: detail`）：

    * 有选中项时展示 `selectedPomodoro` 的完整字段：名称、类型、描述、单次专注时长（`duration` 秒→分钟/时分秒）、累计专注时长（`totalDuration`）、是否归档（`isArchived`）、创建时间（`dayjs(createdAt)`）。

    * 无选中项时占位提示「请选择一个常用专注查看详情」。

* **本地时长格式化**：在组件内实现 `durationToString`（对齐 records.vue 的实现，秒→「x 时 x 分 x 秒」），不新增公共工具（避免过度设计）。

* **样式**：`<style scoped>`，命名沿用 `nue-div--xxx` BEM 风格；grid 布局 + `@media (max-width: 720px)` 堆叠，对齐现有页面。

### 4. 头部 tabs 新增「常用专注」入口

**位置**：新页面 `collection/index.vue` 的头部 tabs 区。为保持三个页面头部一致，同时在 [layouts/pomodoro/index.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/index.vue#L66-L69) 的 tabs 区补充同一条链接。

```html
<nue-div theme="tabs">
    <nue-link icon="ntd-fanqie" route="/pomodoro/timer">番茄专注</nue-link>
    <nue-link icon="ntd-zzt" route="/pomodoro/focus">正计时</nue-link>
    <nue-link icon="list" route="/pomodoro/pomodoros">常用专注</nue-link>
</nue-div>
```

* **图标**：使用现有图标 `list`（已在 [operation-dropdown.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/tasks/project/header/operation-dropdown.vue#L67) 中使用，确认可用）。

* **why**：用户选择「头部 tabs 链接」作为唯一导航入口。两处 tabs 保持一致，切换页面时高亮正确（`nue-link` 按 route 自动激活）。

## Assumptions & Decisions

1. **查询无分页/筛选参数**：本页一次性加载用户全部常用专注（`loadPomodoros()` 不传参），`setPomodoros` 全量替换。理由：需求为「罗列用户所创建的常用专注」，未要求分页/筛选；`useMapperStoreBase.setList` 天然支持全量替换。若后端强制分页，执行时按 `pagination` 现状仅取首屏（不额外扩展）。
2. **走** **`pomodoroDomain.list`** **而非直接 repo**：domain 已实现 `list`，用例调用 domain，符合分层与 `ProjectUseCase` 惯例。
3. **列表/详情为「主从（master-detail）」交互**：列表区点击项 → 右侧详情区展示，满足「两个区域：列表 + 详细」的硬性要求。默认选中第一项。
4. **不新增删除/归档/编辑操作**：需求仅为「查看页面 + 显示数据」，不实现增删改（避免超范围）。
5. **不复用 records 组件**：records 组件面向「专注记录」，字段不同；本页新建独立组件更清晰。
6. **头部标题**：沿用「番茄专注」大标题（与现有 index.vue 一致），tabs 区区分三个子页面。
7. **`isArchived`** **查询**：`ListPomodoroValueObject.isArchived` 为 `string | null`，`loadPomodoros` 中用 `String(boolean)` 转换（对齐 VO 定义），当前调用不传该参数。

## Verification

1. **类型检查**：`npx vue-tsc --noEmit -p apps/web/tsconfig.json` 退出码 0，无 TS 报错（重点：`loadPomodoros` 签名、`ListPomodoroValueObject` 导入、组件对 `PomodoroViewObject` 字段引用）。
2. **运行时手测**：

   * 进入 `/pomodoro/timer`，头部 tabs 出现「常用专注」，点击跳转 `/pomodoro/pomodoros`。

   * 页面加载时触发 `GET /?<query>`（成功码 `70090`），列表区罗列常用专注；`usePomodorosStore().pomodoros` 有数据。

   * 列表默认选中第一项，右侧详情区显示其名称/类型/时长/累计时长/创建时间等。

   * 点击其它列表项 → 详情区同步更新、选中项高亮。

   * 无数据时列表区显示空态、详情区显示占位提示。

   * 窄屏（<720px）下列表/详情堆叠展示。
3. **回归**：timer/focus 页面、创建对话框不受影响（未改动其逻辑，仅在 tabs 增加一条链接）。

## 执行顺序（建议）

1. usecase：`pomodoro.ts` 新增 `loadPomodoros`。
2. Layout 组件：`collection/use-pomodoro-collection.ts` → `collection/index.vue`。
3. 路由：`routes.ts` 注册 `pomodoros`。
4. 头部入口：两处 tabs 增加「常用专注」链接。
5. `vue-tsc` 类型检查 + 手测。

