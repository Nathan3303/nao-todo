# Checklist: 领域层行为收敛 + 纯化(Task 域,A2)

> 配套 [spec.md](./spec.md)。**严格 T1 → T14 串行**,每步验收后进入下一步。
> 建议按 5 组提交:`T2` / `T3-T6` / `T7-T9` / `T10` / `T11-T12`。

---

## 前置

- [ ] `git status` 干净(你对 `constants.ts` 的改动需先提交或暂存,以便区分)
- [ ] 记录基线:`vp check` 当前报错数量(预期非零,因 1.1 的编译错误)

---

## T1 — 探明未知项(不改代码)

- [ ] `rg "DEFAULT_TABLE_COLUMNS" packages apps` → 列出全部引用点
- [ ] 读 `packages/presentation/task/components/table/column-storage.ts`,确认持久化内容**是否含 label**
- [ ] 读 `packages/presentation/task/components/table/use-column-config.ts`,确认列配置初始化方式
- [ ] 判定响应式修复方案:改函数 / 改 `computed` / 保持常量但 label 延迟求值

**产出**:确定 §4.4 的最终实现方式,若与 spec 描述不同则先更新 spec。

---

## T2 — locale 新增 15 条 key

- [ ] `packages/shared/locales/types.ts`:`'task.error.loadFailed'`(L330)后追加 15 条声明
- [ ] `packages/shared/locales/zh-CN.ts`:追加 15 条中文(**沿用现有文案**,见 spec §4.3)
- [ ] `packages/shared/locales/en-US.ts`:追加 15 条英文

**验收**:`vp check` 通过(interface 会强制两 locale 文件同步)

---

## T3 — 新建领域错误码

- [ ] 新建 `packages/domain-task/src/domain/errors.ts`(15 个码 + `TaskErrorCodeValue` 类型)
- [ ] `packages/domain-task/src/domain/index.ts` 追加 `export * from './errors'`

**验收**:`vp check` 通过

---

## T4 — `domain/constants.ts` 纯化

- [ ] 移除 `TaskStateSelectOptions`
- [ ] 移除 `TaskPrioritySelectOptions`
- [ ] 移除 `columnLabels`
- [ ] 移除 `sortFieldLabels`
- [ ] 移除 `import { t } from '@nao-todo/shared'`
- [ ] 移除 `import type { TaskSortFields } from './types'`(若仅被移除项使用)
- [ ] 保留 `stateSNMap` / `stateSNMapReverse` / `prioritySNMap` / `prioritySNMapReverse`
- [ ] 新增 `TASK_STATES` / `TASK_PRIORITIES` / `TASK_REMIND_REPEATS` + 对应 type
- [ ] 新增 `DEFAULT_TASK_STATE` / `DEFAULT_TASK_PRIORITY` / `DEFAULT_REMIND_REPEAT`
- [ ] 新增 `TASK_NAME_MAX_LENGTH` / `TASK_DESC_MAX_LENGTH`
- [ ] 新增 `SNOOZE_MIN_MINUTES` / `SNOOZE_MAX_MINUTES`

**验收**:`rg "\bt\(" packages/domain-task/src/domain/constants.ts` → 0 命中
**预期**:消费方此时编译错,T6 修复

---

## T5 — 新建 presentation UI 标签

- [ ] 新建 `packages/presentation/task/constants/labels.ts`
- [ ] 4 个导出全部用 `computed`(恢复 locale 响应式)
- [ ] 内容与原 `constants.ts` 实现**逐字一致**(避免文案漂移)
- [ ] 在 `packages/presentation/task/index.ts` 导出

**验收**:`vp check` 对该文件无报错

---

## T6 — 切换 7 处消费方 import

- [ ] `presentation/task/components/table/column-defaults.ts`
- [ ] `presentation/task/components/dropdowns/sort-operator.vue`
- [ ] `presentation/task/components/dropdowns/state-filter.vue`
- [ ] `presentation/task/components/dropdowns/priority-filter.vue`
- [ ] `presentation/task/components/task-details/main/index.vue`
- [ ] `presentation/task/components/dialogs/creator/creator.vue`
- [ ] `apps/web/src/views/index/tasks/tasks-view.ts`
- [ ] 按 T1 结论实施 `DEFAULT_TABLE_COLUMNS` 响应式修复
- [ ] 更新该常量/函数的全部调用方

**验收**:

- [ ] `vp check` 通过(§1.1 的 8 处编译错误全部消除)
- [ ] `rg "domain-task.*columnLabels\|domain-task.*SelectOptions" packages apps` → 0 命中

---

## T7 — `TaskEntity` 增派生属性与静态校验

- [ ] 新增导出 `isGivenUpBy(givenUpAt)`
- [ ] `isGivenUp` getter 改为 `return isGivenUpBy(this.givenUpAt)`
- [ ] 新增 `isDone` getter
- [ ] 新增 `canSnooze` getter(注意用 `this.isDeleted` 不带括号)
- [ ] 新增 `static validateSnoozeDuration(durationMinutes)`,返回错误码

**验收**:`vp check` 通过

---

## T8 — 两个 VO 改错误码 + 常量白名单

`create-task.ts`:

- [ ] 12 条中文文案 → `TaskErrorCode.*`
- [ ] `['todo','in-progress','done']` → `TASK_STATES`
- [ ] `['low','medium','high']` → `TASK_PRIORITIES`
- [ ] `['none','daily','weekly','monthly']` → `TASK_REMIND_REPEATS`
- [ ] `128` → `TASK_NAME_MAX_LENGTH`,`256` → `TASK_DESC_MAX_LENGTH`

