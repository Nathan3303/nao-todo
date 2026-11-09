# T668 · DEF-146 口径裁定（编辑期远端变更 ⇒ 保存覆盖的记账与恢复）

- 日期：2026-11-07 · Owner：arch-designer · 形态：**只读评估**（未建分支、未改代码、未动 `tasks-state.md` / `defect-pool.md`）
- 指针：`DEF-146`（P1，`docs/reports/defect-pool.md`）· `DEF-145`/`T662`（编辑输入保值，`a99a25df`+`c4d758d5`）· A 批 `F-01`（`pull-local-wins`）· ADR `2026-11-03-sync-conflict-journal-crypto.md`（R-H 快照约束）· 本单 ADR `docs/adr/2026-11-06-edit-vs-remote-overwrite.md`

## 0. 结论先行

1. **落点 = 保存侧（B）**，且判据必须是**字段级三值比较**（云端当前值 `R` × 我提交值 `L` × 用户编辑起点值 `O`），不是「载荷与库中当前值不同」。
2. **记账 = 复用 `pull-local-wins` + `appendConflict`**（零新 kind、零新写入路径、零契约改动、OCC/base/`putWithSyncBase` 全不动）。
3. 选 B 的额外理由：它补的正是现有 A1 记账的**对角时序缺口** —— A1 覆盖「远端在我保存**之后**到」，B 覆盖「远端在我保存**之前**到」；同一 kind ⇒ 两种时序在 journal 里口径一致。
4. 落点 A（拉取侧）**否决**：数据层拿不到「编辑器未保存草稿」，须新建跨层注册表；且用户若最终没保存（Esc/关面板）会记一条「云端被覆盖」的**假账**。
5. 工期 **2.0–2.5 人天**（含用例先行 0.5）。`DEF-147` **分开做**，不合并（§6）。
6. 需 PM 拍板：**「可恢复」的强度**（可见+复制 / 一键写回 / 改用「还回 base」让 OCC 自己判 `stale`）—— 见 §7 D1。

## 1. 落点：A / B / C 的成立性

| 落点                                                                           | 能否成立                                                                                                                                                                                                                                                                                                             | 误报面                                                                                                                                                                                                               | 成本                                |
| :----------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------- |
| **A 拉取侧**（pull 检测「该行有未保存编辑」⇒ 记败方快照）                      | 需新建**编辑器草稿注册表**：现状无此通道（`task-details/`、`view-adapters/` 内无 `editing`/`dirty` 注册；`T662` 只做字段级合并，`use-task-view-object.ts:119-140`）                                                                                                                                                  | **大**：pull 每周期重放（`PULL_BACKTRACK_MS=1000`，`sync-service.ts:348`；未变化行无条件 `put`，`1222-1244`）⇒ 草稿在就每轮记一次（需 `occurrences` 去重）；用户 **Esc/关面板不保存** ⇒ 记了「云端被覆盖」但并未覆盖 | 跨层状态 + 生命周期 + 去重，≥1 人天 |
| **B 保存侧**（保存时用 `R`/`L`/`O` 三值判定）                                  | ✅ 成立：`R` = 库中当前行（pull 已落库的云端版本，`task-repo-impl.ts:142`）、`L` = 本次载荷、`O` = 编辑器冻结的「上次持久化值」（`persistedText`，`use-task-view-object.ts:40,131-137`，`T662` 已保证**不被 store 合并推进**）                                                                                       | **零**（判据见 §2；只在实际覆盖的那一次触发）                                                                                                                                                                        | ≈1.5 人天                           |
| **C 两段式**（pull 只写「该行被远端改过」标记，保存时记账）                    | 语义成立但**无增益**：标记携带的信息 = 「行内容已变」，而保存侧从 `R`/`O` 本来就能得出；标记另需清理（保存后/关面板/TTL），净增状态与失败面                                                                                                                                                                          | 若清理漏 ⇒ 幽灵记账                                                                                                                                                                                                  | 比 B 高                             |
| C2「还回 base」（保存时用用户看到的版本作 `baseUpdatedAt` ⇒ 服务端判 `stale`） | ✅ 成立且恢复最强（走既有 `stale` + `serverCurrent` + 真写回），**但**需 ① 把 per-row base 暴露给编辑器（`TaskViewObject` 无该字段、`taskRecordToEntity` 有意丢弃，`converters/task.ts:47-75`）② 改 `putWithSyncBase` 的 base 继承语义（`put-with-sync-base.ts:22-26`，R-20 灾难路径守护点）③ 保存后须用户裁决才上云 | 低（`syncPayloadMatchesServer` 伪 stale 消噪已覆盖，`sync-service.ts:1565-1568`）                                                                                                                                    | +1–1.5 人天，风险在 base            |
| C3「本地伪造一条 `stale`」（内容可写回但不真判 OCC）                           | ⛔ **否决**：伪造 push 裁决 = 第二条裁决路径                                                                                                                                                                                                                                                                         | —                                                                                                                                                                                                                    | —                                   |

