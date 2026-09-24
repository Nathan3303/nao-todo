# T188 · R-5 缺陷修复（脱归档到收集箱的变更同步不到服务端）C + B 闭环

- **任务**：T188（rd-fe）｜派单：PM（`docs/adr/2026-09-24-project-archive.md` §16 修法 C+B）
- **真源**：qa `T187` 探针报告 `docs/qa/2026-09-25-r5-inbox-roundtrip-probe.md` + 探针文件 `packages/infrastructure/src/persistence-sync/__tests__/t187-r5-inbox-roundtrip.probe.test.ts`
- **分支 / 提交**：`feat/99-project-archive`
    - 代码修复：`e4b0bbe7`（父提交 `a7d5aa85`）
    - 本报告：随 T188 收尾提交（`git log -- docs/reports/T188-r5-inbox-sync-fix.md`）
- **边界**：⛔ 未动服务端契约 · ⛔ 移动端零改动 · ⛔ 未重构同步层（仅 2 处边界归一 + 常量）

---

## ① 改动文件（= `git show --numstat`）

| 文件                                                                    | +/-       |
| :---------------------------------------------------------------------- | :-------- |
| `packages/infrastructure/src/persistence-sync/sync-service.ts`          | +26 / −1  |
| `.../persistence-sync/__tests__/t187-r5-inbox-roundtrip.probe.test.ts`  | +43 / −40 |
| `.../persistence-sync/__tests__/t188-r5-inbox-sync-fix.test.ts`（新增） | +246 / −0 |

## ② C / B 落点

- **C（写侧）**：`sync-service.ts` `buildTaskPush` → `record.projectId = toPushProjectId(record.projectId)`
  （`'inbox'` → `''`，其余 id 原样）。**载荷构造唯一处** ⇒ 一处生效。
- **B（读侧）**：`sync-service.ts` `putPulledRecord`
  → `config.table === 'tasks' ? { ...entity, projectId: toLocalProjectId(entity.projectId, userId) } : entity`
  （`projectId === userId` → `'inbox'`）。**pull 落库唯一处**。
- **单一真源**：两处共用本地常量 `INBOX_PROJECT_ID = 'inbox'`，未新增第二套哨兵；本地数据面恒 `'inbox'`，线上表示恒 `''`。
  两端对称映射 `toPushProjectId` / `toLocalProjectId` 相邻定义并注明「唯一落点，勿在调用点散落」。

## ③ `'inbox'` 写者审计表

| #   | 路径                                                                                             | 是否被 C 覆盖                                             |
| :-- | :----------------------------------------------------------------------------------------------- | :-------------------------------------------------------- |
| 1   | 单任务脱归档 `LocalTaskRepoImpl.unarchive`（`task-repo-impl.ts:304`）                            | ✅ 覆盖（写仓储 → push 边界）                             |
| 2   | 详情页「移动到收集箱」`task-details/footer/index.vue:104` → `TaskService.update` → `repo.update` | ✅ 覆盖（同 push 边界）                                   |
| 3   | 创建器选「收集箱」`task-project-selector.vue:27` value=`'inbox'` → `use-creator` → `repo.create` | ✅ 覆盖（同 push 边界）                                   |
| 4   | 领域层 `TaskService.unarchive` store 镜像（`domain-task/.../task.ts:157`）                       | ✅ 覆盖（仅镜像；底层记录由 #1/#2 写）                    |
| 5   | `built-in/project/default.ts:135,139` preference `projectId:'inbox'`（视图偏好）                 | ➖ 非任务、不入 `tasks` push，无覆盖需求                  |
| 6   | `presentation-react` / `apps/mobile` 的 `'inbox'` 写入与过滤                                     | ➖ 移动端零改动红线；ADR §16.4 已登记另立单               |
| 7   | 既有无清单创建 `use-creator.ts:64` 默认 `projectId=''`                                           | ✅ 写侧本就发 `''`；其**读侧**缺口由 B 覆盖（新增回归例） |

