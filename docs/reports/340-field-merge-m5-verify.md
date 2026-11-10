# 340 · B 批 `682b`：M5（`conflictFields` + 面板按字段 + 两条 nit）独立复核

- 日期：2026-11-10 · Owner：qa · 级别：**done(full)** —— **本批第一次「全仓 0 红」**
- M5 提交 **`00547744`**（10 文件 +367/−7）· 派单 HEAD = `00547744` · 基线（M5 之前）= `8356df82`
- ⛔ 未改生产代码 / 未改任何既有断言（**15 路径**哈希闸通过）· 独立探针 **9 例**（6 领域 + 3 面板真挂载）跑完删除、未入库 · 结束后 `git status` 空
- 独立证据载体：`t682b-fields-probe.test.ts`（6 例）· `t682b-panel-probe.test.ts`（3 例，真挂载）

## 0. 判据结论总表

| #   | 判据                                                                          | 结论                                                                                                                         |
| --- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | **全仓 0 红**（`AC5-⑧`/`AC5-⑨` 转绿，其余 13 条保持绿）                       | ✅ **2 次单独全仓连跑均 0 红**：**420 文件（419 绿 / 1 skip）· 3322 例（3316 绿 / 6 skip / 0 红）**                          |
| 2   | `conflictFields` 按字段、只含冲突字段；四边界落账；去重保序；缺省/空不落键    | ✅ 独立探针 6 例（四边界 + 去重保序 + 缺省/空 + `ConflictListItem` 透出）                                                    |
| 3   | 提醒组：`conflictFields` **与** `loser` 都是整组四字段                        | ✅ 实测 `conflictFields === GROUP`、`loser` 键集 = `id + GROUP`、整组取本地无混搭                                            |
| 4   | 面板真挂载（非 stub）· 人话标签 · 零新 i18n 键 · 缺省不渲染 · 桌面/窄屏不破版 | ✅ 前三项机验通过（含实测 `dd` 文本）；④「不破版」属**视觉呈现** ⇒ 按本仓分工转**用户验收清单**（§4.3，⛔ 不做浏览器自动化） |
| 5   | 两条 nit                                                                      | ✅ 注释已订正且与 M4 后取值一致；`t671` Y3 改名 + **新增 before 断言** ⇒ 收紧（逐条见 §5）                                   |
| 6   | `Z1` 偶发（flaky?）                                                           | ✅ **不可复现**：单独全仓 ×2 + `Z1` 定向 ×15 = **17/17 绿**；给出「最小复现条件」判断（§6）                                  |
| 7   | 9 项门禁 + 逐项 rc + 精确数字                                                 | ✅ 见 §7（全绿，含双端 build、移动端 0 行）                                                                                  |

## 1. 判据 1：全仓 0 红

| 轮次            | rc    | 文件                   | 例   | 红    | 绿   | skip |
| --------------- | ----- | ---------------------- | ---- | ----- | ---- | ---- |
| 第 1 次（单独） | **0** | 420（419 绿 / 1 skip） | 3322 | **0** | 3316 | 6    |
| 第 2 次（单独） | **0** | 420（419 绿 / 1 skip） | 3322 | **0** | 3316 | 6    |

- **`AC5-⑧` / `AC5-⑨` 已转绿**（`FAIL` 名单为空）；其余 13 条 M0 红线保持绿；`t679`/`t680`/`t682`×2 新增用例全绿。
- 两次运行**数字逐字相同** ⇒ 无抖动。

## 2. 判据 2：`conflictFields` 语义（独立探针 6 例，全绿）

