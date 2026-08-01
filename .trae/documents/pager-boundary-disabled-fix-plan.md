# Pager 分页边界与按钮禁用状态修复计划

## Summary

修复共享分页组件 [Pager](file:///home/nathan/Projects/nao-todo/packages/components/pager/pager.vue) 的分页边界问题与按钮禁用状态问题：

1. 上/下一页按钮禁用判断使用严格相等（`===`），当 `page` 超出 `totalPages`（如缩小每页条数后页码残留）时不能正确禁用。
2. 空数据（`totalPages === 0`）时「下一页」按钮不被禁用（`1 === 0` 为 false），视觉上可点却无实际页。
3. 每页条数 `perPage` 为一次性初始化的本地 `ref`，父组件 `limit` 变化时不同步。

同时在 [use-pomodoro-collection.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/collection/use-pomodoro-collection.ts) 中修正记录分页的边界（`totalPages` 归一化到至少 1，避免空数据下的越界显示）。

## Current State Analysis

### Pager 组件（[pager.vue](file:///home/nathan/Projects/nao-todo/packages/components/pager/pager.vue)）

```ts
const perPage = ref<number>(props.limit || 20) // ① 仅初始化一次，不随 props.limit 更新
const prevButtonDisabled = computed(() => props.page === 1) // ② 严格相等
const nextButtonDisabled = computed(() => props.page === props.totalPages) // ③ 严格相等 + 空数据漏判
```

- `handleNextPage` / `handlePrevPage` / `handleGoToPage` 内部已有 `if (disabled) return` 与范围校验（`page < 1 || page > totalPages`），因此**误触发 emit 已被拦截**，属于功能安全；但**按钮的 disabled 视觉状态**不准确（③ 空数据时 next 仍可点、页码越界时不禁用）。
- `props.total` 定义但未使用（非本次重点，不动）。

### 调用方

- [collection/index.vue L140-149](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/collection/index.vue#L140-L149)：`:page="recordPage"` `:total-pages="recordTotalPages"` `:limit="recordLimit"` `:disabled="recordLoading"` `simple`。
- [table-view-adapter.vue L87-94](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/app/view-adapters/table-view-adapter/table-view-adapter.vue#L87-L94)：`:total-pages="...maxPage"`。
- 两处均把 `totalPages` 绑定到后端返回的 `maxPage`。

### 记录分页 composable（[use-pomodoro-collection.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/collection/use-pomodoro-collection.ts)）

- `recordTotalPages` 初始 `1`；`loadRecords` 中 `if (res.pagination) recordTotalPages.value = res.pagination.maxPage`。若后端空数据返回 `maxPage: 0`，则 `totalPages=0`，触发 Pager 的 ③ 问题。

## Proposed Changes

### 1. 修复 [pager.vue](file:///home/nathan/Projects/nao-todo/packages/components/pager/pager.vue) 按钮禁用与每页同步

- **禁用判断改为范围比较**（覆盖越界与空数据）：
    ```ts
    // 归一化总页数：至少为 1，避免 0 / 负数导致的判断异常
    const normalizedTotalPages = computed(() => Math.max(props.totalPages || 0, 1))
    const prevButtonDisabled = computed(() => props.page <= 1)
    const nextButtonDisabled = computed(() => props.page >= normalizedTotalPages.value)
    ```
- **跳转/翻页范围以 `normalizedTotalPages` 为界**：
    ```ts
    const handleNextPage = () => {
        if (props.disabled) return
        if (props.page < normalizedTotalPages.value) handleGoToPage(props.page + 1)
    }
    const handleGoToPage = (page: number) => {
        if (props.disabled) return
        if (page < 1 || page > normalizedTotalPages.value) return
        emit('pageChange', page)
    }
    ```
    （`handlePrevPage` 逻辑不变：`page > 1` 时才跳转。）
- **模板中「末页」按钮跳转与页码显示改用 `normalizedTotalPages`**：
    - `@click="handleGoToPage(normalizedTotalPages)"`
    - 非 simple 文案：`第 {{ page }} 页，共 {{ normalizedTotalPages }} 页`
    - simple 文案：`{{ page }}/{{ normalizedTotalPages }} 页`
- **`perPage` 与 `props.limit` 同步**：
    ```ts
    import { watch } from 'vue'
    watch(
        () => props.limit,
        (v) => {
            if (typeof v === 'number' && v !== perPage.value) perPage.value = v
        }
    )
    ```
    保持 `v-model="perPage"` 在父组件外部改变 `limit` 时也能反映到下拉框。

**why**：将禁用状态与真实可跳转范围对齐，修复空数据/越界时按钮状态错误；`limit` 双向一致，避免显示与实际每页条数不符。

### 2. 修复 [use-pomodoro-collection.ts](file:///home/nathan/Projects/nao-todo/apps/web/src/layouts/pomodoro/collection/use-pomodoro-collection.ts) 记录分页边界

- **`totalPages` 归一化**（至少 1）并**页码收敛**（防止翻到尾页后缩小数据导致越界）：
    ```ts
    if (res.pagination) {
        recordTotal.value = res.pagination.total
        recordTotalPages.value = Math.max(res.pagination.maxPage || 0, 1)
        // 若当前页超出范围，回退到末页并重载
        if (recordPage.value > recordTotalPages.value) {
            recordPage.value = recordTotalPages.value
        }
    }
    ```
    说明：仅做状态归一化；此处不递归重载（避免额外请求），页码收敛后下次翻页/切换即正确。实际当前流程中切换选中项与改每页条数均已 `recordPage=1`，越界主要来自后端 `maxPage` 波动，归一化足以覆盖。

**why**：保证传给 Pager 的 `totalPages ≥ 1` 且 `page` 不越界，与组件层修复形成双保险。

## Assumptions & Decisions

1. **修复放在共享 Pager 组件层为主**：两处调用方都受益，符合「组件按钮禁用状态问题」的表述；调用方（composable）仅做数据归一化。
2. **归一化 `totalPages` 到最小 1**：空数据时显示「1/1 页」且上下页均禁用，语义清晰；不引入「0 页」这种边界态。
3. **不改动 `PagerProps`/`PagerEmits` 类型**：现有 props 足够，`total` 保持现状不启用。
4. **不新增每页条数选项或额外交互**：仅修复既有缺陷，不扩展功能。
5. **table-view-adapter 无需改动**：其 `maxPage` 通常 ≥ 1，修复对其向后兼容（`>=`/`<=` 与 `===` 在正常范围内行为一致）。

## Verification

1. **类型检查**：`npx vue-tsc --noEmit -p apps/web/tsconfig.json` 退出码 0。
2. **运行时手测（常用专注页记录分页）**：
    - 选中**无记录**的常用专注：显示「暂无专注记录」，Pager 显示 `1/1 页`，上一页/下一页按钮**均禁用**。
    - 选中**多页记录**的常用专注：第 1 页时上一页禁用、下一页可用；末页时下一页禁用、上一页可用。
    - 在末页把「每页条数」调大使总页数变小：页码收敛、按钮禁用状态正确，无越界空页。
    - `recordLoading` 期间：所有按钮与每页下拉均禁用。
3. **回归**：任务表格视图（table-view-adapter）分页行为正常，无异常禁用。

## 执行顺序

1. 修复 `packages/components/pager/pager.vue`（禁用判断 + 归一化 + limit 同步）。
2. 修复 `apps/web/src/layouts/pomodoro/collection/use-pomodoro-collection.ts`（totalPages 归一化 + 页码收敛）。
3. `vue-tsc` 类型检查 + 手测。