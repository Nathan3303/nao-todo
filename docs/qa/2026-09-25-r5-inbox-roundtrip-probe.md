# T187 · R-5 受控探针：单任务脱归档 → `'inbox'` 经 push/pull 往返是否从收集箱「消失」

- **任务**：T187（qa · 派生会话 `qa-T187`）｜来源：`docs/qa/2026-09-25-project-archive-acceptance.md` §7④ 静态推断
- **客户端仓库**：`nao-todo` @ `feat/99-project-archive`（基线 `d98f9f2b`）
- **服务端仓库**：`nao-todo-server` @ `feat/99-archive-server`（`1c29a69`，即终验报告 §6 核对版本）
- **边界遵守**：⛔ 不改实现 · ⛔ 不改基线 · ⛔ 移动端零改动（`git status --porcelain -- packages/presentation-react apps/mobile` = **0**）· 只跑探针相关面
- **结论**：**② 实测未消失（推断的「推送侧归一」不成立）** —— 见 §0 / §4

> **【T188 修复后注记 · T190 复验，2026-09-25】**（本报告为**修复前（基线 `b7bb3305`）实测留痕**，§0/§4 的判定与 §3 的 S2「反事实」口径**全部保留为历史**）
>
> `T188`（`rd-fe`，代码提交 **`e4b0bbe7`**，父 `a7d5aa85`）已按 ADR §16 落地 **C（写侧 `'inbox'` → `''`）+ B（读侧 `userId` → `'inbox'`）**，且 **C 与 B 同一提交**（`git show --stat e4b0bbe7`：`sync-service.ts` +26/−1、探针 `+43/−40`、新增回归 `+246`）⇒ **`DEF-37` 闭环**。含义：
>
> 1. 本报告 §4「本路径实际缺陷：变更同步不到服务端」**已消除** —— 写侧归一后服务端 create/push 不再 `error`；
> 2. **S1 由「不消失」升级为「往返闭环」证据**（载荷 `''` · `outcome applied` · 队列**已出队** · pull 归一回 `'inbox'` · 收集箱命中）；
> 3. **S2 由「反事实：不命中」转为「正向不变量：必须命中」**（防读侧归一被静默回退）。
>
> `T190` 已在新 HEAD `44b464f1` 独立复跑全部 8 项门禁 + 自建端到端探针复现上述 5 点（见 `docs/qa/2026-09-25-project-archive-acceptance.md` §9）。

---

## 0. 结论（一句）

**通过 App 实际同步链路（local-first `sync-service` → `/sync/push`），本批新路径「单任务脱归档 ⇒ `projectId='inbox'`」不会从收集箱消失**：服务端**推送入口走 `CreateTask`（create 路径）**，该路径对字面量 `'inbox'` **直接报错、不做归一**（`ParseID('inbox')` 失败），故归一**从未发生**；任务留在本地收集箱，但**该变更永远同步不到服务端**（队列项业务退避、长期积压）——这是与「消失」**不同的、已被服务端源码实测确证**的缺陷（§2/§5）。

**但静态推断并非全错**：其**读侧半程成立** —— 一旦某条收集箱任务以 `projectId = userId`（隐式桶）经 pull 落库，本地 `a === 'inbox'` 字面过滤**确实不再命中**（§3 S2）。即：**「推送侧会归一」为假 ⇒ ②；「读侧字面过滤脆弱」为真 ⇒ R-5 作为既有读侧缺口仍成立。**

> 条件反转：若发布所用的服务端在 create 路径也接受 `'inbox'`（例如复用 update 路径语义 / 把 create 对齐 update），则本推断**立即变为①**。因此本结论**绑定服务端版本 `1c29a69`**（§6 修法 A 正是把该版本对齐 ⇒ **修法 A 必须与修法 B 同批**）。

---

## 1. 探针设计（两段独立证据 + 服务端源码实测）

