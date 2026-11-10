# M20261110 · 挂账清理批：批末独立复验（`DEF-149`/`DEF-153` 客户端 · `DEF-157`/`DEF-141` 服务端）

- 日期：2026-11-10 · Owner：qa · 级别：**done(full)**
- 客户端：分支 `nao/M20261110-def-pool-cleanup` · HEAD **`88f11117`**（18 文件 +811/−5）· ⛔ 未改生产代码 / 未改既有断言（唯一既有测试变更 = `t663`，已申报，见 §5）
- 服务端：`nao-todo-server` 分支 `chore/def-157-141` · HEAD **`f690c9c`**（5 文件 +216/−3）· 只读复核 + 本地跑测（另用 `d11b6fc` worktree 做基线归因）
- 独立探针 **22 例**（14 + 4 + 4）跑完删除、未入库；复验后工作区仅剩 PM 的 `docs/tasks-state.md`（`MM`，未触碰）

## 0. 结论总表

| #        | 判据                                                             | 结论                                                                                                                                |
| -------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 客户端 1 | **`DEF-153` 命门**：`O` 冻结于交互起点，非保存时现取 store       | ✅ 反例探针证明「冻结后 store 被刷新推进 ⇒ 仍判 1 条」；反证「用当前值当 O ⇒ 0 条」⇒ **判据有牙**                                   |
| 客户端 2 | 六字段矩阵 × (远端改过 / 未改)                                   | ✅ 12/12 符合（改过 ⇒ 1 条且 loser 含该字段；未改 ⇒ 0 条）；`name`/`description` 零回归（`t669`/`t670`/`t682` 全绿）                |
| 客户端 3 | 接线真挂载 ≥3 处                                                 | ✅ **4 处真实组件交互**（header 勾选 / main 下拉区 / 日期面板 / 标签编辑态），含**调用顺序**（冻结 → 保存）                         |
| 客户端 4 | `DEF-149` 非破坏语义                                             | ✅ 4/4：行与输入框保留 + 非阻塞提示可见（人话）+ 空原因走兜底 + 首进失败仍阻塞式                                                    |
| 客户端 5 | `t663` 断言变更 = 契约变更而非放宽                               | ✅ 判定**成立且更强**（新增内容保留断言）；已独立补验「文案是人话、无裸错误码」（建议其并入用例，见 §5.2）                          |
| 服务端 1 | `Claims2JWTClaimsVO` 不解引用、四子场景 `200+10041`、无 500 空体 | ✅ 用例 4 子场景全过（HTTP 200 + code 10041）；唯一调用点已适配双返回；`503` 用例仍绿                                               |
| 服务端 2 | `seedUser` 幂等（`Unscoped()`）                                  | ✅ 代码确认 + 实测**同一库连跑无 `1062`**                                                                                           |
| 服务端 3 | 同一库连跑 2 次 integration                                      | ✅ 第 1/2 次同库**结果一致**（32 包 ok + **仅 1 条已知 DEF-158**）；跳过该已知用例 ⇒ **33 包 ok / 0 失败**（`-p 1` 前提，见 §6-F1） |
| 服务端 4 | 未碰 503 映射 / 告警 / gorm logger                               | ✅ 5 个改动文件全部在 identity 转换/仓储 + 两个测试；`503` 用例仍通过                                                               |
| 服务端 5 | `docker-compose.yml` 未入提交                                    | ✅ 提交文件清单无它（工作区那份 `M` 属本地环境改动，未动）                                                                          |
| 门禁     | 客户端 9 项 + 服务端 6 项                                        | ✅ 见 §7（客户端全仓 **0 红**；服务端 build/vet/gofmt/lint/unit 全绿）                                                              |

## 1. 客户端判据 1：`DEF-153` 命门（反例探针，2 例）

场景与实现无关、只看判据：`pickOverwrittenFields(cloud=R, payload=L, origin=O)`。

