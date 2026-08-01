# Spec: 领域层行为收敛 + 纯化(Task 域,A2 范围)

> 目标:让 `packages/domain-task` 成为**零框架依赖的纯领域**,并把散落的业务规则收回领域层。
> 范围:`packages/domain-task` + 受影响的 `packages/presentation/task` 消费点 + `packages/shared/locales`。
> 前置:你已手动移除 `domain/constants.ts` 的 `computed`,该改动**引入了 8 处编译错误与 1 处响应式回归**,本 spec 一并修复。

---

## 1. 现状盘点(已逐条核实)

### 1.1 你的改动引入的破坏(必须修,最高优先级)

`domain/constants.ts` 中 `TaskStateSelectOptions` / `TaskPrioritySelectOptions` / `columnLabels` / `sortFieldLabels` 由 `computed(...)` 改为普通函数 `() => ...`,但**全部消费方仍在用 `.value`**:

| 文件                                                                  | 行号                                     | 现状写法                                            | 问题                  |
| --------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------- | --------------------- |
| `packages/presentation/task/components/table/column-defaults.ts`      | 37,46,55,64,73,82,91,100,109,118,127,136 | `columnLabels.value.xxx`                            | 编译错                |
| `packages/presentation/task/components/dropdowns/sort-operator.vue`   | 25,28                                    | `sortFieldLabels.value` / `columnLabels.value[...]` | 编译错                |
| `packages/presentation/task/components/dropdowns/state-filter.vue`    | 13                                       | `TaskStateSelectOptions.value.map`                  | 编译错                |
| `packages/presentation/task/components/dropdowns/priority-filter.vue` | 14                                       | `TaskPrioritySelectOptions.value.map`               | 编译错                |
| `apps/web/src/views/index/tasks/tasks-view.ts`                        | 93                                       | `columnLabels.value as Record<...>`                 | 编译错                |
| `packages/presentation/task/components/task-details/main/index.vue`   | 77,82                                    | `:options="TaskStateSelectOptions"`                 | 传函数给模板,行为变化 |
| `packages/presentation/task/components/dialogs/creator/creator.vue`   | 105,110                                  | 同上                                                | 行为变化              |

**额外的响应式回归**:`DEFAULT_TABLE_COLUMNS`(`column-defaults.ts#L34`)是**模块级常量**,`columnLabels()` 只在模块加载时求值一次。原 `computed` 会随 locale 变化重算,改为普通函数后**切换语言表头不再更新**。

### 1.2 纯度问题:UI 表现物混在 domain 层

`domain/constants.ts` 里这 4 个导出**本质是 UI 表现**,不是领域概念:

- `TaskStateSelectOptions` / `TaskPrioritySelectOptions`:带 `label` + `icon`,是下拉选项 VO
- `columnLabels` / `sortFieldLabels`:表格列的 i18n 显示名

它们依赖 `t()`,而 `t()` 来自 `packages/shared/locales/i18n.ts`,底层是 `createI18n` from **`vue-i18n`** → 依赖 `vue`。**这是 domain 层残留的框架依赖链**。

而真正的领域概念 `stateSNMap` / `prioritySNMap` / `stateSNMapReverse` / `prioritySNMapReverse`(排序序列号映射)不依赖 `t()`,应留在 domain。

### 1.3 业务规则归属问题

| #   | 问题                                              | 证据                                                                                                                             |
| --- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| P1  | `TaskEntity` 贫血,仅 3 个只读 getter              | `domain/entities/task.ts` 全文 60 行                                                                                             |
| P2  | snooze 的 1–1440 规则硬编码在 UseCase             | `application/usecases/task.ts#L186`                                                                                              |
| P3  | `isGivenUp` 在 UseCase 里二次计算                 | `application/usecases/task.ts#L152-L155`                                                                                         |
| P4  | 枚举兜底散在 Converter                            | `application/usecases/converters.ts#L40-L45`                                                                                     |
| P5  | 枚举白名单重复 4 处                               | Converter L40/L43、`create-task.ts#L52/L54`、`update-task.ts#L42/L44`、`constants.ts` 的 SNMap                                   |
| P9  | **VO 校验返回裸中文硬编码**                       | `create-task.ts#L49-L75` 共 12 条、`update-task.ts#L37-L79` 共 15 条                                                             |
| P10 | **同域子实体 VO 同样是裸中文**(执行期发现,已补齐) | `create-task-check-item.ts` 3 条、`update-task-check-item.ts` 2 条、`create-task-comment.ts` 3 条、`update-task-comment.ts` 2 条 |
| P11 | **应用层运行时错误裸中文**(执行期发现,已补齐)     | `task-check-item.ts#L130/L145/L229` 共 3 条「事件不存在」                                                                        |