| 段         | 位置              | 手段                                                                                                                                          | 目的                                                      |
| :--------- | :---------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------- |
| **服务端** | `nao-todo-server` | 临时 Go 单测直接调用 `CreateTaskReqToValueObject` / `UpdateTaskReqToValueObject` / `TaskEntityToGetRes`（真源函数，不复制逻辑；**测后删除**） | 判定 create/update/pull 三处对 `'inbox'` 的真实行为       |
| **S1**     | 客户端探针        | 真 `LocalTaskRepoImpl.unarchive` + 真 `SyncService.pushAll/pullAll`，mock server 复现 Go create 路径语义（`'inbox'` ⇒ error）                 | 测「实际链路」的端到端结果                                |
| **S2**     | 客户端探针        | 同上游，但 mock server **反事实地**接受 `'inbox'` 并回传 `userId`（= 修法 A 之后 / update 路径语义）                                          | 隔离「读侧」半程，验证本地 `'inbox'` 字面过滤的真实脆弱性 |

---

## 2. 服务端源码实测（真源，非复述）

**临时探针** `application/task/zz_t187_r5_probe_test.go`（**已删除**，内容见 §附录）：

```bash
cd /home/nathan/Project/nao-todo-server
go test ./application/task/ -run TestT187R5ProbeInboxNormalization -v
```

**输出（4 条断言 + PASS，exit 0）**：

```text
--- PASS: TestT187R5ProbeInboxNormalization (0.00s)
    create/sync-push 路径 projectId='inbox' ⇒ error=strconv.ParseInt: parsing "inbox": invalid syntax
    create 路径 projectId='' ⇒ ProjectId=1001
    update 路径 projectId='inbox' ⇒ ProjectId=1001
    pull/GET 出参 ProjectId="1001" (FormatID="1001")
ok  naotodoserver/application/task  0.010s
```

| 路径                                         | 真源位置                                                                                                                               | `'inbox'` 行为                    | 对本命题的意义                                |
| :------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------- | :-------------------------------------------- |
| **create / `sync push`**                     | `application/task/converters.go:54-73`（`CreateTaskReqToValueObject`）；入口 `interfaces/controllers/sync.go:113` `taskApp.CreateTask` | **error**（`ParseID` 失败）       | **归一未发生** ⇒ R-5 的推送侧前提为假（§4-②） |
| update（`PUT /tasks/:id`，客户端 sync 不走） | `converters.go:130-139`                                                                                                                | 归一为 `userId`                   | 与 ADR「等价归一」一致，但**不是 push 路径**  |
| list 过滤                                    | `converters.go:206`（`splitProjectIds`）                                                                                               | 归一为 `userId`                   | 同上                                          |
| pull / `GET` 出参                            | `converters.go:33`（`FormatID(ProjectId)`）                                                                                            | 输出 `"1001"`（**非 `'inbox'`**） | 读侧缺口的根因（ADR §1.3-C3）                 |

> ⚠️ **对既有文档的事实更正（供 PM/arch 登记）**：ADR `2026-09-24-project-archive.md` §1.3-C2 / §4-Q4 / §9-§5 的表述「服务端 `''`/`'inbox'` **等价归一**为隐式桶 `userId`」，在 **create/sync-push 路径上不成立**（仅 update + list 成立）。引用行号 `converters.go:133`（update）与 `:206`（list）均不含 create。此为本探针新发现，非本批引入。

---

## 3. 客户端受控往返实测

**探针文件（保留）**：`packages/infrastructure/src/persistence-sync/__tests__/t187-r5-inbox-roundtrip.probe.test.ts`

```bash
pnpm exec vp test --run packages/infrastructure/src/persistence-sync/__tests__/t187-r5-inbox-roundtrip.probe.test.ts
# → Test Files 1 passed (1) / Tests 2 passed (2) / 0 red；Duration ~2.4–3.0s
```

### S1（实际链路 · 服务端 HEAD 语义）— **绿**