| 步骤                                      | 操作                                                           | 实测                                                                    |
| ----------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| ① 交互起点冻结                            | `O = { priority: 'medium' }`（= 当前已持久化值）               | —                                                                       |
| ② 期间「30s 自动刷新」推进 store / 本地行 | 远端把 priority 改 `low` ⇒ `pullAll()` ⇒ 本地 `priority='low'` | 本地值已推进 ✅                                                         |
| ③ 用户选 `high` 保存（用**冻结的** O）    | `repo.update(id, {priority:'high'}, O)`                        | **1 条** `pull-local-wins` · `loser.priority='low'`（被覆盖的云端值）✅ |
| 反证：用**当前值**当 O                    | 同一场景，`O = 'low'`（store 现值）                            | **0 条**（`cloud == O` ⇒ 不记）⇒ 证明该探针能区分两种实现 ✅            |

> 若实现退回「保存时现取 store 值当 `O`」，`O` 会被刷新推进成 `low` ⇒ 判 0 条 ⇒ **用户覆盖云端的行为不可见**（`DEF-145` 教训复现）。本探针即为该回归的守门。

## 2. 客户端判据 2：六字段矩阵（12 例）

每字段两条：「远端改过同字段 ⇒ 我保存 ⇒ 1 条（`loser` 含该字段）」/「远端未动 ⇒ 0 条」：

| 字段           | 起点 `O`       | 远端 `R`       | 我保存 `L`    | 远端改过 | 远端未动 |
| -------------- | -------------- | -------------- | ------------- | -------- | -------- |
| `state`        | `todo`         | `done`         | `in-progress` | 1 条 ✅  | 0 条 ✅  |
| `priority`     | `medium`       | `low`          | `high`        | 1 条 ✅  | 0 条 ✅  |
| `starMarkAt`   | 01-01          | 02-01          | 03-01         | 1 条 ✅  | 0 条 ✅  |
| `tags`         | `['t-origin']` | `['t-remote']` | `['t-mine']`  | 1 条 ✅  | 0 条 ✅  |
| `parentTaskId` | `p-origin`     | `p-remote`     | `p-mine`      | 1 条 ✅  | 0 条 ✅  |
| `startAt`      | 01-02          | 02-02          | 03-02         | 1 条 ✅  | 0 条 ✅  |

- `name` / `description` **零回归**：`t669-edit-overwrite` / `t670-qa-edit-overwrite-probe` / `t682-conflict-fields` 全绿（全仓 0 红）。
- 判据未变（我另核）：`F = keys(载荷) ∩ keys(基准)`、逐字段 `R≠O 且 L≠R`、比较一律 `valuesEqual`（`edit-overwrite.ts` 本次 **零 diff**）。

## 3. 客户端判据 3：接线真挂载（4 处，⛔ 非源码 grep）

用真实组件 + 真实 `nue-ui` 挂载，注入上下文并**触发真实交互**：

| #   | 位置                       | 交互                                       | 断言                                                                                             | 结果 |
| --- | -------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------ | ---- |
| ①   | `task-details/header`      | 点真实 `TaskCheckButton` ⇒ `change`        | 调用序列 = `['beginEdit:state', 'updateTaskDetails']`（**冻结在保存之前**）                      | ✅   |
| ②   | `task-details/main` 下拉区 | 点承载两个 `TaskSelector` 的真实 `nue-div` | `beginEdit('state')` + `beginEdit('priority')`，且 **`updateTaskDetails` 未被调用**（打开≠保存） | ✅   |
| ③   | `date-selector`            | 真实 `NueDropdown` `beforeOpen`            | 组件发 `edit-start` × 1                                                                          | ✅   |
| ④   | `tag-bar`                  | 真实 `NueDropdown` `beforeOpen`            | 组件发 `editStart` × 1（camel）                                                                  | ✅   |

> 说明：rd-fe 的 `t688-def153-wiring` 对 ②③④ 中的 header/main 两处是**源级守卫**（其注释自陈「交互链路依赖真实下拉」）；本条用真实挂载补齐了 PM 要求的「抽 3 处真实交互」，额外覆盖顺序断言。

## 4. 客户端判据 4：`DEF-149`（4 例）

| 场景                                     | 断言                                                                                                                                                        | 实测 |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 有已渲染行 + 刷新失败（原因 `网络错误`） | 2 行保留 · `.subtask-row__create-bar` 存在 · 文本含「刷新失败」「网络错误」「正在显示上次加载的内容」· **不含** `subTasksRefreshError` / `Error:` / `ECONN` | ✅   |
| 空原因（两态 `''`）                      | 仍可见（走 `task.refreshFailedGeneric` 兜底）+ 行保留                                                                                                       | ✅   |
| 无失败（`null`）                         | 不渲染提示条                                                                                                                                                | ✅   |
| 首进失败（阻塞式错误 + 0 行）            | 仍显示阻塞式「子任务获取失败…」⇒ **不吞真错误**                                                                                                             | ✅   |