> **推荐 = B**。C2 只在 PM 要求「一键恢复云端版本」时才启用（§7 D1）。

## 2. 正确定界（如何不误报）

对每次保存，取 `F = keys(payload) ∩ keys(O)`，逐字段：

```
记录该字段 ⇔ (R_f ≠ O_f) 且 (L_f ≠ R_f)      // ≠ 一律用 valuesEqual（空值哨兵归一）
```

- `R_f` = 库中当前值（云端版本）· `L_f` = 我提交的值 · `O_f` = 我开始编辑时它**已是**的值（`persistedText`）。
- 只把命中字段写进快照；`R_f ≠ O_f` 判「我编辑期间这个字段被改过」，`L_f ≠ R_f` 判「我确实要覆盖它」。

反例核对（全部由 `O` 基准消掉，不是靠启发式）：

| 场景                            | 判据表现                                                         | 结果                                                 |
| :------------------------------ | :--------------------------------------------------------------- | :--------------------------------------------------- |
| 用户连改两次（两次保存）        | 第二次 `O`＝上次提交值＝`R` ⇒ ① 不成立                           | 不记（基准推进点 `use-task-view-object.ts:186-192`） |
| 只是格式化差异 / 提交了未改字段 | `L`＝`R` ⇒ ② 不成立                                              | 不记                                                 |
| 远端改的是**别的**字段          | `R_f`＝`O_f` ⇒ ① 不成立（关键：无字段级重叠就不记）              | 不记                                                 |
| 用户改回原值                    | `L`＝`O`＝`R`                                                    | 不记                                                 |
| 远端改完、我**之后**才开始输入  | `persistedText` 对未编辑字段随 store 推进（`131-137`）⇒ `O`＝`R` | 不记（在新值上编辑 ≠ 覆盖）                          |
| 我的值恰好等于云端值            | ② 不成立                                                         | 不记                                                 |

> 因此「保存时载荷 ≠ 库中当前值」**不是**可用判据（远端未动该字段的普通编辑全部命中 ⇒ 误报）。

## 3. 快照内容：能否直接复用现有写入函数

**能，且只需复用 `appendConflict`（`conflict-journal.ts:200-252`）**：它已内含 ① 字段子集 + 剔除 `userId/syncedServerUpdatedAt/revision`（`39-43,56-71`）② 文本 >512 截断并标 `truncated`/`truncatedFields`（`35-36,63-67`）③ `CONFLICT_JOURNAL_LIMIT=200` 环形淘汰不升（`26-27,87-106`）④ journal 专用锁内 RMW（`121-161`）⑤ 状态面计数（`syncStatus.setConflictCount`）。

需**新增**的只有「挑字段」一步：`recordPullLocalWins` 里已有逐字段 `valuesEqual` 过滤（`sync-service.ts:755-790`）⇒ 抽成共享 helper，忽略字段集统一用 `SYNC_COMPARE_IGNORED_FIELDS`（`sync-normalize.ts:22-30`）。⚠️ 现存三套忽略字段表（`sync-service.ts:100-106` / `conflict-journal.ts:39-43` / `sync-normalize.ts:22-30`），**不得再加第四套**。

两点须知（不阻断，但要登记）：

- `KIND_EVICTION_RANK` 中 `pull-local-wins` = 2（**最优先淘汰**，`conflict-journal.ts:77-84`）⇒ P1 记录可能先于 `remote-wins` 被挤掉。不改 kind 就无法区分（见 §7 D3）。
- 去重只对「`pull-local-wins` 且 `winnerUpdatedAt` 相同」累加 `occurrences`（`212-229`）；保存侧每次 `winnerUpdatedAt` 都是新的本地 `updatedAt` ⇒ 不会误合并 ✔。

## 4. 界面：是否需要新文案 / 新 kind

**零新 kind、零新文案。** `pull-local-wins` 的 C 端语汇已存在且**正好准确**：