前置：归档清单 P + 其下已归档任务 T（两端同 id 基线）→ `LocalTaskRepoImpl.unarchive(T)` ⇒ 断言本地 `projectId === 'inbox'`、`archivedAt === null`、`movedToInbox === true`。随后 `SyncService.pushAll()` + `pullAll()`（mock server：push 复现 create 路径 `'inbox'` ⇒ `outcome='error'`；pull 回原服务端行 `projectId=P`、归档态、旧 `updatedAt`）。

| #   | 断言                                                                    | 结果 | 证据                  |
| :-- | :---------------------------------------------------------------------- | :--- | :-------------------- |
| 1   | 线上载荷 `body.tasks[0].projectId === 'inbox'`（字面量，非 `''`）       | ✅   | 探针断言              |
| 2   | 服务端回执 `outcome === 'error'`（`ParseInt "inbox"`）                  | ✅   | 探针断言              |
| 3   | 队列项保留（`syncTracker.listDirty` 含 T）                              | ✅   | 探针断言              |
| 4   | pull 后本地 `record.projectId === 'inbox'`（LWW 本地脏且更新 ⇒ 不覆盖） | ✅   | 探针断言              |
| 5   | **收集箱过滤命中** `list('projectId=inbox')` 含 T                       | ✅   | 探针断言 ⇒ **不消失** |

### S2（反事实：归一成立 · 读侧半程）— **绿**

同前置；mock server 接受 `'inbox'`（回 `applied` + 更新的 `serverUpdatedAt`），pull 回 `projectId="1001"`（`FormatID(userId)`）。

| #   | 断言                                                                 | 结果 | 证据                                        |
| :-- | :------------------------------------------------------------------- | :--- | :------------------------------------------ |
| 1   | pull 落库原样写 `record.projectId === '1001'`（无 `'inbox'` 反归一） | ✅   | 探针断言                                    |
| 2   | 收集箱过滤**不命中** T                                               | ✅   | 探针断言 ⇒ 读侧缺口成立（① 在该假设下成立） |

**读侧链路**：`persistence-sync` `putPulledRecord` → `persistence-local/converters/task.ts` `taskEntityToRecord`（`projectId` 原样透传）→ `persistence-local/repos/task-repo-impl.ts` `list()` `r.projectId === query.projectId`（字面比较）。

> **【T190 注记 · 上表为修复前口径】**：`T188` 落地 C+B 后，探针文件 `t187-r5-inbox-roundtrip.probe.test.ts` 的断言已**正向化**（分组语义 S1/S2 保留）：**S1** = 写侧 `''` ⇒ `applied` ⇒ **出队**；读侧 pull 回 `userId` ⇒ 落库归一回 `'inbox'` ⇒ **命中**（闭环）；**S2** = 读侧归一结果经 pull ⇒ 本地**必须** `'inbox'` ⇒ 收集箱**必须命中**。⇒ §3 上表的 S1「不消失」与 S2「不命中」**均为历史**，现状见 `T188` 报告与 `T190` 独立探针（`t190-def37-e2e.probe.test.ts`，4 例）。

---

## 4. 判定与归因

- **② 实测未消失** —— 通过 App 实际链路：服务端 create/push 路径拒绝 `'inbox'`，归一未发生；本地队列项保留、pull LWW 保护 ⇒ **收集箱仍命中该任务**。
- **静态推断的错点**：把服务端 **update 路径**（`converters.go:133`，`'inbox'` ⇒ `userId`）的语义**外推到了 create/sync-push 路径**；后者实为 **error**。
- **静态推断的对点**：**读侧**（pull 落库 `userId` + 本地字面 `'inbox'` 过滤）确实脆弱 —— 只要服务端存在/回传 `projectId = userId` 的收集箱行（无论由 `''` 创建、PUT 归一，或未来修法 A 产生），本地收集箱即不命中（S2）。
- **本路径实际缺陷（新确证，与本批相关）**：脱归档到收集箱的**状态变更无法同步到服务端**（push 恒 error + 业务退避，队列项不出队、无上限丢弃）——跨设备仍看到「归档在 P 中」。
- **既有性**：服务端 create 路径行为 = 既有（`1c29a69` 及此前的 `e4f63dd`/`abdf5f6` 均未改 create 的 `'inbox'` 分支）；读侧缺口 = ADR 明载既有（R-5）。本批新增的是**入口**（unarchive 写 `'inbox'`），不改变底层行为。