`update-task.ts`:

- [ ] 15 条中文文案 → `TaskErrorCode.*`
- [ ] 三处白名单 → 常量
- [ ] 长度数字 → 常量
- [ ] **注意**:L38 文案「任务名称长度不能超过128个字符」与 create 的不一致,统一归到 `NAME_TOO_LONG`

**验收**:

- [ ] `vp check` 通过
- [ ] `rg "return '[\u4e00-\u9fa5]" packages/domain-task/src/domain/valueobjects` → 0 命中

---

## T9 — UseCase 与 Converter 改造

`application/usecases/task.ts`:

- [ ] `snooze` 改为调 `TaskEntity.validateSnoozeDuration`
- [ ] 删除硬编码 `1` / `1440` / 中文文案
- [ ] `update` 的 `isGivenUp` 改用 `isGivenUpBy`

`application/usecases/converters.ts`:

- [ ] `state` 兜底改 `TASK_STATES` + `DEFAULT_TASK_STATE`
- [ ] `priority` 兜底改 `TASK_PRIORITIES` + `DEFAULT_TASK_PRIORITY`
- [ ] L55 `isDeleted` 改为 `entity.isDeleted`(getter,去掉 dayjs 重算)

**验收**:

- [ ] `vp check` 通过
- [ ] `rg "1440" packages/domain-task/src` → 仅 `constants.ts`
- [ ] `rg "isValid\(\)" packages/domain-task/src/application/usecases/task.ts` → 0 命中

---

## T10 — presentation 错误码翻译层

- [ ] 新建 `packages/presentation/task/utils/error-message.ts`
- [ ] `CODE_TO_LOCALE_KEY` 用 `Record<TaskErrorCodeValue, LocaleKey>`(强制全覆盖)
- [ ] `translateTaskError` 对未知串原样透出
- [ ] `packages/presentation/task/handlers/task.ts` 接入(替换 `unwrapError` 的直接使用处)
- [ ] 在 barrel 导出

**验收**:

- [ ] `vp check` 通过(漏一个码就编译错)

---

## T11 — 修既存测试 bug + 补 Entity 测试

- [ ] `task.test.ts#L99-L100`:`isDeleted()` → `isDeleted`
- [ ] 补 `validateSnoozeDuration`:0 / 1 / 1440 / 1441 / 1.5 / NaN
- [ ] 补 `canSnooze`:正常 / 已删除 / 已归档 / 已放弃
- [ ] 补 `isDone`:`done` / `todo` / `in-progress`
- [ ] 补 `isGivenUpBy`:null / `''` / 非法串 / 合法日期

**验收**:`vp test` 通过,且 `isDeleted` 用例真正执行

---

## T12 — 补 VO 与翻译层测试

- [ ] 新建 `packages/domain-task/src/domain/valueobjects/__tests__/create-task.test.ts`
- [ ] 新建 `packages/domain-task/src/domain/valueobjects/__tests__/update-task.test.ts`
- [ ] 每条错误码至少 1 个用例
- [ ] 新建 `translateTaskError` 测试:已知码→中文 / 未知串→原样

**验收**:`vp test` 全绿

---

## T13 — 纯度 grep 验证(7 条)

| #   | 命令                                                                     | 期望         | 结果 |
| --- | ------------------------------------------------------------------------ | ------------ | ---- |
| 1   | `rg "from 'vue'\|from 'pinia'\|vue-i18n" packages/domain-task/src`       | 0            | [ ]  |
| 2   | `rg "\bt\(" packages/domain-task/src/domain/constants.ts`                | 0            | [ ]  |
| 3   | `rg "return '[\u4e00-\u9fa5]" packages/domain-task/src/domain`           | 0            | [ ]  |
| 4   | `rg "'todo', ?'in-progress', ?'done'" packages/domain-task/src`          | 仅 constants | [ ]  |
| 5   | `rg "'low', ?'medium', ?'high'" packages/domain-task/src`                | 仅 constants | [ ]  |
| 6   | `rg "1440" packages/domain-task/src`                                     | 仅 constants | [ ]  |
| 7   | `rg "isValid\(\)" packages/domain-task/src/application/usecases/task.ts` | 0            | [ ]  |

---

## T14 — 全量回归

- [ ] `vp check` 全绿
- [ ] `vp test` 全绿
- [ ] 手测:创建空名任务 → 提示「任务名称不能为空」
- [ ] 手测:snooze 0 / 1441 → 提示「延迟时间需在 1-1440 分钟之间」
- [ ] 手测:表格列头正常
- [ ] 手测:状态/优先级下拉正常
- [ ] 手测:排序下拉字段列表正常
- [ ] **手测:切换语言 → 表头与下拉文案跟随更新**(关键,验证响应式回归已修)

---

## 确认未误改(提交前)

- [ ] 未给 `TaskEntity` 加 mutation 方法
- [ ] 未删 `TaskDomain`
- [ ] 未改 `TaskRepository` 接口签名
- [ ] 未改 `TaskViewObject` 字段结构
- [ ] 未收紧 `state` / `priority` 的 `string` 类型
- [ ] 未动 pomodoro / project / tag / identity / built-in-project 领域包
- [ ] 未改 `packages/shared/locales/i18n.ts` 的 `t()` 实现