### 1.4 现存 Bug(顺带修)

`packages/shared/entity.ts#L28` 的 `isDeleted` 是 **getter**:

```ts
get isDeleted(): boolean { ... }
```

但 `domain/entities/__tests__/task.test.ts#L99-L100` 当成**方法**调用:

```ts
expect(makeEntity({ deletedAt: null }).isDeleted()).toBe(false) // ← boolean() 会抛 TypeError
```

同时 `converters.ts#L55` 用 `dayjs(entity.deletedAt).isValid()` 重算,而基类已有该逻辑。

---

## 2. 目标(Goals)

1. **`packages/domain-task` 零框架依赖**:不含 `vue` / `pinia` / `vue-i18n`(含间接)。
2. **领域错误用错误码表达**:VO / Entity 校验返回稳定错误码,i18n 翻译在 presentation 层完成。
3. **业务规则单一来源**:枚举白名单、时长边界、派生规则各只有一处定义。
4. **修复 1.1 的全部编译错误与响应式回归**。
5. **修复 1.4 的 `isDeleted` getter/方法误用**。

## 3. 非目标(Non-Goals)

- ❌ 不给 Entity 加 mutation 方法(`giveUp()` / `archive()`)——你已确认,理由见 §9.3
- ❌ 不删 `TaskDomain`,仅补注释(你已确认按建议)
- ❌ 不动其他领域包(project / tag / pomodoro / identity / built-in-project)——留 A3
- ❌ 不改 `TaskRepository` 接口签名
- ❌ 不改 `TaskViewObject` 字段结构
- ❌ 不收紧 `state` / `priority` 的 `string` 类型(见 §9.2)
- ❌ 不改 `packages/shared/locales/i18n.ts` 的 `t()` 实现

---

## 4. 详细设计

### 4.1 领域错误码体系(核心)

**新增** `packages/domain-task/src/domain/errors.ts`:

```ts
/**
 * 任务领域错误码
 * @description 领域层只产出稳定错误码，不产出面向用户的文案。
 *              文案翻译由 presentation 层负责，保证领域层零框架依赖。
 */
export const TaskErrorCode = {
    // 名称
    NAME_EMPTY: 'TASK_NAME_EMPTY',
    NAME_TOO_LONG: 'TASK_NAME_TOO_LONG',
    // 描述
    DESC_TOO_LONG: 'TASK_DESC_TOO_LONG',
    // 枚举
    STATE_INVALID: 'TASK_STATE_INVALID',
    PRIORITY_INVALID: 'TASK_PRIORITY_INVALID',
    REMIND_REPEAT_INVALID: 'TASK_REMIND_REPEAT_INVALID',
    // 时间
    REMIND_TIME_FORMAT_INVALID: 'TASK_REMIND_TIME_FORMAT_INVALID',
    REMIND_AT_INVALID: 'TASK_REMIND_AT_INVALID',
    START_AT_INVALID: 'TASK_START_AT_INVALID',
    END_AT_INVALID: 'TASK_END_AT_INVALID',
    START_AFTER_END: 'TASK_START_AFTER_END',
    GIVEN_UP_AT_INVALID: 'TASK_GIVEN_UP_AT_INVALID',
    GIVEN_UP_BEFORE_START: 'TASK_GIVEN_UP_BEFORE_START',
    // snooze
    SNOOZE_DURATION_NOT_INTEGER: 'TASK_SNOOZE_DURATION_NOT_INTEGER',
    SNOOZE_DURATION_OUT_OF_RANGE: 'TASK_SNOOZE_DURATION_OUT_OF_RANGE'
} as const

export type TaskErrorCodeValue = (typeof TaskErrorCode)[keyof typeof TaskErrorCode]
```

