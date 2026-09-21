# ADR：提醒扫描口径与恢复语义（活跃任务过滤 + 重复提醒终止边界）

- **日期**：2026-09-21
- **状态**：**已裁决（已实现 / 已复核）**
- **范围**：服务端 `nao-todo-server`——`infrastructure/persistence/task/repoImpl.go`（扫描）、`domain/task/service/serviceImpl.go`（续期/自愈）、`application/task/appImpl.go`（发布）
- **相关**：`docs/adr/2026-09-21-sync-nullable-time-tri-state-contract.md`（`given_up_at`/`archived_at` 同步契约，为本篇前置）；服务端 `infrastructure/cron/cronImpl.go`（触发源）

## 修订记录

| 版本   | 日期           | 变更摘要                                                                                                                                                                                       |
| :----- | :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **r1** | **2026-09-21** | 首次成文：H1（扫描误弹完成/归档/放弃任务）→ 决策「活跃任务过滤 + 恢复即恢复（不清 remind_at）」；H4（零值 end_at 致重复提醒首触发即清空）→ 决策「仅 end_at 存在时设终止边界」；登记 H2/H3 遗留 |

## 1. 背景与问题

提醒由服务端**进程内 cron** 周期触发：`GetDueReminders`（扫描）→ `ProcessReminders`（重复提醒改期/一次性自愈）→ `PublishReminder`（推送）。本轮暴露两个语义缺口：

- **H1（误弹）**：`GetDueReminders` 原先仅按 `remind_at <= NOW() AND remind_at IS NOT NULL` 扫描。任务被**完成 / 归档 / 放弃**后，`remind_at` 往往仍残留 ⇒ 已完成/已归档/已放弃任务**照常弹提醒**。
- **H4（误清空）**：重复提醒续期时把 `&task.EndAt.Time` 直接传入 `calculateNextRemindAt`。`end_at` 为**零值**（未设置）时 `next.After(zero)` 恒真 ⇒ 被误判「已越过终点」⇒ **重复提醒首次触发即被清空**。

## 2. 决策

**D1（H1）— 扫描只取「活跃任务」**：`GetDueReminders` 在 `remind_at` 条件基础上补：

```
archived_at IS NULL
given_up_at IS NULL
state <> done
```

软删由 GORM 隐式 `deleted_at IS NULL` 过滤（`repoImpl.go:390-403`）。

**D2（H1，恢复语义）— 不清 `remind_at`，恢复即恢复提醒**：暂停期间（已归档/已放弃/已完成）不提醒；一旦**取消归档 / 取消放弃 / 回到未完成**，因 `remind_at` 未被触碰，提醒**自动恢复**。

**D3（H4）— 终止边界仅在 `end_at` 实际存在时设置**：`calculateNextRemindAt` 的 `endAt` 参数改为按 `task.EndAt.Valid` 传 `nil`/指针（`serviceImpl.go:164-176`）；无 `end_at` 的 daily/weekly/monthly 正常续期，有 `end_at` 且下一次越过时仍清空。

**D4 — 保留既有 CAS 与自愈**：`UpdateRemindAt`/`ClearRemindRepeat` 以扫描时的 `remind_at` 为期望值做条件更新，避免覆盖用户 Snooze/改期（`repoImpl.go:441-`，`serviceImpl.go:178-205`）；一次性提醒触发后自愈清空、重复提醒改期逻辑不变。

## 3. 理由与被否方案

**否决「状态变更时清 `remind`」**：完成/归档/放弃时清空 `remind_at`（或 `remindRepeat`）会使提醒配置**永久丢失**——用户恢复任务后需重新设置提醒。用「扫描过滤 + 不清字段」实现「暂停/恢复」语义，代价为零、可逆，且不引入新的写路径。

**否决「在发布侧过滤」**：若扫描仍返回非活跃任务、只在 `PublishReminder` 前过滤，则重复提醒的 `UpdateRemindAt` 改期仍会发生（副作用已产生），且扫描量/事务成本不变。过滤必须在**扫描 SQL** 层，才能同时阻断副作用。

**否决「用 `end_at` 零值判断取代 `Valid`」**：`NullableTime` 的「未设置」与「显式清空」在 `time.Time` 零值上不可区分（与三态契约同源）；必须用 `Valid` 语义。

## 4. 影响与约束

- **提醒可见性**：已删除（软删）、已完成、已归档、已放弃、未到期、`remind_at IS NULL` 均不参与扫描；`todo`/`in-progress` 正常提醒。
- **不改同步/字段语义**：恢复不清 `remind_at`；客户端同步三态契约（见同批 ADR）保证 `given_up_at`/`archived_at` 准确落库，扫描过滤才可信。
- **约束（未来）**：新增「非活跃」状态（如新的终态）时，必须同步更新扫描排除条件；禁止在状态变更路径清理 `remind_at` 来实现暂停。

## 5. 证据索引

| 类别           | 位置 / 提交                                                                                                                                                                                                                                                    |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1 修复        | `nao-todo-server` `72e8c4e`（fix(reminder): 到期提醒扫描排除完成/归档/放弃任务）                                                                                                                                                                               |
| H1 回归        | `nao-todo-server` `a7b2580`（扫描排除口径集成覆盖 + 改期/自愈回归）                                                                                                                                                                                            |
| H4 修复        | `nao-todo-server` `aabb43f`（fix(reminder): 重复提醒续期仅在 end_at 存在时设终止边界）                                                                                                                                                                         |
| H4 回归        | `nao-todo-server` `2ae4b04`（无 end_at 的 daily/weekly/monthly 续期覆盖）                                                                                                                                                                                      |
| 扫描 SQL       | `infrastructure/persistence/task/repoImpl.go:390-403`（`archived_at IS NULL` / `given_up_at IS NULL` / `state <> done`）                                                                                                                                       |
| 续期/自愈      | `domain/task/service/serviceImpl.go:164-176`（`endAtPtr` 按 `Valid`）、`:178-211`（CAS + `return tasks`）                                                                                                                                                      |
| 发布           | `application/task/appImpl.go:660-677`（`ProcessReminders` → `PublishReminder`）                                                                                                                                                                                |
| 触发源（遗留） | `infrastructure/cron/cronImpl.go:9-15`（`robfig/cron` 进程内单例）                                                                                                                                                                                             |
| 测试           | `infrastructure/persistence/task/reminder_scope_integration_test.go:18`（`TestGetDueReminders_ExcludesInactive`）；`domain/task/service/process_reminders_test.go:48`；`infrastructure/persistence/task/repoImpl_integration_test.go:359`（`TestReminderCAS`） |

## 6. 遗留项

- **H2（P1，扩容前必办）**：提醒扫描 cron 为**进程内**定时器（`cronImpl.go`，`robfig/cron` 单例）。多副本部署时每个副本都会扫描并推送 ⇒ **重复提醒**。扩容前需引入 CAS/分布式锁（或选主）。
- **H3（观察项）**：`ProcessReminders` 的 CAS 失败项（扫描与更新之间用户 Snooze/改期）虽 `continue` 跳过字段更新，但函数最终 `return tasks, nil` 返回的是**原始列表**（`serviceImpl.go:211`）⇒ 应用层仍会 `PublishReminder`。属既有行为，本单未改；若要严格「CAS 失败不推送」，需改为只返回成功改期/自愈的项（涉及一次性提醒语义，另单评估）。