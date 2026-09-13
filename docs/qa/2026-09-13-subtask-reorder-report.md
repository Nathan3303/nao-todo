# 验收报告：详情面板子任务拖拽排序（T3-执行）

- **日期**：2026-09-13
- **角色**：QA（测试工程师）
- **结论**：**通过（PASS）** —— 自动化范围内 **0 FAIL**；65/85 用例已验证通过，20/85 因无自动化/E2E 基建**未测**（均非阻断，明细见 §6）。
- **被测版本**
    - 服务端：`nao-todo-server@arch/go-ddd` commit `fc20c74`（工作区无功能性改动）
    - 客户端：`nao-todo@feat/ocdev` commit `c176c922`
- **用例集**：`docs/qa/2026-09-13-subtask-reorder-testcases.md`（85 条；Q1–Q4 已裁定并入）
- **依据**：`docs/prds/2026-09-13-subtask-reorder.md#7-AC`、`docs/adr/2026-09-13-subtask-reorder.md`

---

## 1. 环境

| 项         | 值                                                                                                                          |
| :--------- | :-------------------------------------------------------------------------------------------------------------------------- |
| 测试库     | **独立** `127.0.0.1:3307/nao_todo_test`（容器 `nao-todo-test-mysql`，`mysql:8.4.9`，Up）                                    |
| 禁止项合规 | ✅ 未连接 dev 库 `3306`（3306 容器 `naotodo-mysql` 仅存在，未使用）；`NAO_TEST_MYSQL_DSN` 未设置（走默认 3307）             |
| Redis      | `naotodo-redis`（`redis:8.8.0`）在 6379（项目列表缓存可能降级，不影响排序断言）                                             |
| Go / Node  | go1.27.0 linux/amd64；客户端经 `./node_modules/.bin/vp`（v4.1.10）                                                          |
| 客户端版本 | root/desktop 1.5.0；domain-task 1.1.0；infrastructure 0.3.0；presentation 0.3.0；**presentation-react 0.1.0（零改动红线）** |

---

## 2. 执行命令与结果

|  #  | 命令                                                                            | 结果                                   |
| :-: | :------------------------------------------------------------------------------ | :------------------------------------- |
|  1  | `go build ./...`                                                                | ✅ 通过                                |
|  2  | `go vet ./...`                                                                  | ✅ 通过（无输出）                      |
|  3  | `go test ./...`（非 integration）                                               | ✅ 全绿（各包 ok）                     |
|  4  | `go test -tags integration -count=1 -p 1 ./infrastructure/persistence/task/...` | ✅ **ok 9.5s；48 PASS / 0 FAIL**       |
|  5  | `./node_modules/.bin/vp test run`                                               | ✅ **59 文件 / 540 用例全绿（31.8s）** |
|  6  | `./node_modules/.bin/vp check --no-fmt`                                         | ✅ **1011 文件 0 错 0 警**             |

**关键测试（重点必测）逐项**

| 重点              | 测试                                                                         | 结果                                  |
| :---------------- | :--------------------------------------------------------------------------- | :------------------------------------ |
| R1 分页×重建      | `use-subtasks`（allowRebuild 三态）+ `task-resort`（>65 / 未取尽退化）       | ✅ PASS                               |
| G1–G10 双向       | `TestSortId_US1/US2/US3/US4` + `sort_id_passthrough_test`                    | ✅ PASS                               |
| Q1 溢出           | `TestSortId_OverflowReturnsDomainError` + `task-resort`「失败⇒重建重试一次」 | ✅ PASS                               |
| Q4 `<=0` 重建     | `task-resort`「前插得 0 ⇒ 重建而非产出 0」                                   | ✅ PASS                               |
| Q3 位置未变 no-op | `task-resort`「目标位置与当前位置相同 ⇒ 不发请求」                           | ✅ PASS                               |
| AC9 组隔离        | `TestSortId_US6` + `task-resort`「重建仅本组」                               | ✅ PASS                               |
| AC15 计数零变化   | `TestSortId_US6/US3`（四计数）+ `TestCount_*`（STAT-01 回归）                | ✅ PASS                               |
| AC10 默认序       | `TestSortId_US5`（parentTaskId+空 sort 生效、显式 sort 不追加）              | ✅ PASS（顶层不改序=代码审查，见 §6） |
| 拖拽交互          | `subtasks.test`（行属性/指示线/名称防误触/drop 契约）                        | ✅ PASS（部分未测，见 §6）            |

---

## 3. PASS / FAIL / 未测 计数