| 边界                   | 构造                                                              | 实测                                                                                                    |
| ---------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| pull **远端胜**支      | 同字段冲突（`priority` high vs low，远端时间更晚）                | `kind='remote-wins'` · `conflictFields === ['priority']`                                                |
| pull **本地胜**支      | 同上，远端时间更早                                                | `kind='pull-local-wins'` · `conflictFields === ['priority']`                                            |
| push **`stale`** 支    | 先 push 撞行级 OCC（同字段冲突）                                  | `kind='stale'` · `conflictFields === ['priority']`                                                      |
| **DEF-146 保存侧**     | 编辑期云端被改（`origin=A0-name` / `cloud=A1-name`），保存 `name` | `kind='pull-local-wins'` · `conflictFields === ['name']` · `loser` 键集 `['id','name']`（快照口径未变） |
| **去重保序**           | `appendConflict({conflictFields:['priority','name','priority']})` | `=== ['priority','name']`（去重且保持传入顺序）                                                         |
| **缺省 / 空 ⇒ 不落键** | 省略 / `conflictFields: []`                                       | `'conflictFields' in entry === false`（两种都验证）· `ConflictListItem` 同样不落键                      |
| **列表透出**           | `listConflicts`                                                   | 有值条目 `item.conflictFields === ['priority','name']`；无值条目不落键                                  |

- **`AC5-⑧` 的等值断言**：`conflictFields === ['priority']`（**多一个字段即失败**）已由全仓绿证明成立；独立探针也逐条核对「只含冲突字段」（合并成功的 `description` 不在其列）。
- `local-database.ts` 的 `ConflictJournalEntry.conflictFields?: string[]` 为 **additive 可选**；`appendConflict` 在 `[...new Set(input.conflictFields ?? [])]` 之后仅当**非空**才落键 ⇒ 旧调用点（不传）行为逐字不变。

## 3. 判据 3：提醒组整组（不得只记单个）

构造：两侧都改整组（我 `daily/08:00/[2]/2026-04-01`，对方 `weekly/09:00/[1,3,5]/2026-03-01`）⇒ pull 本地胜支。

- `conflictFields === ['remindAt','remindRepeat','remindTime','remindWeekdays']`（整组四字段）✅
- `loser` 键集 = `['id'] + 四字段`（整组四字段）✅
- 结果整组取本地、**无混搭**（`remindRepeat='daily'` + `remindWeekdays=[2]`）✅

## 4. 判据 4：面板按字段（真挂载）

### 4.1 独立探针（3 例，`mount` 真 `conflict-list.vue` + 真 `nue-ui`，⛔ 无 stub）

| 用例                                 | 实测                                                                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `conflictFields=['name','priority']` | 字段行 `dt='字段'`、**`dd='名称、优先级'`（逐字实测）**、`class` 含 `conflict-list__meta-row`；`dd` **不含** `name` / `priority`（无技术键名） |
| 提醒组四字段                         | `dd='提醒时间、提醒重复、提醒时刻、提醒星期'`（顺序 = 合并域，不缺项）                                                                         |
| 旧条目（无 `conflictFields`）        | **不渲染**「字段」行；既有「冲突类型」行仍在、「差异详情」仍渲染（回退整行差异）                                                               |

### 4.2 零新 i18n 键

- `git diff --name-only 8356df82..00547744 -- packages/shared` = **0 个文件**；
- 复用的 `sync.conflict.fieldColumn` 在 M5 **之前**已存在（`git show 8356df82:packages/shared/locales/zh-CN.ts | grep -c sync.conflict.fieldColumn` = 1）⇒ **零新键**成立；死键守护未触发。
- 标签来源 = 既有 `conflict-field-labels`（`sync.conflict.field.*`）✓ AC9「无内部术语、零新键」。

### 4.3 ④「桌面 / 窄屏不破版」= **用户验收清单**（本仓分工：视觉呈现由用户人工执行，⛔ 不做浏览器自动化）

前置：PM 在需求分支起本地 dev（`pnpm webapp dev` → `http://localhost:5173`，API 走本地后端），造一条带 `conflictFields` 的冲突（或直接用两端异字段同步产生）。

