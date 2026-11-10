# T671 · 走查②「不同字段仍冲突」取证与定性（`DEF-146` 后续）

- 日期：2026-11-09 · Owner：qa · 级别：**done(full)**
- 分支 `feat/336-edit-overwrite-visibility` · 取证时 HEAD **`527c4344`**（PM 文档口径更正提交；生产代码相对 `e44f913c` 未变）
- 复现载体：`packages/infrastructure/src/persistence-sync/__tests__/t671-qa-diff-field-probe.test.ts`（9 例全绿，**等价数据层驱动**：真实本地仓储 + `SyncService.pullAll/pushAll` + 真实 `conflict-journal`；假服务端只模拟 OCC/base/keyset）
- ⛔ 未改生产代码、未改既有测试。

## 0. 结论先行

1. **两种时序的 `kind` 不同，且都不是本批保存侧判据产生的**：
    - **时序 X**（B 编辑前已拉取 A 的修改）：**0 条**；
    - **时序 Y**（B 保存后先 push，未拉取）：**`stale`**（既有**行级 OCC**，服务端 base 不匹配）；
    - **时序 Z**（B 保存后先 pull，即周期自动刷新）：**`pull-local-wins`**（既有 **A1** 拉取「本地胜」记账）。
2. **因果判定：与本批（`DEF-146` 保存侧三值判定）因果关系为零**。三种时序下「B 保存完成、尚未 pull/push」时 journal **恒为 0**；不传编辑基准（= 本批前保存路径）**同样**出现 Y/Z 的同 kind 记录；OCC / `conflict-journal` / `put-with-sync-base` / `sync-normalize` **零 diff**。
3. **是否 AC5 违约**：
    - **保存侧判据层：不违约**（不同字段不产生 `pull-local-wins`；X 端到端 0 条）；
    - **但用户验收 ② 的"端到端"措辞仍不成立**：时序 Z 会端到端出现 `pull-local-wins`（A1），且随后 push **真实覆盖**了 A 的描述 —— 记录是**诚实的**，不是误报。建议 ② 增加前置「B 保存前已完成一次拉取」，或把判据明确限定在保存侧；否则「不会误记 `pull-local-wins`」在 30s 窗口内会被证伪。
4. **用户可操作性现状**：`stale` 只能**整行二选一**（`用云端的` / `保留我的修改`）；`pull-local-wins`（含 A1）只有 `保留我的修改`（**只清条目**）+ `复制` + `关闭`，**没有**拿回云端版本的动作。**两种记录都无法「只保留我的名称 + 云端的描述」**；字段级合并属 B 批能力缺口。
5. **文案**：现有安全提示「选择后，这条冲突将以你选定的版本为准。」是**整行版本**语义，**没有**承诺合并；但用户仍可能误读为"可逐字段合并"。建议（仅建议，不改代码）补一句「整条记录二选一，不会逐字段合并」。

## 1. 复现矩阵与实测证据

统一夹具：A 端（假服务端 = 另一台设备）改**描述**；B 端本地改**名称**；两端同一任务。初始名/描述 = `A0-name` / `A0-desc`，A 的远端修改 = 描述 `A-desc`。

| 时序  | 操作顺序                                       | B 保存后（同步前）journal | 同步后新增记录                  | 最终服务端                                          |
| :---- | :--------------------------------------------- | :------------------------ | :------------------------------ | :-------------------------------------------------- |
| **X** | A 改描述 → **B 先 pull** → B 保存名称 → B push | **0**                     | **0**                           | 名称 `B-name`、描述 `A-desc`（两边都保住）          |
| **Y** | A 改描述 → B 保存名称 → **B 先 push**          | **0**                     | **`stale` × 1**                 | 名称 `B-name`、描述 `A0-desc`（A 的描述被整行覆盖） |
| **Z** | A 改描述 → B 保存名称 → **B 先 pull**          | **0**                     | **`pull-local-wins` × 1**（A1） | 名称 `B-name`、描述 `A0-desc`（A 的描述被整行覆盖） |

> 关键隔离断言：三种时序都在「保存完成、同步动作之前」断言 journal 为空 ⇒ **保存侧三值判定没有记任何账**；记录只在后续 pull/push 时出现。