**结论**：任务侧 `'inbox'` 写者全部经「本地仓储 → push 边界」汇聚 ⇒ C 一处全覆盖；**无同型未覆盖路径**。

## ④ 往返证据（探针 S1，绿）

| 断言                                 | 值                               |
| :----------------------------------- | :------------------------------- |
| push 载荷 `tasks[0].projectId`       | `''`（C 生效，非字面 `'inbox'`） |
| push 回执 `outcome`                  | `applied`（修复前为 `error`）    |
| 队列项（`syncTracker.listDirty`）    | 已出队（不再业务退避/积压）      |
| pull 后本地 `record.projectId`       | `'inbox'`（B 生效）              |
| 收集箱过滤 `list('projectId=inbox')` | 命中 `true`                      |

## ⑤ 探针 S2 变更说明

- **修前**：S2 = **反事实**——「若服务端归一为 `userId` 并回传 ⇒ 本地字面过滤**不命中**」（断言 `inboxContains === false`）。
- **修后**：S2 = **读侧半程正向不变量**——「服务端归一结果 `projectId === userId` 经 pull 落库 ⇒ 本地**必须** `'inbox'` ⇒ 收集箱**必须命中**」（断言 `record.projectId === 'inbox'` 且 `inboxContains === true`），防读侧归一被静默回退。
- **文件头注释口径**同步更新；**S1/S2 分组语义保留**（S1 = 实际链路，S2 = 读侧半程）。
- S1 断言由「载荷 `'inbox'` / `error` / 队列保留 / 不消失」升级为「载荷 `''` / `applied` / 出队 / 归一回 `'inbox'` / 命中」——**原有保证（不消失、本地仍 `'inbox'`）全部保留**，无削弱。

## ⑥ 测试例数

- 新增 `t188-r5-inbox-sync-fix.test.ts`：**4 例** —— ① create/update 两个 `'inbox'` 写者 ⇒ 载荷 `''` + `applied`；② C 负向（真清单 id `p-1` 原样）；③ B 收益（`''` 创建任务经 pull 归一回收集箱）；④ B 负向（真清单 id ≠ `userId` 不被误归一）。
- 探针：**2 例**（S1 实际链路闭环 / S2 读侧正向不变量）。

## ⑦ 门禁（精确数字）

| 项                                                                                    | 结果                                                                                                                          |
| :------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------- |
| 受影响面 + 依赖包 `vp test --run`                                                     | `persistence-sync/__tests__` + `persistence-local/__tests__` + `domain-task` + `domain-project` ⇒ **54 文件 / 502 例 / 0 红** |
| 全仓 `vp check`                                                                       | **0 error**（1474 文件格式 / 1252 文件 lint+type）                                                                            |
| `guard:ddd` / `guard:mobile-imports` / `guard:barrel-imports` / `guard:gate-pathspec` | **全 rc=0**                                                                                                                   |
| `vp run webapp build` / `pnpm run desktop:build`                                      | **rc=0 / rc=0**                                                                                                               |
| 移动端红线 `git status --porcelain -- packages/presentation-react apps/mobile`        | **0**                                                                                                                         |

## ⑧ 未过项 / 风险

1. **qa 文档漂移（未改 qa 文档）**：`docs/qa/2026-09-25-r5-inbox-roundtrip-probe.md` §3 / §7 仍是修复前口径（S2「不命中」为反事实），与探针文件现状（正向不变量）不一致 ⇒ 建议 qa 追加 T188 注记（本单边界：不改 qa 基线断言强度，只按 PM 裁定与 §16.4 转正）。
2. **移动端 R-5 残留**（`presentation-react/src/logic/task-filter-core.ts:124` 字面 `'inbox'` 过滤）：B 不覆盖，按红线零改动；ADR §16.4 已登记另立单。
3. **DEF-37 关闭**：交 PM 在缺陷池登记闭环（本单已实测修复：push `applied` + 出队 + 往返命中）。