**VO 校验改为返回错误码**,例:

```ts
// create-task.ts
validate(): Go<void> {
    if (!this.name) return TaskErrorCode.NAME_EMPTY
    if (this.name.length > TASK_NAME_MAX_LENGTH) return TaskErrorCode.NAME_TOO_LONG
    if (this.state && !TASK_STATES.includes(this.state as TaskState))
        return TaskErrorCode.STATE_INVALID
    // ...
}
```

> `Go<void>` 的错误分支本来就是 `string`,错误码是 `string` 字面量,**类型契约不变**,无需改 `Go` 定义。

### 4.2 presentation 层错误码 → i18n 映射

**新增** `packages/presentation/task/utils/error-message.ts`:

```ts
import { t, type LocaleKey } from '@nao-todo/shared'
import { TaskErrorCode, type TaskErrorCodeValue } from '@nao-todo/domain-task'

const CODE_TO_LOCALE_KEY: Record<TaskErrorCodeValue, LocaleKey> = {
    [TaskErrorCode.NAME_EMPTY]: 'task.error.nameEmpty',
    [TaskErrorCode.NAME_TOO_LONG]: 'task.error.nameTooLong'
    // ... 全部 15 条
}

/**
 * 把领域错误码翻译为用户可读文案
 * @param error 领域层返回的错误码或原始错误串
 */
export const translateTaskError = (error: string): string => {
    const key = CODE_TO_LOCALE_KEY[error as TaskErrorCodeValue]
    return key ? t(key) : error // 非领域码（如网络错误）原样透出
}
```

**`TaskHandler` 接入**:现有 `handlers/task.ts` 已在用 `unwrapError(...)` 拼消息,改为先过 `translateTaskError`。

### 4.3 locale 新增 key

`packages/shared/locales/types.ts` 的 `LocaleMessages` 现有 `'task.error.loadFailed'`(L330),在其后追加 15 条:

```ts
'task.error.nameEmpty': string
'task.error.nameTooLong': string
'task.error.descTooLong': string
'task.error.stateInvalid': string
'task.error.priorityInvalid': string
'task.error.remindRepeatInvalid': string
'task.error.remindTimeFormatInvalid': string
'task.error.remindAtInvalid': string
'task.error.startAtInvalid': string
'task.error.endAtInvalid': string
'task.error.startAfterEnd': string
'task.error.givenUpAtInvalid': string
'task.error.givenUpBeforeStart': string
'task.error.snoozeDurationNotInteger': string
'task.error.snoozeDurationOutOfRange': string
```

`zh-CN.ts` 用**与现在完全相同的中文文案**(保证用户可见行为不变):

```ts
'task.error.nameEmpty': '任务名称不能为空',
'task.error.nameTooLong': '任务名称最多128个字符',
'task.error.descTooLong': '任务描述最多256个字符',
'task.error.stateInvalid': '任务状态无效',
'task.error.priorityInvalid': '任务优先级无效',
'task.error.remindRepeatInvalid': '提醒重复类型无效',
'task.error.remindTimeFormatInvalid': '提醒时间格式无效（应为 HH:mm）',
'task.error.remindAtInvalid': '提醒时间无效',
'task.error.startAtInvalid': '任务开始时间无效',
'task.error.endAtInvalid': '任务结束时间无效',
'task.error.startAfterEnd': '任务开始时间不能晚于结束时间',
'task.error.givenUpAtInvalid': '放弃时间无效',
'task.error.givenUpBeforeStart': '放弃时间不能早于任务开始时间',
'task.error.snoozeDurationNotInteger': '延迟时间必须为整数分钟',
'task.error.snoozeDurationOutOfRange': '延迟时间需在 1-1440 分钟之间',
```

`en-US.ts` 补对应英文。

> 注意 `update-task.ts#L38` 的文案是「任务名称长度不能超过128个字符」,与 `create-task.ts#L50` 的「任务名称最多128个字符」**不一致**。本轮统一为后者,归到同一个 `nameTooLong` key。