| 状态                               |  数量  | 占比 |
| :--------------------------------- | :----: | :--: |
| ✅ PASS                            | **65** | 76%  |
| ❌ FAIL                            | **0**  |  0%  |
| ⬜ 未测（无自动化/E2E/人工未执行） | **20** | 24%  |
| **合计**                           | **85** | 100% |

分组：

| 分组        | PASS | 未测 | 小计 |
| :---------- | :--: | :--: | :--: |
| 服务端 S    |  28  |  3   |  31  |
| 客户端 C    |  22  |  6   |  28  |
| 组件/E2E E  |  9   |  8   |  17  |
| R1 专项 R   |  4   |  2   |  6   |
| 人工/契约 X |  2   |  1   |  3   |

---

## 4. 逐 AC 结论

| AC                 | 结论    | 证据                                                                                 | 备注（未测子项）                                       |
| :----------------- | :------ | :----------------------------------------------------------------------------------- | :----------------------------------------------------- |
| AC1 拖拽持久化     | ✅ PASS | `task-resort` 前插/末插 + `subtasks.test` drag→drop + `TestSortId_US5` 持久序        | 刷新后保持（E01）无 E2E 基建，未测                     |
| AC2 底部插入       | ✅ PASS | `task-resort`「插入组末 prev+1000」                                                  | E02 E2E 未测（算法已覆盖）                             |
| AC3 无变化 no-op   | ✅ PASS | `task-resort` Q3 预检（相邻同上不下均不请求）                                        | —                                                      |
| AC4 重建           | ✅ PASS | `task-resort` diff<2 / `<=0` 触发 + `TestSortId_US6`                                 | —                                                      |
| AC5 新建置末       | ✅ PASS | `TestSortId_US2` G2 + `use-subtasks` createSubTask 追加                              | —                                                      |
| AC6 降级置末       | ✅ PASS | `TestSortId_US2` G5 / `TestSortId_US3` G7                                            | UI E2E 未测                                            |
| AC7 升级/脱离置末  | ✅ PASS | `TestSortId_US3` G7（脱离→组0末 258）                                                | UI E2E 未测                                            |
| AC8 换父置末       | ✅ PASS | `TestSortId_US2` G5（旧组不动）/ G7                                                  | UI E2E 未测                                            |
| AC9 组隔离         | ✅ PASS | `TestSortId_US6` + `task-resort`「重建仅本组」                                       | —                                                      |
| AC10 存量 0/默认序 | ✅ PASS | `TestSortId_US5`（0 值最前、同值 id 兜底、total 准确、显式 sort 不追加）             | **顶层列表不加默认序（S24/B5）无自动化**，代码审查符合 |
| AC11 sync/离线     | ✅ PASS | `sync.test` push 含 sortId、0 不产出 + `persistence-go` res→entity                   | 双端拉取一致性（E10）跨端 E2E 未测                     |
| AC12 显式优先      | ✅ PASS | `TestSortId_US2` G1/G3、`US3` G6 + `passthrough_test` + `sync.test`                  | —                                                      |
| AC13 领域守卫      | ✅ PASS | 既有 `parent-guard.test` 全绿 + 越界 `-1/70000` 未测（S33，uint16 绑定）             | 交互守卫 E20/E22/E23 未测                              |
| AC14 移动端零改动  | ✅ PASS | `git diff c176c922^ c176c922 -- packages/presentation-react apps/mobileapp` = **空** | —                                                      |
| AC15 计数零变化    | ✅ PASS | `TestSortId_US6/US3`（check/comment/subtask/task）+ STAT-01 `TestCount_*` 全绿       | 事件级「零发布」为代码审查+计数间接证明                |
| R1 阻断项          | ✅ PASS | R01–R04（未取尽/超 65 禁重建、单条浮动正确、仅本组）                                 | R05（120>100 截断）、R06（端到端不换人）未测           |

> **无 FAIL。** 所有阻断级项（R1 核心、G4 不写列、G8 父未变不写列、AC9、AC15、AC10 默认序限定）均已由自动化断言通过；仅「顶层列表不加默认序」为代码审查而非用例断言。

---

## 5. 逐用例状态

### 5.1 服务端