---

## 5. 影响面评估

| 面                                   | 是否可达                                | 说明                                                                                                                                                                                                                           |
| :----------------------------------- | :-------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Web / Desktop**                    | ✅ **本批新入口可达**                   | 单任务脱归档（footer `execute-id=unarchive-todo`）⇒ 本地 `'inbox'` ⇒ push error ⇒ 该变更不入服务端（本地视图正常）                                                                                                             |
| **同一 store 的其它 `'inbox'` 写入** | ⚠️ **既有、可能同型（建议另立单核实）** | 任何经本地仓储写成 `'inbox'` 且走 sync push 的写（如「移动到收集箱」`task-project-selector` value=`'inbox'`）同样会 push error；`use-creator.ts:64` 默认 `projectId=''`（另有 `''` ⇒ userId 的读侧缺口路径）⇒ 建议单独立项核面 |
| **Mobile（`presentation-react`）**   | ⚠️ **读侧既有缺口，本批零改动**         | 移动端亦按字面 `'inbox'` 过滤（`task-filter-core.ts:124`）；若其数据源返回 `userId` 则同样不命中。本批未触碰移动端，属既有 R-5 面（与 ADR C3 一致）                                                                            |
| **服务端**                           | —（只读实测）                           | `1c29a69` create 路径 `'inbox'` ⇒ error；未见其它入口                                                                                                                                                                          |
| **数据安全**                         | ✅ 无丢失                               | 本地记录与队列项均保留（不触发 delete/墓碑）；仅「服务端持久化」缺失                                                                                                                                                           |

**是否本批放大**：本批**新增了一个可达入口**（脱归档），但底层 create 路径拒绝行为**既有**；读侧缺口**既有**。⇒ 不构成本批回归，但**不应以「已过测试」掩盖**：本批路径的用户可见承诺（「已移入收集箱」）在**跨端同步层面不成立**。

---

## 6. 修法选项（**仅评估，未实施**）

| 选项                              | 内容                                                                                                                                                                                           | 代价 / 风险                                                                                                                                                                      |
| :-------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A（服务端对齐，推荐之一）**     | `CreateTaskReqToValueObject` 把 `"inbox"` 视同 `""` ⇒ `userId`（与 update/list 对称）。**1 行 + 单测**。                                                                                       | 低。但**单独实施会立刻让 ① 成真**（push 成功 + pull 回 `userId` ⇒ 收集箱消失）⇒ **必须与 B 同批**。服务端仓库改动需 rd-be / 跨仓 PR。                                            |
| **B（客户端读侧归一，根治 R-5）** | 在 **pull 落库边界**把收集箱隐式桶归一：`sync-service.putPulledRecord` 已有 `userId` ⇒ `projectId === userId` 时写 `'inbox'`（或 `taskRecordToEntity` 加 userId 形参）。**核心 1 处 + 回归**。 | 中。改读边界；须覆盖 web/desktop/persistence-go 各读路径，**移动端按「零改动」需确认其数据源是否需要同归一**（否则移动端仍缺口）。**单独实施不解决 push error**（S1 仍 error）。 |
| **C（客户端写侧归一，最低成本）** | `buildTaskPush` 把 `'inbox'` 发送为 `''`（服务端 create 归一到 `userId`，不再 error）。**1 处 + 测试**。                                                                                       | 低（不碰服务端）。但**单独实施同样触发 ①**（push 成功 + pull 回 `userId`）⇒ **必须与 B 同批**；且与 ADR Q4「写 `'inbox'`」在**线上表示**上略有张力（本地/搜索面仍 `'inbox'`）。  |
| **D（只登记 + 发布说明）**        | 不改代码：把「脱归档到收集箱的变更不入服务端（队列积压）」登记为已知缺陷并写入发布说明。                                                                                                       | 零成本；但用户可见不一致（本地移入收集箱、跨端不同步），且队列长期积压。                                                                                                         |