## 5. 客户端判据 5：`t663` 断言变更判定（**契约变更，非放宽**）

### 5.1 before / after 逐条

| 项         | before                                | after                                                                          | 判定                                                          |
| ---------- | ------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| 失败可见性 | `wrapper.text()` 含「子任务获取失败」 | `wrapper.text()` 含「刷新失败」                                                | **等价**（仍是可见文案；且新文案是正确语义）                  |
| 状态来源   | `api.subTasksError !== ''`（阻塞式）  | `api.subTasksRefreshError !== null`（非阻塞两态） + `api.subTasksError === ''` | **契约变更**（本缺陷正是要修掉「阻塞式 + 整块替换」），非放宽 |
| 内容保留   | 未断言                                | `.subtask-row` 数量 > 0 + `.subtask-row__create-bar` 存在                      | **新增（更强）**                                              |
| 加载态     | 不卡加载                              | 保留                                                                           | 等价                                                          |

⇒ **旧意图（失败可见）被完整覆盖**，且**新增了「用户正在输入的内容不被卸载」这一原报障点的断言** ⇒ 我判定 **不是弱化**。

### 5.2 建议补强（P3，非阻塞）

新增断言只校验「含『刷新失败』」，未校验**文案是人话**。我已在独立探针里补验（无 `subTasksRefreshError` 键名、无 `Error:` 前缀、无 `ECONN` 裸码）——建议把其中 1 条并入 `t663`（或 `t688-def149-*`）作为长期护栏，避免未来把原始错误串直接透出。

## 6. 服务端判据

### 6.1 `DEF-157`（①）

- `Claims2JWTClaimsVO` 改双返回：`c == nil` / `c.IssuedAt == nil` / `IssuedAt.IsZero()` ⇒ 显式错误、**不解引用**；`jwtRepoImpl.Parse` 上抛 ⇒ 既有「解析失败 ⇒ 200 + 10041」路径。
- **调用点**：全仓仅 `jwtRepoImpl.go:50` 一处（已适配）✅。
- **四子场景实测**（中间件端到端）：缺少 `iat` / `iat` 为 `null` / `iat` 为非数字 / 非法签名（真失效回归）⇒ 全过；用例断言 = `HTTP 200 + code 10041` 且断言响应体，**不再出现 500 空体** ✅。
- 附：`TestJWTValidator_StoreUnavailable_Returns503` 仍绿 ⇒ 503 映射未被牵连 ✅。

### 6.2 `DEF-141`（②③）

- `seedUser` 先 `Unscoped().Where("id = ?", userID).Delete(&models.User{})` 再插入（软删行也不留残余）✅（读码确认）。
- **同一库连跑（`nao_todo_test`，`-p 1`）**：

| 轮次    | DB 状态             | 结果                                                                   |
| ------- | ------------------- | ---------------------------------------------------------------------- |
| 第 1 次 | 重建后（干净）      | **32 包 ok**，1 失败 = `TestGetDueReminders_ExcludesInactive`（见 F2） |
| 第 2 次 | **同一库不重置**    | **与第 1 次逐条一致**（32 ok + 同一失败），**`1062` 撞主键 = 0** ✅    |
| 第 3 次 | 同一库，跳过已知 F2 | **33 包 ok / 0 失败 / rc=0** ✅                                        |

### 6.3 未触碰面（④⑤）

- 提交 5 文件：`converters.go` / `converters_jwtClaims_test.go` / `jwtRepoImpl.go` / `sync_field_loss_integration_test.go` / `jwtValidator_invalidIssuedAt_test.go` ⇒ **无** 503 映射 / 告警 / gorm logger / `docker-compose.yml` ✅。

## 7. 门禁

### 7.1 客户端（9 项）