| #   | 测什么             | 怎么操作                                          | 预期结果                                                                                                | 对应 AC            |
| --- | ------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------ |
| V1  | 字段行出现且说人话 | 打开冲突面板 → 选中一条**同字段冲突**的对象       | 对象信息区多一行「字段」，值为中文标签（如「优先级」「名称」），**不出现** `priority`/`name` 等英文键名 | AC9 / R-7          |
| V2  | 整组提醒不截断     | 让两端各改提醒（不同子字段）产生冲突 → 查看该对象 | 字段行显示**四个**标签（提醒时间 / 提醒重复 / 提醒时刻 / 提醒星期），不折叠、不丢项                     | AC2/AC15           |
| V3  | 旧条目兼容         | 选中 M5 之前产生的冲突条目                        | **无**「字段」行；「差异详情」照常显示（不空、不错位）                                                  | AC8                |
| V4  | **窄屏不破版**     | 把窗口拖到最窄（约 360–420px）再看该面板          | 字段行折行/换行正常，不溢出、不遮挡相邻行；主按钮仍可点（命中区 ≥40px 高）                              | AGENTS.md C 端视觉 |
| V5  | 深色主题可读       | 切深色主题                                        | 字段行文字对比度与相邻 meta 行一致（≥4.5:1），无「浅灰看不见」                                          | DESIGN.md 对比度   |
| V6  | 三态不靠颜色       | 观察字段行                                        | 信息**纯文本**承载（不依赖颜色区分），去色后仍可读                                                      | AGENTS.md §4       |

> V4/V5/V6 是**视觉/体感**项，我按规矩不自动化；你勾选回报后我据以关闭/重开（其余 1–3 已机验）。

## 5. 判据 5：两条 nit

### 5.1 注释订正（与 M4 后取值一致）

- `conflict-title.ts`：原「优先**当前行**（与 `compareConflict` 的 `current` 同源：本地当前行明文）」→ 改为「优先**本地当前行**明文…⚠️ 与 `compareConflict` 的 `current` **不再同源**（`T680/M4` 后带 `serverCurrent` 的条目其 `current` = 服务端当前行；标题职责是『指认我这边这条记录』，与『对比展示用哪一版』正交）」✅
- `use-conflict-ux.ts`：同步改为「数据面只读（`getRecord → recordToEntity` 同一转换链）…⚠️ `T680/M4` 起与 `current` 不再同源」✅
- 与 M4 实测一致（我 680b 已验：带 `serverCurrent` ⇒ `current` 取服务端行；不带 ⇒ 取本地行）⇒ **注释与行为相符**。

### 5.2 `t671` Y3 = **收紧**（逐条 before/after）

| 项            | before（M4 后）                                            | after（M5）                                                         | 判定     |
| ------------- | ---------------------------------------------------------- | ------------------------------------------------------------------- | -------- |
| `it` 名       | 「stale 后若先发生一次 pull ⇒ 面板对比**才**出现双侧差异」 | 「stale 后**无需**再 pull：对比（取 `serverCurrent`）即含双侧差异」 | 名实相符 |
| `before` 断言 | **无**（只 `dump`）                                        | **新增** `beforeFields` 含 `description` + `name`                   | **收紧** |
| `after` 断言  | 含 `description` + `name`                                  | **逐字保留**                                                        | 未放宽   |
| 夹具          | 两侧都改 name+description                                  | 未改                                                                | 不变     |

## 6. 判据 6：`Z1` 偶发（flaky 判定）

| 证据                                                                           | 结果                       |
| ------------------------------------------------------------------------------ | -------------------------- |
| 单独全仓 ×2（无并发；跑前 `pgrep vitest` 确认无其它测试进程、`git status` 空） | **2/2 绿**（且逐字同数字） |
| `t671` **`Z1` 定向重复 15 次**（`-t 'Z1'`，串行）                              | **15/15 绿**               |
| 合计 `Z1` 执行次数（全仓 2 次 + 定向 15 次）                                   | **17/17 绿**               |

**判定：按「≥15 次定向 + 2 次全仓」的强度**，**不可复现**，暂判**非产品 flaky**。

**最可能的最小复现条件（供 PM 记台账）**：rd-fe 观测到的那 1 次发生在**两会话同时跑全仓**、且**双方都在改文件**的窗口内 —— 同 worktree 并发跑会共享 `.vite` 转换缓存与 vitest 临时缓存，加上一侧可能在读另一侧**未提交的在制文件**，比纯 CPU 争用更能解释「一次性、随后 4+2 次全绿」。
⇒ **建议把门禁纪律补一条**：全仓门禁**只在「工作区干净（无他人未提交改动）+ 无并发测试」时跑**。本轮我已按此执行（跑前双重确认）。
⚠️ **同时披露**：我 `681b` 那一轮的全仓数字是在 rd-fe M5 **在制改动**存在时跑的（当时文件数 418 与其在制状态一致），**该轮数字不应作为干净基线**；本轮两次单独全跑（420 文件 / 3322 例 / 0 红）**取代**之。