### 4.4 UI 表现物从 domain 迁到 presentation(解决 1.1 + 1.2)

**从 `domain/constants.ts` 移除**(它们依赖 `t()`):

- `TaskStateSelectOptions`
- `TaskPrioritySelectOptions`
- `columnLabels`
- `sortFieldLabels`

**保留在 `domain/constants.ts`**(纯领域,无 `t()`):

- `stateSNMap` / `stateSNMapReverse`
- `prioritySNMap` / `prioritySNMapReverse`
- 新增的 `TASK_STATES` / `TASK_PRIORITIES` / `TASK_REMIND_REPEATS` 等白名单与边界常量

**新增** `packages/presentation/task/constants/labels.ts`,用 `computed` 恢复响应式:

```ts
import { computed } from 'vue'
import { t } from '@nao-todo/shared'
import { TASK_STATES, TASK_PRIORITIES } from '@nao-todo/domain-task'

/** 任务状态下拉选项（响应 locale 变化） */
export const TaskStateSelectOptions = computed(() => [
    { label: t('task.state.todo'), value: 'todo', icon: 'circle' },
    { label: t('task.state.inProgress'), value: 'in-progress', icon: 'in-progress' },
    { label: t('task.state.done'), value: 'done', icon: 'success' }
])

export const TaskPrioritySelectOptions = computed(() => [/* 同原实现 */])
export const columnLabels = computed(() => ({/* 同原实现 */}))
export const sortFieldLabels = computed(() => ({/* 同原实现 */}))
```

**消费方 import 路径切换**(`.value` 写法全部保持不变,因为又变回 `computed` 了):

| 文件                                                         | 改动                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------- |
| `presentation/task/components/table/column-defaults.ts`      | import 源改为 `../../constants/labels`;**并修响应式**(见下) |
| `presentation/task/components/dropdowns/sort-operator.vue`   | import 源切换                                               |
| `presentation/task/components/dropdowns/state-filter.vue`    | import 源切换                                               |
| `presentation/task/components/dropdowns/priority-filter.vue` | import 源切换                                               |
| `presentation/task/components/task-details/main/index.vue`   | import 源切换                                               |
| `presentation/task/components/dialogs/creator/creator.vue`   | import 源切换                                               |
| `apps/web/src/views/index/tasks/tasks-view.ts`               | import 源改为 `@nao-todo/presentation/task`                 |

**响应式修复**:`DEFAULT_TABLE_COLUMNS` 从模块级常量改为函数。

**T1 已探明的事实**:

- `DEFAULT_TABLE_COLUMNS` 只有 **1 处内部引用**:`column-defaults.ts#L146` 的 `createDefaultTableConfig()`,**未被外部 import**(barrel 未导出)。
- `column-storage.ts` 的 `SavedTableConfig` 只存 `widths` 与 `order`(`#L10-L13`),**不存 label**。反序列化不受 label 变化影响。
- `use-column-config.ts#L9` 只 import `PINNED_COLUMN_MAP` / `enforcePinnedColumn` / `createDefaultTableConfig`,不直接碰 `DEFAULT_TABLE_COLUMNS`。

**结论**:改函数是安全的,影响面仅 `column-defaults.ts` 内部两处。

```ts
// 原：export const DEFAULT_TABLE_COLUMNS: TableColumnConfig[] = [...]
// 改：
const getDefaultTableColumns = (): TableColumnConfig[] => [
    { key: 'name', label: columnLabels.value.name /* ... */ }
    // ...
]

export const createDefaultTableConfig = (tableId: string): TableLayoutConfig => ({
    columns: getDefaultTableColumns(), // 每次调用重新求值
    tableId,
    version: '1.0.0',
    updatedAt: new Date().toISOString()
})
```

> `DEFAULT_TABLE_COLUMNS` 可直接改为模块私有函数,无需保留原导出名。

**T1 额外发现的既存 bug(与本 spec 无关,但需记录)**:
`use-column-config.ts#L25-L36` 用 `[...layoutConfig.value.columns]` 做浅拷贝,随后 `col.width = savedWidth` **直接改了列对象**。由于原 `DEFAULT_TABLE_COLUMNS` 是模块级共享常量,多个表格实例(不同 `tableId`)会**互相污染列宽**。改为函数后每次返回新对象,此 bug **顺带被修复**。