| #    | 命令                                                                                   | rc      | 关键行                                                                        |
| ---- | -------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------- |
| ①    | `pnpm exec vp check`                                                                   | **0**   | All **1948** files formatted · no warnings/lint/type errors in **1557** files |
| ②    | `pnpm exec vp test --run`（洁净前提：无并发测试进程 + 仅 PM 的 `tasks-state.md` 在制） | **0**   | **427 文件（426 绿 / 1 skip）· 3366 例（3360 绿 / 6 skip / 0 红）**           |
| ③    | `guard:ddd`                                                                            | 0       | OK                                                                            |
| ④    | `vp run webapp build` / `desktop:build`                                                | 0 / 0   | 17.23s / renderer 333.87 kB                                                   |
| ⑤    | 移动端 diff                                                                            | —       | **0 行**                                                                      |
| ⑥⑦⑧⑨ | `gate-pathspec` / `barrel-imports` / `mobile-imports` / `test-location`                | 0/0/0/0 | `test-location` 419 文件                                                      |

### 7.2 服务端（6 项）

| 命令                                        | rc    | 关键行                                     |
| ------------------------------------------- | ----- | ------------------------------------------ |
| `go build ./...`                            | 0     | —                                          |
| `go vet ./...`                              | 0     | —                                          |
| `gofmt -l .`                                | 0     | 输出为空                                   |
| `golangci-lint run ./...`                   | 0     | `0 issues.`                                |
| `go test ./...`（单元）                     | 0     | 0 FAIL                                     |
| `go test -tags integration -p 1` ×2（同库） | 1 / 1 | 仅 F2 已知失败；跳过 F2 的第 3 次 **rc=0** |

## 8. 发现（不影响本批结论，但需 PM 记录）

- **F1（CI 卫生）**：integration **必须 `-p 1`**（或每包独立库）。默认 `-p=NumCPU` 时多包**并行写同一测试库** ⇒ 我首次跑 `./...` 出现 4 条 `interfaces/controllers` 失败（`record not found` / `server_error`），而**单独跑该包全过** ⇒ 属**跨包并行干扰**，非代码缺陷。建议在 CI 与复验脚本固化 `-p 1`。
- **F2（既有，非本批）**：`TestGetDueReminders_ExcludesInactive`（`infrastructure/persistence/task`）在**基线提交 `d11b6fc` 上同样失败**（我在临时 worktree 复跑确认），且 `TZ=UTC` 下仍失败 ⇒ 与本批改动**无关**，即客户端台账已登记的 **`DEF-158`（P3，时区依赖）**。⇒ 本批「integration 全绿」按字面**不可达**，建议 PM 决策：修 `DEF-158` 或 CI 显式 `-skip`（我第 3 次跑即用 `-skip` 得到 0 失败）。
- **F3（P3 建议，见 §5.2）**：`t663` 补一条「文案是人话（无内部键名 / 无裸错误码）」断言。

## 9. 遗留（三出口）

- **转办（PM）**：F2 的处置（修 `DEF-158` 或 CI `-skip`）；F1 固化 `-p 1` 到 CI/复验脚本。
- **转办（RD，可选）**：F3 的 1 条断言补强（不阻塞本批）。
- **接受（到期日 = 下次清理批）**：`DEF-158` 维持 P3（本批未扩大）。
- **无关闭项**：本轮为复核，未改库存代码、未新增缺陷条目。

## 10. 复跑

```text
# 客户端
cd /home/nathan/Projects/nao-todo && git log --oneline -1        # 期望 88f11117
pgrep -af "vitest|vp test"; git status --porcelain               # 期望：无测试进程 / 仅 PM 的 tasks-state.md
pnpm exec vp test --run                                          # 期望 rc=0 · 427 文件 / 3366 例 / 0 红
pnpm exec vp check && pnpm run guard:ddd && pnpm run guard:gate-pathspec && pnpm run guard:barrel-imports && pnpm run guard:mobile-imports && pnpm run guard:test-location
pnpm exec vp run webapp build && pnpm run desktop:build

# 服务端（需先有 MySQL 8 + Redis；DSN/口令取本地 .env，勿外泄）
cd ~/Projects/nao-todo-server && git log --oneline -1           # 期望 f690c9c
go build ./... && go vet ./... && gofmt -l . && "$(go env GOPATH)/bin/golangci-lint" run ./...
go test ./...
# integration 必须 -p 1（F1）
NAO_TEST_MYSQL_DSN=... NAO_TEST_REDIS_ADDR=... go test -tags integration -p 1 -count=1 ./...
```