- 类型标签「我的修改已覆盖云端」（`packages/shared/locales/zh-CN.ts:165`）。
- 侧标签已为它特化：「云端当时的版本 / 我的当前版本」（`zh-CN.ts:150-151`，判据 `conflict-list.vue:295-310`）。
- 展示与复制通道已含该 kind：`LIST_SNAPSHOT_KINDS`/`DETAIL_SNAPSHOT_KINDS`（`273-288`）、`canRetryLocalConflict`=true（`295-300,318-319`）、复制入口（`conflict-list.vue:561-568`）。

「会不会与真正的 `pull-local-wins` 混淆」——**不会，也不需要区分**：两者在用户语汇里都是「云端那份被我的版本取代」，差异仅在**发生时机**（我保存时 vs 拉取时），属技术细节（AGENTS.md §「文案说人话」）。

**但有一处必须一并收口**：面板对**所有** kind 都渲染「保留服务端版本」按钮（`conflict-list.vue:594`），而该动作对非 `stale` 只清条目（`conflict-journal.ts:529-539`）⇒ 对 `pull-local-wins` 点了**不会**恢复云端内容（误导）。建议 `v-if` 依 kind 收口（该 kind 改由「复制」入口承载）；若要「真写回」则属 §7 D1。

## 5. 工期与拆分（文件级，2.0–2.5 人天）

| #   | 内容                                                                               | 文件                                                                                                                                                   | 人天 |
| :-- | :--------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 0   | **用例先行**：判据矩阵（6 反例 + 3 正例）+ 变异点自跑                              | `packages/infrastructure/src/persistence-sync/__tests__/t668-*.test.ts`、`packages/presentation/task/components/task-details/__tests__/t668-*.test.ts` | 0.5  |
| 1   | 端口/用例加**可选**「编辑基准」入参                                                | `domain-task/src/domain/repositories/task.ts:30`、`application/usecases/task.ts:216-270`、`application/viewobjects/task.ts`（新增 `TaskUpdateOrigin`） | 0.25 |
| 2   | 本地仓储：三值判定 + 记账（写前取 `R`、写后调用记录；失败不阻断保存 + 结构化日志） | `infrastructure/.../persistence-local/repos/task-repo-impl.ts:140-172`                                                                                 | 0.5  |
| 3   | 抽共享「字段子集挑选」+ 保存侧记录函数（复用 `appendConflict`）                    | `infrastructure/.../persistence-sync/conflict-journal.ts`、`sync-service.ts:755-790`                                                                   | 0.5  |
| 4   | 编辑器传基准（`persistedText` 即 `O`，只传 payload 涉及的字段）                    | `presentation/task/components/task-details/use-task-view-object.ts:147-195`                                                                            | 0.25 |
| 5   | go 仓储签名跟随（行为零改动）+ `batchUpdate` 保持不传                              | `infrastructure/.../persistence-go/task/task-repo-impl.ts:76`                                                                                          | 0.2  |
| 6   | 面板收口「保留服务端」按钮                                                         | `apps/web/src/components/sync/conflict-list.vue:594`                                                                                                   | 0.25 |
| 7   | 用例实现 + 受影响面回归（`vn check`/受影响面 `vp test`）                           | —                                                                                                                                                      | 0.75 |

**最大不确定项**：domain 端口签名变更的辐射面 —— `TaskRepository.update` 有 2 个实现、`TaskUseCase.update` 调用点 ~8 处（`handlers/task.ts:78`、`use-kanban.ts:46`、日历 4 处、详情 3 处）+ `presentation-react/logic/compose-task-usecase.ts:104`；全部应为**可选参数零行为变化**，移动端只做签名兼容验证、不新增调用（红线）。

**变异点（必须自跑）**：M1 去掉 ①（只用 `L≠R`）⇒ 反例用例必红；M2 去掉 ②⇒「我值＝云端值」红；M3 用 `!==` 替 `valuesEqual` ⇒ 空哨兵（`''`/`null`/`[]`）用例红；M4 快照取整行 ⇒ 最小化用例红；M5 把记账挪到写之前并让其抛错 ⇒「保存仍成功」用例红。

## 6. 与 `DEF-147` 的关系

**结论：分开做，`DEF-147` 继续挂账；不合并。**