## 7. 判据 7：全量门禁（9 项，逐项 rc）

| #   | 命令                                                                | rc        | 关键行                                                                                  |
| --- | ------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------- |
| ①   | `pnpm exec vp check`                                                | **0**     | All **1935** files correctly formatted · no warnings/lint/type errors in **1550** files |
| ②   | `pnpm exec vp test --run`（单独 ×2）                                | **0 / 0** | **420 文件（419 绿 / 1 skip）· 3322 例（3316 绿 / 6 skip / 0 红）**（两轮逐字相同）     |
| ③   | `pnpm run guard:ddd`                                                | 0         | OK                                                                                      |
| ④   | `pnpm exec vp run webapp build`                                     | 0         | ✓ built in 14.40s                                                                       |
| ④   | `pnpm run desktop:build`                                            | 0         | ✓ built（renderer 333.53 kB）                                                           |
| ⑤   | `git status --porcelain -- packages/presentation-react apps/mobile` | —         | **0 行**                                                                                |
| ⑥   | `pnpm run guard:gate-pathspec`                                      | 0         | OK                                                                                      |
| ⑦   | `pnpm run guard:barrel-imports`                                     | 0         | OK                                                                                      |
| ⑧   | `pnpm run guard:mobile-imports`                                     | 0         | OK（72 源文件）                                                                         |
| ⑨   | `pnpm run guard:test-location`                                      | 0         | OK（412 受检测试文件）                                                                  |

## 8. 哈希闸（三段式）

- **① 开工时 15 路径逐一相等** ✓（相对 `8356df82` 的基线；`git diff 8356df82..00547744 -- <15 路径>` = **空**；M5 的 10 个改动文件里**没有**我的路径）

```text
34bb5b28 ac1   76fd4258 ac2   efe108ed ac3   f1bb1d3e ac4   3fc815aa ac5
5a8a1d55 ac6   77ffa022 harness  c971079b remind-group  5d938eb9 mode-lww  2ff259a0 write-point
6d61a225 red-baseline  1c491e04 m1-verify  b16534c0 m2-verify  5dfb3521 m3-verify  9ac3130d m4-verify
```

- **② 新增第 16 份** = 本报告 `docs/reports/340-field-merge-m5-verify.md`（blob 哈希见回执）。
- **③ 结束后 16 路径表**（含本报告新哈希）与两条 `git diff` 证据见回执。

## 9. 遗留（三出口）

- **转办（用户走查）**：§4.3 的 **V1–V6** 视觉/窄屏验收清单（本地 dev，用户勾选回报）。V1–V3 我已机验，V4–V6 需人眼。
- **转办（PM 台账）**：§6 的「全仓门禁须工作区干净 + 无并发」纪律；`Z1` 一次性观测的**判定与依据**（17/17 绿 → 暂判非产品 flaky，若再现请给失败断言原文再开）。
- **接受（到期日 = B 批收口）**：M5 面板以「对象信息区一行文本」呈现字段（非卡片式），与 `AGENTS.md` C 端视觉原则不冲突（既有 meta 行同构）；若用户走查 V4/V5 不通过，按视觉缺陷单开。
- **无关闭项**：本轮为复核，未改库存代码、未新增缺陷条目。

## 10. 复跑

```text
git log --oneline -1                                                              # 期望 00547744
pgrep -af "vitest|vp test" && git status --porcelain                              # 期望：无测试进程 / 干净
pnpm exec vp test --run                                                           # 期望 rc=0 · 420 文件 / 3322 例 / 0 红
pnpm exec vp test --run packages/infrastructure/src/persistence-sync/__tests__/t671-qa-diff-field-probe.test.ts -t 'Z1'   # 期望 1 绿（可重复 15 次）
pnpm exec vp check && pnpm run guard:ddd && pnpm run guard:gate-pathspec && pnpm run guard:barrel-imports && pnpm run guard:mobile-imports && pnpm run guard:test-location
pnpm exec vp run webapp build && pnpm run desktop:build
```