### 4.5 枚举白名单常量化(解决 P4、P5)

`domain/constants.ts` 新增:

```ts
export const TASK_STATES = ['todo', 'in-progress', 'done'] as const
export type TaskState = (typeof TASK_STATES)[number]

export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export const TASK_REMIND_REPEATS = ['none', 'daily', 'weekly', 'monthly'] as const
export type TaskRemindRepeat = (typeof TASK_REMIND_REPEATS)[number]

export const DEFAULT_TASK_STATE: TaskState = 'todo'
export const DEFAULT_TASK_PRIORITY: TaskPriority = 'low'
export const DEFAULT_REMIND_REPEAT: TaskRemindRepeat = 'none'

export const TASK_NAME_MAX_LENGTH = 128
export const TASK_DESC_MAX_LENGTH = 256

export const SNOOZE_MIN_MINUTES = 1
export const SNOOZE_MAX_MINUTES = 1440
```

替换 `create-task.ts` / `update-task.ts` / `converters.ts` 中的全部字面量。

### 4.6 `TaskEntity` 增派生属性与静态校验(解决 P1、P2、P3)

```ts
/**
 * 判定是否已放弃（领域规则唯一来源）
 * @param givenUpAt 放弃时间
 */
export const isGivenUpBy = (givenUpAt: string | null | undefined): boolean =>
    dayjs(givenUpAt).isValid()

export class TaskEntity extends Entity {
    // ... 构造函数不变

    get isGivenUp(): boolean {
        return isGivenUpBy(this.givenUpAt) // 改为调用共享规则
    }

    get isArchived(): boolean {
        /* 不变 */
    }
    get isStarMarked(): boolean {
        /* 不变 */
    }

    /** 是否已完成 */
    get isDone(): boolean {
        return this.state === 'done'
    }

    /** 是否可稍后提醒：已删除 / 已归档 / 已放弃的任务不可 snooze */
    get canSnooze(): boolean {
        return !this.isDeleted && !this.isArchived && !this.isGivenUp
    }

    /** 校验 snooze 时长（静态领域规则） */
    static validateSnoozeDuration(durationMinutes: number): Go<void> {
        if (!Number.isInteger(durationMinutes)) return TaskErrorCode.SNOOZE_DURATION_NOT_INTEGER
        if (durationMinutes < SNOOZE_MIN_MINUTES || durationMinutes > SNOOZE_MAX_MINUTES)
            return TaskErrorCode.SNOOZE_DURATION_OUT_OF_RANGE
        return null
    }
}
```

> `canSnooze` 里用 `this.isDeleted`(getter,无括号)——这是 §1.4 bug 的正确用法。

### 4.7 UseCase 瘦身(解决 P2、P3)

```ts
async snooze(id, durationMinutes): GoAsync<void> {
    const invalid = TaskEntity.validateSnoozeDuration(durationMinutes)   // 委托领域
    if (invalid !== null) return invalid
    const [newRemindAt, err] = await this.taskRepo.snooze(id, durationMinutes)
    if (err !== null) return err
    this.taskStore.updateTask(id, { remindAt: newRemindAt })
    return null
}

async update(id, updateViewObject): GoAsync<void> {
    // ...
    const storeUpdateData = { ...updateViewObject }
    if (storeUpdateData.givenUpAt !== undefined) {
        storeUpdateData.isGivenUp = isGivenUpBy(storeUpdateData.givenUpAt)   // 用共享规则
    }
    this.taskStore.updateTask(id, storeUpdateData)
    return null
}
```

UseCase 中不再出现 `1440` 与 `dayjs(...).isValid()`。

### 4.8 Converter 去业务判断(解决 P4)+ 修 isDeleted

```ts
taskViewObject.state = TASK_STATES.includes(entity.state as TaskState)
    ? entity.state
    : DEFAULT_TASK_STATE
taskViewObject.priority = TASK_PRIORITIES.includes(entity.priority as TaskPriority)
    ? entity.priority
    : DEFAULT_TASK_PRIORITY
taskViewObject.isDeleted = entity.isDeleted // getter，去掉 dayjs 重算
taskViewObject.isArchived = entity.isArchived
taskViewObject.isGivenUp = entity.isGivenUp
```