1. 代码面零重叠：`DEF-147` 在 `applyPullBatch` 的写入幂等（`sync-service.ts:1222-1244`），本单在本地保存代理账（`task-repo-impl.ts:140-172`）。
2. 判据不互相依赖：本单用「字段三值」，与 pull 是否跳过重写无关；`DEF-147` 修好后 base/内容判据逐字不变 ⇒ **无协同收益**。
3. 风险面相反：`DEF-147` 是热路径幂等 + `written`/cursor/base 语义，须独立用例面；合并会让 P1 排在 P3 重构之后。
4. 唯一「省」只在文档：两单可共享同一份「base 只前进不回退」口径 —— 已在 ADR 记一行。
5. ⚠️ 若将来 `DEF-147` 采用「内容等价则跳过 `put`」，**不得**跳过 `syncedServerUpdatedAt` 的推进（否则 base 陈旧 ⇒ 伪 `stale`）。

## 7. 风险、残留与待拍板

**残留（登记，不阻断）**

1. 只保留**最新一版**被覆盖的云端内容（中间版本从未落本机）；与现有 journal 能力一致。
2. 归因边界：① 只要求 `R_f≠O_f`，若同一机器**另一处**写了同一字段也会命中；当前写 `name`/`description` 的入口只有详情面板（其余为 `state/priority/sortId/日期`，`handlers/task.ts:78`、`use-kanban.ts:46`）⇒ 实际不可达；将来出现第二入口时须补「base 是否前进」门。
3. TOCTOU：`task-repo-impl.ts:142` 读与 `164` 写之间若 pull 抢先落库（毫秒级），本判据看到旧 `R`（不记账）且该写仍会用新 base 覆盖 —— **既有窗口**（`put-with-sync-base.ts:22-26` 在事务内重读 base），本单不关闭（概率 ≈ 毫秒/30s）。⛔ 不为此把加解密挪进 Dexie 事务（`PrematureCommitError`）。
4. 记账在保存事务**之后**（journal 走 `navigator.locks` + 另一次 `meta` 写，不能进 Dexie 事务）⇒ 记账失败不阻断保存、只 log；「既不丢保存又不丢记录」的原子保证不存在（与现有 `appendConflict` 各调用点同姿态）。

**待 PM/用户拍板**

- **D1 「可恢复」的强度**：(a) 可见 + 复制/导出（本方案，0 额外）· (b) 追加「保留服务端版本」对 `pull-local-wins` 的**真写回**（+0.5–1 人天，扩展既有恢复动作语义，⚠️ 快照只有 diff 字段 ⇒ 需按字段合回当前行）· (c) 改走 C2「还回 base」让 OCC 自己判 `stale`（恢复最强、保存后需用户裁决才上云，+1–1.5 人天，触碰 base 语义）。
- **D2** 是否同时收口「保留服务端」按钮（现状对所有 kind 渲染，`pull-local-wins` 点了只清条目）。
- **D3** 淘汰优先级：保存侧记录是否要提高（`pull-local-wins` 现为最先淘汰；不改 kind 无法区分，需另评）。
- **D4** PRD：`AC6` 补「编辑器未保存态」之外，本单另需 AC ——「同字段并发 ⇒ 落一条 `pull-local-wins` + 可查看/复制；不同字段 ⇒ **零记录**」。

## 参考来源（访问日期 2026-11-07）

- `packages/infrastructure/src/persistence-local/repos/put-with-sync-base.ts:22-26`（base 继承 = 本缺陷的机制根因）· `persistence-local/repos/task-repo-impl.ts:140-172`（保存路径）· `persistence-sync/sync-service.ts:348,755-790,1144-1250,1550-1640`（回拉窗口 / A1 记账 / `applyPullBatch` / push 回执与伪 stale）· `persistence-sync/conflict-journal.ts:26-27,39-43,56-71,77-84,121-161,200-252,273-320,429-465,497-676`（快照/淘汰/锁/记账/恢复动作）· `persistence-sync/sync-normalize.ts:22-30,74-90`（判等口径）· `persistence-local/converters/task.ts:9-75`（`name`/`description` 走 `plain:` 明文姿态，见 `crypto-service.ts:17`）。
- `packages/presentation/task/components/task-details/use-task-view-object.ts:40,92-107,119-140,147-195`（`persistedText` 基准 · 字段级合并 · 提交与基准推进）· `packages/shared/locales/zh-CN.ts:150-151,160-165` · `apps/web/src/components/sync/conflict-list.vue:257-269,295-310,561-568,591-596`。
- 内部规范：`docs/adr/2026-11-03-sync-conflict-journal-crypto.md`（R-H 快照最小化/截断/上限）· `docs/adr/2026-09-28-sync-conflict-timestamp-basis.md`（OCC/base）· `docs/reports/T640-sync-a-batch-arch-review.md`。
- 外部来源：**未检索到**（本次为既有机制内的落点裁决，无外部选型对照）。