### 1.1 时序 X（已拉取）⇒ 0 条

- 本地与远端最终均为 `{"name":"B-name","description":"A-desc"}`；
- journal 全程 0 条（即使 B 的保存载荷同时带 `name+description`，仍 0 条 —— 未编辑字段的编辑基准已随拉取前进）。

### 1.2 时序 Y（先 push）⇒ `stale`（行级 OCC）

实测 journal 条目（节选）：

```json
{
    "kind": "stale",
    "table": "tasks",
    "entityId": "<task-id>",
    "loser": { "name": "B-name", "description": "A0-desc", "...": "我的整行" },
    "loserUpdatedAt": "<B 本地写入时间>",
    "winnerUpdatedAt": "<A 的远端 updatedAt>",
    "serverCurrent": { "name": "A0-name", "description": "A-desc", "...": "云端整行" }
}
```

- 触发点：push 载荷携带的 `baseUpdatedAt` 落后于服务端当前 `updatedAt` ⇒ 服务端返回 `outcome: "stale"`；
- `loser` = **我的整行**（含我这侧的名称 + 旧描述）；`serverCurrent` = 云端整行；
- 与保存侧无关：保存后 journal = 0；`loserUpdatedAt` 有值（push 侧口径）。

### 1.3 时序 Z（先 pull）⇒ `pull-local-wins`（A1）

实测 journal 条目（节选）：

```json
{
    "kind": "pull-local-wins",
    "table": "tasks",
    "entityId": "<task-id>",
    "loser": { "id": "<task-id>", "name": "A0-name", "description": "A-desc" },
    "loserUpdatedAt": "<A 的远端 updatedAt>",
    "winnerUpdatedAt": "<B 本次本地写入时间>"
}
```

- 触发点：B 保存后 `syncQueue` 有本地修改，周期自动刷新只做 `pullAll()`；远端 `updatedAt` ≤ 本地 `updatedAt` 且逐字段 diff 非空 ⇒ 走 **A1 既有分支**，`loser` = **远端快照**；
- 随后 push 以「我的整行」写回服务端 ⇒ **A 的描述确实被覆盖为 `A0-desc`**（已实测）⇒ 这条记录是诚实的；
- 与保存侧无关：保存后 journal = 0；`loserUpdatedAt` 有值（A1 口径，保存侧记录不带该字段）。

## 2. 与本批（`DEF-146`）的因果判定：零

四条证据链：

1. **保存侧隔离**：X/Y/Z 三时序在「保存完成、尚未 pull/push」时 journal 均 **0 条**（保存侧三值判定只可能记 `pull-local-wins`，实际一条未记）。
2. **回退本批保存路径的等价对照**（`R-6`：不传编辑基准 = 本批前行为逐字一致）：
    - **Y0**：B 保存不传 `origin` → push ⇒ 仍 `stale`（loser `B-name/A0-desc`）；
    - **Z0**：B 保存不传 `origin` → pull ⇒ 仍 `pull-local-wins`（`loserUpdatedAt` 有值）。
3. **代码面零 diff（`origin/main..HEAD`）**：
    - `conflict-journal.ts` / `put-with-sync-base.ts` / `sync-normalize.ts`：**0 行**；
    - `sync-service.ts`：仅 A1「挑差异字段」抽成共享 helper（等价重构，A1 语义与判据未变）；
    - `task-repo-impl.ts`：仅新增保存侧三值判定 + 写后记账（不参与 pull/push 裁决）。
4. **kind 归属可区分**：A1 记录带 `loserUpdatedAt`（远端 updatedAt），保存侧记录 `loserUpdatedAt` 恒 `undefined`；Y/Z 实测均带 `loserUpdatedAt` ⇒ 非保存侧。

⇒ **不是本批引入的误报**；`stale` 属既有行级 OCC，`pull-local-wins`（Z）属既有 A1；两者都对应**真实整行覆盖**。

## 3. AC5 口径：分层结论（需要 PM 再收一次措辞）