### 4.9 修复 `isDeleted` 测试误用(解决 1.4)

`domain/entities/__tests__/task.test.ts#L99-L100`:

```ts
// 从
expect(makeEntity({ deletedAt: null }).isDeleted()).toBe(false)
// 改为
expect(makeEntity({ deletedAt: null }).isDeleted).toBe(false)
```

### 4.10 `TaskDomain` 补注释(P6，不改行为)

```ts
/**
 * 任务领域服务
 * @description 当前仅承载「查询选项 → 仓储查询串」的转换。
 *              跨实体的业务规则（如父子任务状态联动）后续在此扩展。
 * @todo 若长期无跨实体规则，考虑与 TaskRepository 合并（见本 spec §9.1）
 */
```

---

## 5. 涉及文件清单

### 5.1 `packages/domain-task`

| 文件                                         | 改动                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `src/domain/errors.ts`                       | **新建**:错误码常量                                                                               |
| `src/domain/constants.ts`                    | 移除 4 个依赖 `t()` 的 UI 导出;新增白名单/边界/默认值常量;**移除 `t` import**                     |
| `src/domain/entities/task.ts`                | 新增 `isGivenUpBy` 导出、`isDone`、`canSnooze`、`validateSnoozeDuration`;`isGivenUp` 改用共享函数 |
| `src/domain/valueobjects/create-task.ts`     | 12 条文案改错误码;白名单改常量                                                                    |
| `src/domain/valueobjects/update-task.ts`     | 15 条文案改错误码;白名单改常量                                                                    |
| `src/domain/services/task.ts`                | 仅补注释                                                                                          |
| `src/domain/index.ts`                        | 导出 `./errors`                                                                                   |
| `src/application/usecases/task.ts`           | `snooze` 委托领域;`update` 用共享函数                                                             |
| `src/application/usecases/converters.ts`     | 兜底用常量;`isDeleted` 改 getter                                                                  |
| `src/domain/entities/__tests__/task.test.ts` | 修 `isDeleted` 误用;补新增行为测试                                                                |
| `src/domain/valueobjects/__tests__/`         | **新建**:VO 错误码测试                                                                            |

### 5.2 `packages/presentation/task`

| 文件                                       | 改动                                                             |
| ------------------------------------------ | ---------------------------------------------------------------- |
| `constants/labels.ts`                      | **新建**:4 个 `computed` UI 标签                                 |
| `utils/error-message.ts`                   | **新建**:错误码 → i18n 映射                                      |
| `handlers/task.ts`                         | 接入 `translateTaskError`                                        |
| `components/table/column-defaults.ts`      | import 切换;`DEFAULT_TABLE_COLUMNS` → `getDefaultTableColumns()` |
| `components/dropdowns/sort-operator.vue`   | import 切换                                                      |
| `components/dropdowns/state-filter.vue`    | import 切换                                                      |
| `components/dropdowns/priority-filter.vue` | import 切换                                                      |
| `components/task-details/main/index.vue`   | import 切换                                                      |
| `components/dialogs/creator/creator.vue`   | import 切换                                                      |
| `index.ts` / 相应 barrel                   | 导出新增模块                                                     |

### 5.3 `packages/shared`

| 文件               | 改动                          |
| ------------------ | ----------------------------- |
| `locales/types.ts` | 新增 15 条 `task.error.*` key |
| `locales/zh-CN.ts` | 新增 15 条中文(沿用现有文案)  |
| `locales/en-US.ts` | 新增 15 条英文                |

### 5.4 `apps/web`

| 文件                                  | 改动                                      |
| ------------------------------------- | ----------------------------------------- |
| `src/views/index/tasks/tasks-view.ts` | `columnLabels` import 源改为 presentation |

---

## 6. 验收标准

### 6.1 纯度验证(grep)