**推荐组合**：**B + A**（服务端数据面保持 `'inbox'` 语义、读侧闭环）或 **B + C**（纯客户端闭环、服务端零改动）。**任何含 A 或 C 的组合都必须含 B**，否则会把「push 静默失败」升级为「收集箱任务消失」（更坏）。

---

## 7. 探针文件处置 · 交付检查

- **保留**：`packages/infrastructure/src/persistence-sync/__tests__/t187-r5-inbox-roundtrip.probe.test.ts`
    - **红/绿**：S1 = 绿（断言当前真实链路**不消失**）；S2 = 绿（断言**归一成立时**读侧不命中）。
    - ⚠️ **S2 是「反事实守卫」**：修法 A/B/C 落地后，S2 的「不命中」断言会**转红** ⇒ 届时应把 S2 改为「**必须命中**」的正向不变量（防止修复被静默回退）。已在文件头注明。
    - **【T190 注记】**：`T188` 落地后本文件已按上述预告执行 —— **S2 已改为「必须命中」正向不变量**、**S1 已升级为「写侧 `''`/`applied`/出队 + 读侧回 `'inbox'`/命中」的往返闭环**；`T190` 实测 **1 文件 / 2 例 / 0 红**。分歧仅存在于历史文档（本报告 §3），探针文件本身与现状一致。
- **一次性**：服务端 Go 探针 `application/task/zz_t187_r5_probe_test.go` 已**测后删除**（`git status` 无残留）；server repo 现存改动均为**他人**在制（project archived 过滤），与本探针无关。
- **面回归（精确数字）**：
    - 探针文件：**1 文件 / 2 例 / 0 红**（`pnpm exec vp test --run <probe>`）。
    - 受影响面：`pnpm exec vp test --run packages/infrastructure/src/persistence-sync/__tests__ packages/infrastructure/src/persistence-local/__tests__/local-task-unarchive.baseline.test.ts` ⇒ **20 文件 / 177 例 / 0 红**（45.26s）。
    - 格式 + lint + 类型（新增文件）：`pnpm exec vp check --fix <probe>` ⇒ **0 warning / 0 lint / 0 type error**。
    - 移动端红线：`git status --porcelain -- packages/presentation-react apps/mobile` = **0**。
- **未跑全仓门禁**（按派单边界：只跑探针相关面 + 报精确数字）。

---

## 附录 · 服务端临时探针内容（已删除，供复现）

```go
package task

import (
	"testing"

	"naotodoserver/application/idutil"
	"naotodoserver/application/task/dto"
	"naotodoserver/domain/task/entities"
	domaintypes "naotodoserver/domain/types"
)

func TestT187R5ProbeInboxNormalization(t *testing.T) {
	const userId int64 = 1001
	_, err := CreateTaskReqToValueObject(userId, &dto.CreateTaskReq{Name: "t", ProjectId: "inbox"})
	if err == nil {
		t.Fatal("create 路径对 'inbox' 未报错")
	}
	t.Logf("create/sync-push 路径 projectId='inbox' ⇒ error=%v", err)

	vo, err := CreateTaskReqToValueObject(userId, &dto.CreateTaskReq{Name: "t", ProjectId: ""})
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("create 路径 projectId='' ⇒ ProjectId=%d", vo.ProjectId)

	inbox := "inbox"
	uvo, err := UpdateTaskReqToValueObject(userId, &dto.UpdateTaskReq{ProjectId: &inbox})
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("update 路径 projectId='inbox' ⇒ ProjectId=%d", *uvo.ProjectId)

	res := TaskEntityToGetRes(&entities.Task{ProjectId: domaintypes.ProjectID(userId)})
	t.Logf("pull/GET 出参 ProjectId=%q (FormatID=%q)", res.ProjectId, idutil.FormatID(userId))
}
```