- **保存侧判据（本批 AC5 的真源）**：`F = keys(载荷) ∩ keys(编辑基准)`，不同字段不会互相命中；X 端到端 0 条 ⇒ **不违约**。
- **端到端措辞**：`docs/reports/336-user-acceptance.md` 2026-11-09 修正版 ② 仍写「**不会因为改的是不同字段而误记一条 `pull-local-wins`**」。实测 **时序 Z 会出现 `pull-local-wins`**（A1），但它是**真实覆盖的诚实记录**（push 确实覆盖了 A 的描述），不是"误记"。
- **建议**（二选一，PM 定）：
    1. 给 ② 增加前置：**「B 端在保存前已完成一次拉取（A 的修改已落到 B 本地）」** ⇒ 此时 0 条成立（时序 X）；
    2. 或把 ② 的判据明确为「**保存侧判据不会因不同字段单独产生记录**；同步路径出现的 `stale` / `pull-local-wins` 均对应真实整行覆盖，归 B 批/既有行为」。
- 若坚持原文「端到端不得出现 `pull-local-wins`」⇒ 需要 B 批的「只推变更字段 / 字段级 OCC」，**不是本批可修**（本批未新增任何 pull/push 裁决路径）。

## 4. 用户视角可操作性（现状如实描述）

| 记录 kind                                               | 面板动作                                        | 点了之后                                                                                                     | 能否「只保留我的名称 + 云端的描述」    |
| :------------------------------------------------------ | :---------------------------------------------- | :----------------------------------------------------------------------------------------------------------- | :------------------------------------- |
| `stale`（Y）                                            | `用云端的` / `保留我的修改`                     | `用云端的` ⇒ 本地变**云端整行**（我的名称丢失）；`保留我的修改` ⇒ 本地变**我的整行**并重推（A 的描述被覆盖） | **不能**                               |
| `pull-local-wins`（X 的保存侧不会产生；Z 的 A1 会产生） | `保留我的修改`（**只清条目**）/ `复制` / `关闭` | 本地已是我的整行；`复制` 可拿到云端当时的版本（`loser`）；**没有**「用云端的」真写回（`D1 = (a)` 可见+复制） | **不能**（只能复制云端内容后手动处理） |

补充实测（Y3，既有 A2 行为，不属本批）：`stale` 刚产生时若还没发生下一次 pull，面板对比区可能**没有字段差异**（本地行仍是"我的版本"，`serverCurrent` 不参与对比）；发生一次 pull 后才显示 `updatedAt`（技术字段）+ `name` + `description` 的差异。这是既有链路表现，建议 B 批一并考虑「打开面板即拉取/用 `serverCurrent` 做对比」。

## 5. 文案核查（仅建议，未改代码）

- 现状 `sync.conflict.safetyHint` =「**选择后，这条冲突将以你选定的版本为准。**」；
- 语义是**整条版本**，**没有**"合并/逐字段"承诺（已断言不包含「合并」「逐字段」）；
- 但 `我的修改 / 云端最新 / 用云端的 / 保留我的修改` 易被理解成"按字段选"。建议 B 批（或文案小单）改为：「**整条记录二选一，不会自动逐字段合并**」；对 `pull-local-wins` 可补「云端那份可复制后手动合并」。

## 6. 复现方式

```text
pnpm exec vp test --run packages/infrastructure/src/persistence-sync/__tests__/t671-qa-diff-field-probe.test.ts --silent=false --reporter=verbose
```

- 9 例覆盖：X1/X2（0 条）、Y1（`stale` 证据）、Y2（两动作整行二选一）、Y3（对比区时机）、Y0（回退本批等价对照）、Z1（`pull-local-wins` 证据）、Z0（回退本批等价对照）、W1（文案）。
- 证据 JSON 由测试 `console.log` 直接输出（`[T671] ...`），报告内条目字段取自该输出。

## 7. 遗留 / 归口

- **B 批输入（字段级合并）**：用户诉求成立；需「只推变更字段 + 字段级裁决/合并」，本批未做（A 批 PRD 已列不做）。
- **`stale` 面板对比时机**（Y3）与 **`pull-local-wins` 无"用云端的"写回**（`D1=a`）：既有行为，未在本批改变；建议随 B 批统一评审。
- **验收清单 ② 措辞**：见 §3，需 PM 二次收口（当前版本在时序 Z 下会被证伪）。
- 本次仅新增探针与本报告，无生产代码 / 既有测试改动；工作区无其它遗留。