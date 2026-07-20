# 常用专注页面 - 专注记录分页展示实现计划

## Summary

在「常用专注」页面（[collection/index.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/collection/index.vue)）的**详细区域**中，当选中某条常用专注时，除展示基本信息外，额外向后端查询该 `pomodoroId` 关联的所有专注记录（`PomodoroRecord`），并使用 [Pager](file:///home/nathan/Projects/nao-todo/packages/components/pager/pager.vue) 组件做**显式分页展示**（上一页/下一页/每页条数）。

数据链路（全部已存在，直接复用）：

```
handleSelect(id) → loadRecords(pomodoroId, page, limit)
  → PomodoroRecordUseCase.getRecords({ pomodoroId, page, limit, sort })
    → PomodoroDomain.listRecord(options)
      → QueryOptionsValueObject.toString()
        → PomodoroRecordRepoImpl.list(queryString) → GET /pomodoro-records/?<query>（含 pomodoroId）
          → PomodoroRecordEntity[] + pagination
            → pomodoroRecordEntitiesToViewObjects → 本地记录 store（composable 内）
```

## Current State Analysis

### 已具备（直接复用，无需改动）

* **查询选项已含 pomodoroId**：`GetPomodoroRecordsOptions.pomodoroId?: string | null`（[viewobjects.ts L68-L79](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/viewobjects.ts#L68-L79)）。

* **usecase 查询方法**：`PomodoroRecordUseCase.getRecords(options)` 返回 `{ recordIds, pagination }`，内部调用 `domain.listRecord` 并把视图对象写入注入的 store（[pomodoro-record.ts L63-L76](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/pomodoro-record.ts#L63-L76)）。

* **domain / repo**：`PomodoroDomain.listRecord` → `PomodoroRecordRepoImpl.list`（`GET /pomodoro-records/?<query>`，成功码 `70030`，返回 `pagination`）（[services/pomodoro.ts L56-L63](file:///home/nathan/Projects/nao-todo/packages/domain/pomodoro/services/pomodoro.ts#L56-L63)、[pomodoro-record-repo-impl.ts L79-L99](file:///home/nathan/Projects/nao-todo/packages/infrastructure/backend/pomodoro/pomodoro-record-repo-impl.ts#L79-L99)）。

* **usecase 工厂**：`newPomodoroRecordUseCase(store)`，`store` 仅需 `{ addRecord, addRecords }`（[pomodoro-record.ts L84-L90](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/pomodoro-record.ts#L84-L90)、[store.ts](file:///home/nathan/Projects/nao-todo/packages/usecases/pomodoro/store.ts)）。

* **Pager 组件**：`@nao-todo/components` 导出 `Pager`，props `{ page, total?, limit?, totalPages, simple?, disabled? }`，emits `pageChange(number)` / `perPageChange(number)`（[pager.vue](file:///home/nathan/Projects/nao-todo/packages/components/pager/pager.vue)、[types.ts](file:///home/nathan/Projects/nao-todo/packages/components/pager/types.ts)）。已在 [table-view-adapter.vue L87-L94](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/app/view-adapters/table-view-adapter/table-view-adapter.vue#L87-L94) 中作为分页器示范使用。

* **记录行组件**：`PomodoroRecordsCompRow`（[components/pomodoro/records/row.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/components/pomodoro/records/row.vue)），入参 `{ record: PomodoroRecordViewObject }`，可复用于单条记录渲染。

### 缺口（需新增）

1. **常用专注页 composable 未加载记录**：[use-pomodoro-collection.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/collection/use-pomodoro-collection.ts) 仅加载 pomodoro 列表，无记录查询与分页状态。
2. **详细区域无记录展示 + 分页器**：[collection/index.vue](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/collection/index.vue) 详情卡片只展示基本字段。

### 关键约定

* **不复用今日记录的** **`usePomodoroRecordLoader`**：该 loader 面向 `nue-infinite-scroll` 无限滚动（追加式），而本需求为**显式分页器（每页替换式）**。故在 composable 内自管分页状态（page/limit/total/maxPage）。

* **记录默认排序**：`sort: 'startAt:desc'`（与今日记录一致）。

* **每页默认 20 条**（Pager 默认 limit）。

## Proposed Changes

### 1. 改造 `apps/web/src/layouts/pomodoro/collection/use-pomodoro-collection.ts`

在现有基础上新增「专注记录」加载与分页逻辑：

* **新增导入**：

  * `watch`（vue）。

  * `newPomodoroRecordUseCase`、`PomodoroRecordViewObject`（`@nao-todo/usecases/pomodoro`）。

* **本地记录 store（composable 内闭包）**：

  ```ts
  const recordsMap = ref(new Map<string, PomodoroRecordViewObject>())
  const recordUseCase = newPomodoroRecordUseCase({
      addRecord: (r) => { recordsMap.value.set(r.id, r) },
      addRecords: (rs) => { rs.forEach((r) => recordsMap.value.set(r.id, r)) }
  })
  ```

  说明：`getRecords` 会把当前页视图对象写入该 map，并返回 `recordIds`；页面按 `recordIds` 映射展示。

* **分页与状态**：

  ```ts
  const recordLoading = ref(false)
  const recordPage = ref(1)
  const recordLimit = ref(20)
  const recordTotalPages = ref(1)
  const recordTotal = ref(0)
  const currentRecordIds = ref<string[]>([])
  const records = computed(() =>
      currentRecordIds.value
          .map((id) => recordsMap.value.get(id))
          .filter((r): r is PomodoroRecordViewObject => Boolean(r))
  )
  ```

* **加载方法**（每页替换）：

  ```ts
  const loadRecords = async () => {
      if (!selectedId.value) return
      recordLoading.value = true
      try {
          const [res, err] = await recordUseCase.getRecords({
              pomodoroId: selectedId.value,
              page: recordPage.value,
              limit: recordLimit.value,
              sort: 'startAt:desc'
          })
          if (err !== null) { console.warn(unwrapError(err)); return }
          currentRecordIds.value = res.recordIds
          if (res.pagination) {
              recordTotal.value = res.pagination.total
              recordTotalPages.value = res.pagination.maxPage
          }
      } finally {
          recordLoading.value = false
      }
  }
  ```

* **分页事件处理**：

  ```ts
  const handleRecordPageChange = (page: number) => {
      recordPage.value = page
      loadRecords()
  }
  const handleRecordPerPageChange = (limit: number) => {
      recordLimit.value = limit
      recordPage.value = 1
      loadRecords()
  }
  ```

* **选中项变化时重新加载**（`handleSelect` 保持不变，新增 watch）：

  ```ts
  watch(selectedId, (id) => {
      if (!id) return
      recordPage.value = 1
      currentRecordIds.value = []
      loadRecords()
  })
  ```

  说明：`loadData` 中默认选中第一项会触发该 watch，自动加载首个 pomodoro 的记录。为覆盖「onMounted 默认选中」场景，watch 使用 `{ immediate: false }`（默认选中通过赋值触发 watch）。

* **return 追加**：`records`、`recordLoading`、`recordPage`、`recordLimit`、`recordTotal`、`recordTotalPages`、`handleRecordPageChange`、`handleRecordPerPageChange`。

**why**：记录查询走已存在的 `PomodoroRecordUseCase` 执行链，仅在页面 composable 层管理显式分页状态，符合「点击展示详情时按 pomodoroId 查询并分页」的需求。

### 2. 改造 `apps/web/src/layouts/pomodoro/collection/index.vue`

* **`<script setup>`**：

  * 从 `usePomodoroCollection()` 解构新增返回值。

  * 引入 `import { Pager } from '@nao-todo/components'`。

  * 引入 `import PomodoroRecordsCompRow from '@/components/pomodoro/records/row.vue'` 复用记录行。

* **详细区域模板**：在现有基本信息卡片（`detail-card`）下方、`v-if="selectedPomodoro"` 分支内新增「专注记录」区块：

  * 小标题「专注记录」+ 总数 `共 {{ recordTotal }} 条`。

  * 列表：

    * `recordLoading` 时显示「加载中...」。

    * `!recordLoading && records.length === 0` 显示空态「暂无专注记录」。

    * 否则 `v-for` 渲染 `PomodoroRecordsCompRow`（`:record="record"`）。

  * 底部分页器：

    ```html
    <pager
        :page="recordPage"
        :limit="recordLimit"
        :total="recordTotal"
        :total-pages="recordTotalPages"
        :disabled="recordLoading"
        simple
        @page-change="handleRecordPageChange"
        @per-page-change="handleRecordPerPageChange"
    />
    ```

    （`simple` 模式更适合详情窄栏；如空间足够可去掉 `simple`。默认采用 `simple`。）

* **`<style scoped>`**：为记录区块新增样式（标题、列表滚动、分页器对齐），沿用现有 `nue-div--xxx` BEM 风格与 `--nue-*` 变量；记录列表设 `overflow-y: auto`，与详情卡片共处纵向布局。

**why**：满足「详情除基本信息外，展示该常用专注的分页专注记录」，复用现成记录行组件与 Pager 保持 UI 一致。

## Assumptions & Decisions

1. **按 pomodoroId 精确查询**：`getRecords({ pomodoroId: selectedId })`，后端已支持该过滤（用户确认）。不额外传 `type`/时间范围。
2. **显式分页器（每页替换）**：采用用户指定的 [Pager](file:///home/nathan/Projects/nao-todo/packages/components/pager/pager.vue) 组件；每次翻页/改每页条数**替换**当前页记录（非追加），符合分页器语义。
3. **记录 store 局部化**：在 composable 内用局部 `Map` 承接 usecase 写入，不复用全局 `PomodoroStore`（那是今日记录/会话专用），避免相互污染。
4. **默认排序** **`startAt:desc`、默认每页 20 条**：与今日记录体验一致。
5. **切换选中项即重置到第 1 页并重新查询**；无选中项时不展示记录区块。
6. **不改动后端、路由、domain/repo/usecase 底层**：链路已完备，仅在 web 页面层接入。
7. **Pager 使用** **`simple`** **模式**：详情栏宽度有限，简洁分页更合适（可后续调整）。

## Verification

1. **类型检查**：`npx vue-tsc --noEmit -p apps/web/tsconfig.json` 退出码 0（重点：`getRecords` 选项类型、Pager props/emits、记录 `Map` 类型收窄）。
2. **运行时手测**：

   * 进入 `/pomodoro/pomodoros`，默认选中第一条常用专注 → 详情区展示基本信息 + 下方「专注记录」列表首页（若有数据），显示总数。

   * 点击其它常用专注 → 记录区重置到第 1 页并重新按该 `pomodoroId` 查询。

   * 点击分页器「下一页/上一页」→ 记录列表替换为对应页；`page`/`totalPages` 显示正确；请求 `GET /pomodoro-records/?...&pomodoroId=...&page=...&limit=...`。

   * 修改「每页条数」→ 回到第 1 页并按新 limit 查询。

   * 无记录的常用专注 → 显示空态「暂无专注记录」，分页器 `totalPages=1` 且按钮禁用。
3. **回归**：常用专注列表加载、详情基本信息、timer/focus 页今日记录不受影响。

## 执行顺序

1. 改造 `use-pomodoro-collection.ts`（记录加载 + 分页状态 + watch）。
2. 改造 `collection/index.vue`（记录区块 + Pager + 样式）。
3. `vue-tsc` 类型检查 + 手测。