| 验证项                   | 命令                                                                     | 期望                        |
| ------------------------ | ------------------------------------------------------------------------ | --------------------------- |
| domain-task 无框架依赖   | `rg "from 'vue'\|from 'pinia'\|vue-i18n" packages/domain-task/src`       | 0 命中                      |
| domain-task 不再用 `t()` | `rg "\bt\(" packages/domain-task/src/domain/constants.ts`                | 0 命中                      |
| 领域层无中文文案         | `rg "[\u4e00-\u9fa5]" packages/domain-task/src/domain/valueobjects`      | 0 命中(注释除外,需人工确认) |
| 状态白名单唯一           | `rg "'todo', ?'in-progress', ?'done'" packages/domain-task/src`          | 仅 `constants.ts` 1 处      |
| 优先级白名单唯一         | `rg "'low', ?'medium', ?'high'" packages/domain-task/src`                | 仅 `constants.ts` 1 处      |
| snooze 边界唯一          | `rg "1440" packages/domain-task/src`                                     | 仅 `constants.ts` 1 处      |
| UseCase 无 dayjs 派生    | `rg "isValid\(\)" packages/domain-task/src/application/usecases/task.ts` | 0 命中                      |

### 6.2 编译与测试

- [ ] `vp check` 全绿(含 oxlint typeAware + typeCheck)
- [ ] `vp test` 全绿
- [ ] `task.test.ts` 的 `isDeleted` 用例真正通过(而非因写法错误被跳过)

### 6.3 新增测试覆盖

- [ ] `TaskEntity.validateSnoozeDuration`:0 / 1 / 1440 / 1441 / 1.5 / NaN
- [ ] `TaskEntity.canSnooze`:正常 / 已删除 / 已归档 / 已放弃
- [ ] `TaskEntity.isDone`:`done` / `todo` / `in-progress`
- [ ] `isGivenUpBy`:null / `''` / 非法串 / 合法日期
- [ ] `CreateTaskValueObject.validate()`:每条错误码至少 1 例
- [ ] `UpdateTaskValueObject.validate()`:每条错误码至少 1 例
- [ ] `translateTaskError`:已知码→中文、未知串→原样透出

### 6.4 行为等价性(手测)

- [ ] 创建空名任务 → 仍提示「任务名称不能为空」
- [ ] snooze 传 0 / 1441 → 仍提示「延迟时间需在 1-1440 分钟之间」
- [ ] 表格列头、状态/优先级下拉正常显示
- [ ] **切换语言后表头与下拉文案随之更新**(验证响应式回归已修)
- [ ] 排序下拉字段列表正常

---

## 7. 任务分解(严格串行)

| #   | 任务                                                                                        | 验收                                    |
| --- | ------------------------------------------------------------------------------------------- | --------------------------------------- |
| T1  | grep 出 `DEFAULT_TABLE_COLUMNS` 全部引用点,确认改函数的影响面                               | 得到完整清单                            |
| T2  | `packages/shared/locales`:types + zh-CN + en-US 新增 15 条 key                              | `vp check` 通过                         |
| T3  | 新建 `domain/errors.ts`;`domain/index.ts` 导出                                              | `vp check` 通过                         |
| T4  | `domain/constants.ts`:移除 4 个 UI 导出与 `t` import,新增白名单/边界常量                    | domain-task 暂时编译错(消费方未改),预期 |
| T5  | 新建 `presentation/task/constants/labels.ts`,4 个 `computed`                                | —                                       |
| T6  | 切换 7 处消费方 import;`column-defaults.ts` 改 `getDefaultTableColumns()` 并更新其调用方    | `vp check` 通过                         |
| T7  | `domain/entities/task.ts`:`isGivenUpBy` + `isDone` + `canSnooze` + `validateSnoozeDuration` | `vp check` 通过                         |
| T8  | 两个 VO 的 `validate()` 改错误码 + 常量白名单                                               | `vp check` 通过                         |
| T9  | `usecases/task.ts` snooze/update 改造;`converters.ts` 兜底与 `isDeleted` 修正               | `vp check` 通过                         |
| T10 | 新建 `presentation/task/utils/error-message.ts`;`handlers/task.ts` 接入                     | `vp check` 通过                         |
| T11 | 修 `task.test.ts` 的 `isDeleted` 误用;补 Entity 新行为测试                                  | `vp test` 通过                          |
| T12 | 新建 VO 错误码测试 + `translateTaskError` 测试                                              | `vp test` 通过                          |
| T13 | 跑 §6.1 全部 7 条 grep                                                                      | 全部满足                                |
| T14 | `vp check && vp test` 全量回归 + §6.4 手测                                                  | 全绿                                    |