| 用例                       | 状态 | 证据                                                                      |
| :------------------------- | :--: | :------------------------------------------------------------------------ |
| S01 组 0 max 独立          |  ✅  | `TestSortId_US1`                                                          |
| S02 子组 max 独立          |  ✅  | `TestSortId_US1`                                                          |
| S03 空组=256               |  ✅  | `TestSortId_US1`（基线 255 + 创建 256）                                   |
| S04 软删不计               |  ✅  | `TestSortId_US1`                                                          |
| S05 溢出领域错误（不回绕） |  ✅  | `TestSortId_OverflowReturnsDomainError`                                   |
| S10 G1 显式优先            |  ✅  | `TestSortId_US2`                                                          |
| S11 G2 新建组末            |  ✅  | `TestSortId_US2`（含 push 带 id 新建）                                    |
| S12 G3 覆盖显式            |  ✅  | `TestSortId_US2`                                                          |
| S13 G4 覆盖 0 父未变不写列 |  ✅  | `TestSortId_US2`                                                          |
| S14 G5 覆盖 0 父变置新组末 |  ✅  | `TestSortId_US2`（旧组不动）                                              |
| S15 G6 PATCH 显式          |  ✅  | `TestSortId_US3`                                                          |
| S16 G7 PATCH 换父/脱离置末 |  ✅  | `TestSortId_US3`                                                          |
| S17 G8 父未变不动          |  ✅  | `TestSortId_US3`（含纯字段 PATCH）                                        |
| S18 G9 Copy 组末           |  ✅  | `TestSortId_US4`                                                          |
| S19 G10 Restore 保留       |  ✅  | `TestSortId_US4`                                                          |
| S20 双入口不被 max+1 覆盖  |  ✅  | `TestSortId_US2` G1/G3 + `US3` G6                                         |
| S21 默认序生效             |  ✅  | `TestSortId_US5`                                                          |
| S22 存量 0 稳定            |  ✅  | `TestSortId_US5`                                                          |
| S23 显式 sort 不追加默认序 |  ✅  | `TestSortId_US5`（sortId:desc）                                           |
| S24 顶层不加默认序         |  ⬜  | 无自动化；`repoImpl.List` 仅 `q.ParentTaskId > 0` 时追加，代码审查符合 B5 |
| S25 同值 id 二级键         |  ✅  | `TestSortId_US5`                                                          |
| S26 ListSync 契约不破      |  ✅  | `TestListSyncKeyset` 回归                                                 |
| S27 组隔离                 |  ✅  | `TestSortId_US6`                                                          |
| S28 重建仅本组写入         |  ✅  | `TestSortId_US6`（Q 组零变化）                                            |
| S29 四计数不变             |  ✅  | `TestSortId_US6` + `TestCount_*`                                          |
| S30 不触发 E1–E7           |  ✅  | `TestSortId_US3/US6` 计数不变 + 代码审查                                  |
| S31 自身 updated_at 前进   |  ✅  | `TestSortId_US3`（纯重排 bump 自身）                                      |
| S32 旧服务端兼容           |  ⬜  | 无旧版本环境；不可自动化                                                  |
| S33 越界 JSON `-1/70000`   |  ⬜  | 无自动化（uint16 绑定行为未断言）                                         |
| S34 响应含 sortId          |  ✅  | 字段既有 + 客户端 `persistence-go` res→entity 断言                        |
| S35 溢出错误码可取         |  ✅  | `ErrSortIdOverflow` 断言                                                  |

### 5.2 客户端

| 用例                          | 状态 | 证据                                                    |
| :---------------------------- | :--: | :------------------------------------------------------ |
| C01 res→entity 映射+兜底      |  ✅  | `persistence-go/task/converters.test`                   |
| C02 record→entity 兜底 0      |  ✅  | `persistence-local/converters.test`                     |
| C03 entity→VO 透传            |  ✅  | `domain-task/.../converters.test`                       |
| C04 update VO→Req             |  ✅  | `persistence-go/task/converters.test`                   |
| C05 尾部可选不破坏构造        |  ✅  | 全量 540 用例全绿                                       |
| C06 create VO sortId=0 不产出 |  ✅  | `persistence-go/task/converters.test`（`hasOwn=false`） |
| C07 create VO 非零产出        |  ✅  | 同上                                                    |
| C08 push 白名单含 sortId      |  ✅  | `sync.test`（3000 透传）                                |
| C09 Dexie 无迁移              |  ✅  | `local-database` 仍 version(4) + `local-repos` 回归全绿 |
| C10 前插→重建（不产 0）       |  ✅  | `task-resort` Q4                                        |
| C11 末插 prev+1000            |  ✅  | `task-resort`                                           |
| C12 中插取均值                |  ✅  | `task-resort`                                           |
| C13 diff<2 重建               |  ✅  | `task-resort`                                           |
| C14 负值重建                  |  ✅  | 同 `<=0` 分支（`task-resort` Q4 同分支）                |
| C14b 前插得 0 重建            |  ✅  | `task-resort` Q4                                        |
| C15 拖到自己 no-op            |  ⬜  | 无直接用例；代码 `originalId === boundId` 守卫          |
| C16 仅 1 子任务 no-op         |  ⬜  | 无直接用例；代码 `group.length <= 1` 守卫               |
| C17 目标不存在 error          |  ⬜  | 无直接用例；代码 `TASK_NOT_FOUND` 守卫                  |
| C18 重建输出 1000..n          |  ✅  | `task-resort`                                           |
| C19 重建仅本组                |  ✅  | `task-resort`                                           |
| C20 单条浮动仅 1 更新         |  ✅  | `task-resort`（update 1 次）                            |
| C21 乐观+失败回退             |  ⬜  | 回退逻辑存在（`resortSingle`），无直接断言              |
| C22 与检查项差分一致          |  ⬜  | 无差分 oracle 测试（检查项无单测文件）                  |
| C23 subTasks 按 (sortId,id)   |  ✅  | `use-subtasks.test`                                     |
| C24 全量加载+暴露 total       |  ✅  | `use-subtasks.test`（limit 100、total）                 |
| C25 新建子任务置末            |  ✅  | 服务端 G2 + createSubTask 追加                          |
| C26 Q1 溢出→重建重试一次      |  ✅  | `task-resort`（失败⇒重建重试）                          |
| C27 >65 溢出直接上报          |  ⬜  | 无直接用例（>65 仅覆盖 no-op 路径）                     |

### 5.3 组件/E2E

| 用例                     | 状态 | 证据                                                      |
| :----------------------- | :--: | :-------------------------------------------------------- |
| E01 整行拖+刷新保持      |  ⬜  | 拖拽接线 PASS（`subtasks.test`）；「刷新保持」无 E2E 基建 |
| E02 底部插入             |  ⬜  | 算法 PASS（C11）；E2E 未测                                |
| E03 无变化 no-op         |  ✅  | `/subtasks.test` + `task-resort` Q3                       |
| E04 首次重建             |  ✅  | `task-resort`                                             |
| E05 新建置末             |  ✅  | 服务端 G2 + 既有创建流                                    |
| E06/E07/E08 组变更置末   |  ✅  | 服务端 G5/G7（UI 端到端未测）                             |
| E09 组隔离               |  ✅  | US6 + task-resort                                         |
| E10 离线 push→另一端一致 |  ⬜  | push 侧 PASS；跨端一致性无 E2E                            |
| E11 拖拽视觉             |  ✅  | `subtasks.test`（dragging / data-dod）                    |
| E12 仅 1 子任务 no-op    |  ⬜  | 同 C16                                                    |
| E20 checkbox 防误触      |  ⬜  | 无直接用例；`INTERACTIVE_SELECTOR` 含 `input`             |
| E21 名称防误触           |  ✅  | `subtasks.test`（preventDefault）                         |
| E22 脱离按钮防误触       |  ⬜  | 无直接用例；selector 含 `button`                          |
| E23 跨列表守卫           |  ⬜  | 无直接用例；`isSameList` 已实现                           |
| E24 检查项拖拽回归       |  ⬜  | 无 `use-event-dragger` 专用测试                           |

### 5.4 R1 专项 / 人工

| 用例                         | 状态 | 证据                                                                     |
| :--------------------------- | :--: | :----------------------------------------------------------------------- |
| R01 未取尽禁重建             |  ✅  | `use-subtasks.test`（loaded<total）+ `task-resort`（allowRebuild=false） |
| R02 >65 禁重建               |  ✅  | `use-subtasks.test` + `task-resort`                                      |
| R03 可重建                   |  ✅  | `task-resort` + `use-subtasks.test`（loaded===total）                    |
| R04 未取尽单条浮动仍正确     |  ✅  | `task-resort`（allowRebuild=false 时单条 1001）                          |
| R05 total=120>100 截断禁重建 |  ⬜  | 无 >100 用例                                                             |
| R06 端到端「刷新不换人」     |  ⬜  | 无 E2E 基建                                                              |
| X01 移动端零改动             |  ✅  | `git diff` 为空（AC14 红线满足）                                         |
| X02 push/create 0 语义       |  ✅  | `sync.test` + `converters.test`                                          |
| X03 上线顺序                 |  ⬜  | 非本次执行范围（发布阶段人工检查单）                                     |