---

## 8. 风险与回滚

| 风险                                                                                         | 概率 | 影响       | 缓解                                                                                    |
| -------------------------------------------------------------------------------------------- | ---- | ---------- | --------------------------------------------------------------------------------------- |
| `DEFAULT_TABLE_COLUMNS` 改函数后,调用方可能依赖其「常量身份」(如做过 `===` 比较或深拷贝基准) | 中   | 列配置错乱 | T1 先 grep 清全部引用再动;若发现身份依赖,改用 `computed` 而非普通函数                   |
| `column-storage.ts` 可能持久化了列配置,label 变化影响反序列化                                | 中   | 列显示异常 | T1 需一并读 `column-storage.ts` 确认是否存 label(应只存 key/width)                      |
| 错误码映射漏项导致用户看到裸码                                                               | 中   | 体验差     | `CODE_TO_LOCALE_KEY` 用 `Record<TaskErrorCodeValue, LocaleKey>` 强制全覆盖,漏项即编译错 |
| `en-US.ts` 与 `types.ts` key 不同步                                                          | 低   | 编译错     | `LocaleMessages` interface 会强制两个 locale 文件都实现                                 |
| `as const` 白名单与 `string` 字段类型冲突                                                    | 中   | 编译错     | `includes` 处用 `as TaskState` 断言;**本轮不收紧字段类型**                              |
| 领域层注释里的中文被 §6.1 grep 误判                                                          | 高   | 验收误判   | grep 结果需人工过滤注释行,或改用 `rg "return '[\u4e00-\u9fa5]"` 精确匹配                |

**回滚**:改动跨 4 个包,建议**按 T 分组提交**(T2 / T3-T6 / T7-T9 / T10 / T11-T12),便于单步回退。

---

## 9. 明确留到下一轮

1. **P7 抽象重复**:`TaskUseCase` 同时持有 `TaskDomain` + `TaskRepository`。合并需改 `useTaskUseCase` 装配与 3 处调用点(`index-view.ts#L59`、`tasks-view.ts#L62`、`pomodoro-view.ts#L70`),且要保留「同一 UseCase 绑不同 store」能力。
2. **P8 类型收紧**:`state` / `priority` 从 `string` 收紧为字面量联合,波及 `TaskViewObject` → presentation 全链路。
3. **Entity mutation**:`giveUp()` / `archive()` / `changeState()` 需先把 `TaskRepository` 从「传 UpdateVO」改为「存 Entity」的聚合持久化模式,会牵动 `packages/infrastructure`。
4. **A3 铺开**:pomodoro / project / tag / identity 的 VO 同样返回裸中文,需同样错误码化。`domain-pomodoro`、`domain-identity` 等的 `validate()` 待清点。
5. **`domain-built-in-project` 定位**:仅有 `domain/types.ts`,需决定升格或降为 `shared` 常量。

---

## 10. 执行前确认

本 spec 已按你的 4 项决策落定:

- ✅ Entity 不加 mutation(§3、§9.3)
- ✅ 错误文案走 i18n,并**新增 15 条 locale key**(§4.3)
- ✅ `isGivenUpBy` 放 `entities/task.ts` 导出(§4.6)
- ✅ `TaskDomain` 保留,仅补注释(§4.10)

外加两项你未提但必须处理的:

- 🔧 修复你改 `constants.ts` 引入的 8 处编译错误 + 响应式回归(§4.4)
- 🔧 修复 `Entity.isDeleted` getter 被当方法调的既存 bug(§4.9)

**T1 有一个未知项需先探明**:`DEFAULT_TABLE_COLUMNS` 的引用方式,以及 `column-storage.ts` 是否持久化 label。这会决定 §4.4 的响应式修复方案是「改函数」还是「改 computed」。