---

## 6. 缺陷清单

**未发现功能缺陷（0 FAIL）。** 版本行为与 ADR/AC 一致，重点阻断项全部通过。

以下为**覆盖缺口（非缺陷，建议补测）**，按风险排序：

|   #   | 缺口                                 | 用例            | 严重级 | 说明 / 建议                                                                                                                                     |
| :---: | :----------------------------------- | :-------------- | :----- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| GAP-1 | 顶层列表「不加默认序」（B5）无自动化 | S24             | **中** | 需求明确为阻断回归点；当前仅代码审查（`q.ParentTaskId > 0` 条件）。建议补 1 条集成断言（无 parentTaskId 过滤 + 存在 sort_id=0 旧行 ⇒ 顺序不变） |
| GAP-2 | R1 端到端「刷新后不换人」无 E2E      | R06/E01/E02     | **中** | 现仅单测证明「禁重建」，未证明刷新后可见集合稳定；子任务 E2E 基建缺失。建议加最小 E2E 或组件级重载断言                                          |
| GAP-3 | 兜底 no-op 分支无直接用例            | C15/C16/C17/C21 | 低     | 守卫代码存在，无断言；建议补 4 条边界单测                                                                                                       |
| GAP-4 | 交互防误触仅覆盖「名称」             | E20/E22/E23     | 低     | checkbox/脱离/跨列表守卫无断言；建议补组件测试                                                                                                  |
| GAP-5 | 与检查项先例差分对照未实现           | C22             | 低     | 行为断言已覆盖主要分支，但无 oracle 差分；建议补差分测试（先例无现成单测，需同步补）                                                            |
| GAP-6 | `useEventDragger` 参数化回归无测试   | E24             | 低     | 默认值经代码审查保持检查项契约（`.nue-div--event-row` / `--event-list` / `eid`），建议补回归                                                    |
| GAP-7 | 越界 JSON / 旧服务端兼容无用例       | S33/S32         | 低     | uint16 绑定与旧版本兼容；建议补接口层绑定断言                                                                                                   |
| GAP-8 | total>100 截断场景无用例             | R05             | 低     | 逻辑与 R01 同守卫，风险低                                                                                                                       |

> 按 PRD「不达标处置」：AC1/AC4/AC5/AC6/AC8 均 PASS，**无需回退 RD**；R1 核心守卫 PASS，不触发阻断。

---

## 7. 未测项与理由（汇总）

| 未测项                                                            | 理由                                                                      |
| :---------------------------------------------------------------- | :------------------------------------------------------------------------ |
| 刷新/跨端/换人端到端（E01/E02/E10/R06）                           | 客户端无 E2E 基建（无 playwright/cypress 配置）；组件测试不覆盖刷新与双端 |
| 下拉/勾选/脱离/跨列表防误触（E20/E22/E23）、检查项拖拽回归（E24） | 无对应组件/组合式用例；仅代码审查                                         |
| 算法兜底分支（C15/C16/C17/C21）、差分（C22）                      | 无直接用例；差分需检查项 oracle（其单测本就不存在）                       |
| 越界 JSON（S33）、旧服务端（S32）                                 | 无对应接口测试/旧版本环境                                                 |
| total>100 截断（R05）                                             | 无用例覆盖该规模                                                          |
| 顶层默认序（S24）                                                 | 无自动化；已代码审查确认实现符合 B5                                       |
| 上线顺序（X03）                                                   | 属发布阶段人工检查单，非本次执行范围                                      |

---

## 8. 风险与观察

| 项   | 说明                                                                         |
| :--- | :--------------------------------------------------------------------------- |
| 观察 | `sortId` 同组同值冲突（R3）不做去冲突，靠 `id` 二级键兜底；上线后观察频率    |
| 观察 | 首次拖拽必触发组内重建（预期行为），重建 = N 条更新；关注 sync 增量          |
| 观察 | 组内 >65 行禁重建；单条浮动不可行时 no-op（静默），交互上无反馈              |
| 观察 | Q1 溢出恢复依赖客户端重建重试；>65 时直接上报（UI 错误提示由后续 UI 单定义） |

---

## 9. 变更记录

| 日期       | 变更                                                                                                                     |
| :--------- | :----------------------------------------------------------------------------------------------------------------------- |
| 2026-09-13 | 首版验收报告：服务端 48 集成 PASS / 客户端 540 单测 PASS / vp check 0 错；85 用例中 65 PASS、0 FAIL、20 未测；无功能缺陷 |