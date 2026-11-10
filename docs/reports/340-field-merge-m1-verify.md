# 340 · B 批 `675b`：M1（基准捕获）独立复核 + 全量门禁

- 日期：2026-11-10 · Owner：qa · 级别：**done(full)**
- HEAD **`04f9f0bf`**（rd-fe M1：7 文件 +312/−10）· 分支 `feat/340-field-level-merge` · ⛔ 未改生产代码（唯一瞬时改动见 §2，已逐字节还原）
- 复核对象：`feat(340): B 批 M1 —— 字段级基准 fieldBase 捕获 + 4 处直写点接线`
- 独立证据载体：临时探针 `__tests__/t675b-m1-probe.test.ts`（7 例，**跑完删除、未入库**，工作区复验后 `git status` 为空）

## 0. 结论先行

1. **`fieldBase` 语义三点全部成立**（源码锚点 + 7 例独立探针）：只覆盖我改过的字段 ✅ · 首写胜 ✅ · 无旧行/无变化 ⇒ 不产基准 ✅。
2. **护栏真有牙**（双向验证）：新增 1 处直写点 ⇒ **3 红**；允许清单内去掉 `fieldBase` ⇒ **1 红**；恢复后 **4/4 绿**，且 `sha256sum -c` 通过、`git diff --stat` 为空（零残差）。
3. **`'none'` 事实仍成立**（M1 未引入任何 `remindRepeat` 写点）⇒ `DEF-154` 的关闭前提未被破坏。
4. **第 4 件（实体层捕获）判定属实**：任务 `name`/`description` 落库确为 `plain:<明文>`，记录层捕获会让 `B` 带前缀、与 `R`/`L`（实体明文）判等恒 false ⇒ M2 会把文本字段**全部**误判成「双方都改」⇒ M1 的实体层捕获是**必要且正确**的；**不建议**统一回记录层（方案与代价见 §4）。另发现 1 处**同族潜在陷阱**（projects 行仍是记录层捕获，见 §4.3）。
5. **门禁**：`vp check` / 5 守卫 / 两端构建 / 移动端 0 行 全绿；全仓测试 **14 红，逐条与 M0 清单一致（= 15 红 − `直写点-fieldBase`）**，无多无少。

## 1. ① `fieldBase` 语义三点

### 1.1 源码锚点（`04f9f0bf`）

| 语义                          | 锚点                                                                                                | 读码结论                                                                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 键集 = 只覆盖**我改过的字段** | `persistence-sync/field-base.ts:44-56`                                                              | 遍历**写后**键集 → 跳过 `SYNC_COMPARE_IGNORED_FIELDS` → `valuesEqual(from[f], to[f])` 相等则跳过 ⇒ 只留真实变化的字段；值 = **写前** `from[f]` |
| 唯一判等 / 忽略集单一来源     | 同上 `:30-31`                                                                                       | 复用 `valuesEqual`（`conflict-journal`）与 `SYNC_COMPARE_IGNORED_FIELDS`（`sync-normalize`）⇒ 无第二套比较语义（R-1）                          |
| **首写胜**（B 只前进）        | `sync-tracker.ts:51-56` + `:70-73`                                                                  | `mergedFieldBase = { ...fieldBase, ...mergedFieldBase }`（既有 B 覆盖本次值）；未捕获 ⇒ 不落键                                                 |
| 无旧行 / 无变化 ⇒ 不产基准    | `field-base.ts:47-48`（`!before` ⇒ `undefined`）+ 调用点                                            | `create`/`copy` 不传；`update`/`snooze` 传 `captureFieldBase(entityBefore, entity)`（无变化 ⇒ `undefined`）⇒ 队列项无 `fieldBase` 键           |
| 零迁移                        | `local-database.ts:306-311`                                                                         | `fieldBase?: Record<string, unknown>` 可选、非索引；M1 diff 中 `version(` 变更数 = **0**                                                       |
| 不进推送载荷                  | `sync-service.ts` 中 `fieldBase` 命中数 = **0**；`buildTaskPush` 键集不含 `fieldBase`（实测 false） | `fieldBase` 只出现在 6 个本地写/队列文件（见 §1.3）                                                                                            |

### 1.2 行为级（独立探针 7 例，全绿；跑完删除未入库）

| #   | 断言                                                                                                                                                                                         | 实测                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| ①   | 新建行（无旧行）⇒ 队列项**无** `fieldBase` 键                                                                                                                                                | ✅ `'fieldBase' in queued === false` |
| ②   | `update(name)` ⇒ 键集**恰好** `['name']`、`B.name === 'A0-name'`（**明文**、无 `plain:` 前缀）                                                                                               | ✅                                   |
| ③   | 连写两次（`name`→X，再 `name`→Y + `priority`）⇒ `B.name` 仍为 `'A0-name'`；`B.priority === 'medium'`；键集 `['name','priority']`                                                             | ✅ 首写胜 + 新字段按需追加           |
| ④   | 无实际变化（空哨兵 `null ↔ ''`）⇒ 不产基准；**后续无变化写不清空/覆盖既有 B**                                                                                                                | ✅                                   |
| ⑤   | `fieldBase` 不进推送载荷（单个 task 载荷键集 + 整批 `pushBodies` JSON 均不含）                                                                                                               | ✅                                   |
| ⑥   | `snooze(id, 30)` ⇒ 键集 `['remindAt','remindTime']`、`B.remindAt === ''`（实体层空串）、`remindTime` 无 `plain:`                                                                             | ✅                                   |
| ⑦   | 级联归档 ⇒ tasks/projects 两个队列项各有 `fieldBase = { archivedAt: null }`；随后单任务脱归档 ⇒ tasks 键集 `['archivedAt','projectId']`，且 `archivedAt` 仍为 `null`（**跨两次写仍首写胜**） | ✅ 同时覆盖 3 个直写点               |

### 1.3 `fieldBase` 出现面（源码级，非测试）

```text
persistence-local/db/local-database.ts          （类型声明，可选非索引）
persistence-local/repos/put-with-sync-base.ts   （透传）
persistence-local/repos/project-archive-cascade.ts（projects:1 处 + tasks:1 处）
persistence-local/repos/task-repo-impl.ts       （update / snooze 实体层捕获 + unarchive 记录层）
persistence-sync/sync-tracker.ts                （首写胜合并）
persistence-sync/field-base.ts                  （唯一捕获实现）
```

## 2. ② 护栏真有「牙」（双向验证 + 逐字节还原）

判据（不写规避写法，只记现象与期望/实际）：护栏必须在**新增直写点**与**允许清单内缺 `fieldBase`** 两种情况下都判红，且恢复后零残差。

| 步骤                   | 操作                                                                                                               | 期望                                                                                | 实际                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | -------------------------- |
| 基线                   | `git status --porcelain` + `sha256sum put-with-sync-base.ts`                                                       | 工作区仅我的临时探针测试文件；`88b3956c…af715`                                      | ✅ 一致                    |
| **A** 新增直写点       | 临时新建 `persistence-local/repos/__t675b-teeth-probe.ts`，内含 1 处无 `fieldBase` 的 `syncTracker.markDirty(...)` | 「扫描面非空」+「允许∪豁免清单」+「允许清单内 `fieldBase`」判红                     | ✅ **3 failed / 1 passed** |
| A-还原                 | 删除该临时文件                                                                                                     | 4/4 绿                                                                              | ✅ **4 passed**            |
| **B** 允许清单内缺基准 | 临时删掉 `put-with-sync-base.ts` 中 `markDirty(...)` 的 `fieldBase` 实参                                           | 仅「允许清单内的每个直写点都捕获字段级基准」判红，并指出 `put-with-sync-base.ts:55` | ✅ **1 failed / 3 passed** |
| B-还原                 | 从基线副本还原                                                                                                     | `sha256sum -c` 通过、`git diff --stat` 空、4/4 绿                                   | ✅ 全部一致（`…af715`）    |

> 约束遵守：⛔ 未 `git add` / 未 `commit` 任何临时改动；临时文件与临时实参均已删除/还原，复验后 `git status --porcelain` 为**空**。

## 3. ③ `'none'` 事实复核（`DEF-154` 关闭前提）

- M1 是否引入产出 `remindRepeat=''` / `null` 的写点：**否** ——
    - `field-base.ts` 为纯函数（不写任何字段）；4 处接线只传 `fieldBase`；
    - `grep "remindRepeat\s*=\s*''|remindRepeat:\s*''|remindRepeat\s*=\s*null|remindRepeat:\s*null"`（非测试，全仓）⇒ **0 命中**；
    - `task-repo-impl.ts` 的 3 处 `remindRepeat` 相关行（`:121` create / `:178` update 赋值 / `:538` 记录映射）**均为 M1 之前既有行**（`04f9f0bf` diff 未触碰）。
- 归属归一链未变：`converters.ts:65,106` / `persistence-go/task/converters.ts:60,89` 仍走 `|| 'none'`。
  ⇒ **`'none'` 可达性结论不变，`DEF-154` 关闭前提成立**（重开前提仍为「未来新增产出 `''` 的写点」）。

## 4. ④ 实体层捕获判定是否成立（M2 依赖）

### 4.1 「记录层捕获会带 `plain:` 前缀」**属实**（实测证据）

- `persistence-local/crypto/crypto-service.ts:20` — `PLAIN_PREFIX = 'plain:'`；`:197` — `encrypt(...)` 产出 `plain:<明文>`；`:207` — `decrypt` 识别 `plain:` 直返（业务数据明文落盘姿态）。
- 独立探针实测（同一任务，写后读两种形状）：
    - 记录层：`localDatabase.tasks.get(id).name === 'plain:A0-name'`（探针断言 `startsWith(PLAIN_PREFIX) === true`）；
    - 实体层：`readLocal(id).name === 'A0-name'`；
    - 判等：`valuesEqual(raw.name, entity.name) === false`、`valuesEqual(raw.name, 'A0-name') === false`。

### 4.2 若在记录层捕获会发生什么（可复现说明）

- `B.name = 'plain:A0-name'`，而 `R`（服务端行 → `resToEntity`）与 `L`（本地记录 → `recordToEntity`）都是**实体明文** `'A0-name'` ⇒ `R == B`、`L == B` 全部为假 ⇒ 按 R-2 落「三者两两不等 ⇒ 冲突」⇒ **只要远端行被拉到（哪怕对方没改该字段）就必然记一条冲突**，且合并结论恒取「保一方」⇒ **AC1 / AC5-①③⑦ 全红**，字段级合并整体失效。
- 现有行为面佐证：`t675-ac1-timings` 的 X/Y/Z 与 `ac5-③` 在当前 M1（实体层捕获）下仍红**只因为 M2 尚未实现**；若换成记录层捕获，即使 M2 落地也会因 `B` 形状不符而恒红。

### 4.3 可否统一回记录层？（结论：**不建议**，报 PM 裁决，⛔ 未改码）

| 方案                       | 做法                                                                            | 代价 / 风险                                                                                                                                                                                                                                                           | 判定      |
| -------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| **维持现状（实体层捕获）** | 任务写路径在写前已有旧实体（零额外 IO）；级联/脱归档只改非密文字段 ⇒ 记录层等价 | 捕获点分散在 `update`/`snooze` 两个实体层调用点（各 1 行）                                                                                                                                                                                                            | ✅ 采纳   |
| 记录层捕获 + 消费侧归一    | `B` 存记录层值，M2 比较前对密文字段解密 / 去 `plain:` 前缀                      | ① `mergeBusinessFields` 变 **async** 且依赖 `cryptoService` 解锁 ⇒ 破坏「纯函数、可 100% 单测/变异」；② 历史密文 `base64(iv):base64(ct)` **无法靠前缀剥离** ⇒ 必须真解密 ⇒ 每次比较一次解密；③ 引入「记录层 vs 实体层」第二形状判断 ⇒ 撞 R-1 的「不造第二套口径」精神 | ❌ 不采纳 |

**建议（供 PM 落 ADR 一句）**：`fieldBase` 的捕获形状 = **同步边界形状（实体明文）**；⛔ 不得在记录层捕获密文字段。

### 4.4 我发现的 1 处**同族潜在陷阱**（非本批缺陷，建议登记）

- `project-archive-cascade.ts:42` 的**项目行**捕获是**记录层**（`captureFieldBase(projectRecord, nextProject)`），而 `projects.name` / `projects.description` 同样加密落库（`converters/project.ts:15,18` ⇒ `plain:`）。今天只改 `archivedAt` ⇒ 记录层等价、**无缺陷**；但 **`R-8` 解除后 projects 接入合并时，同一 `plain:` 误判必然复现** ⇒ 建议在后续实体批次里把 projects 写路径一并改为实体层捕获（或届时按 M2 的字段域排除密文字段）。**记为 P3 备忘即可，不阻塞本批。**

### 4.5 答复 rd-fe 的 `restore`/`deletedAt` 提问（我的判定）

- **不该捕获 `deletedAt`**：R-4 明确 `deletedAt` 不进合并域（墓碑整行裁决），捕获即死重；`remove`/`cascadeRemove` 不传 `fieldBase` 正确。
- **但需留档一条已知边界**（非 M1 缺陷，属 ADR「基准缺失 ⇒ 保守」）：`restore` 只改 `deletedAt`（`+ updatedAt`）⇒ 队列项无基准 ⇒ 若此时 pull 到**远端非墓碑**且业务字段有变，合并无法判定 ⇒ 走保守路径（今日 `pull-local-wins` 记一条 + 随后 push 整行覆盖）。即「恢复 + 对方改字段并发」不会自动合并，**建议登记 P3**（不在本批 AC 内）。

## 5. 全量门禁（9 项，逐项 `rc`）

| #   | 命令                                                                | rc                          | 关键行                                                                                                          |
| --- | ------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------- |
| ①   | `pnpm exec vp check`                                                | **0**                       | All **1925** files correctly formatted（含本报告） · no warnings, lint errors, or type errors in **1543** files |
| ②   | `pnpm exec vp test --run`                                           | **1（预期：M2–M4 未实现）** | **415 文件（7 红 / 407 绿 / 1 skip）· 3262 例（14 红 / 3242 绿 / 6 skip）· 256.08s**                            |
| ③   | `pnpm run guard:ddd`                                                | 0                           | domain 包未引用 shared 根桶 / 展示层组件                                                                        |
| ④   | `pnpm exec vp run webapp build`                                     | 0                           | ✓ built in 13.74s                                                                                               |
| ④   | `pnpm run desktop:build`                                            | 0                           | ✓ built in 16.98s                                                                                               |
| ⑤   | `git status --porcelain -- packages/presentation-react apps/mobile` | —                           | **0 行**                                                                                                        |
| ⑥   | `pnpm run guard:gate-pathspec`                                      | 0                           | 门禁命令 pathspec 均存在                                                                                        |
| ⑦   | `pnpm run guard:barrel-imports`                                     | 0                           | 全仓 `@nao-todo/*` 命名导入（含 type-only）均可解析                                                             |
| ⑧   | `pnpm run guard:mobile-imports`                                     | 0                           | 72 源文件未引用 persistence-local / persistence-sync                                                            |
| ⑨   | `pnpm run guard:test-location`                                      | 0                           | 407 受检测试文件均在 `__tests__/`                                                                               |

### 5.1 14 条红逐条对照（与 M0 清单一致 / 不一致）

M0 清单 15 条红 = 下表 14 条 + `直写点-「每个直写点都捕获 fieldBase」`（M1 已**转绿**）。

| #   | 文件                            | 用例                          | M0 是否红 | 现况              | 对照          |
| --- | ------------------------------- | ----------------------------- | --------- | ----------------- | ------------- |
| 1   | `t675-ac1-timings`              | AC1-Y 先 push                 | 红        | 红                | ✅ 一致       |
| 2   | `t675-ac1-timings`              | AC1-Z 先 pull                 | 红        | 红                | ✅ 一致       |
| 3   | `t675-ac2-tags-union`           | AC2 并集不丢                  | 红        | 红                | ✅ 一致       |
| 4   | `t675-ac2-tags-union`           | AC2 幂等                      | 红        | 红                | ✅ 一致       |
| 5   | `t675-ac3-merge-failure`        | AC3 中途失败                  | 红        | 红                | ✅ 一致       |
| 6   | `t675-ac4-stale-no-overlap`     | AC4 stale 零记账              | 红        | 红                | ✅ 一致       |
| 7   | `t675-ac4-stale-no-overlap`     | AC4+ 300ms 双端               | 红        | 红                | ✅ 一致       |
| 8   | `t675-ac5-matrix`               | AC5-③ 我改回原值              | 红        | 红                | ✅ 一致       |
| 9   | `t675-ac5-matrix`               | AC5-④ 顺序差异                | 红        | 红                | ✅ 一致       |
| 10  | `t675-ac5-matrix`               | AC5-⑥ 同毫秒                  | 红        | 红                | ✅ 一致       |
| 11  | `t675-ac5-matrix`               | AC5-⑦ 字段集不相交            | 红        | 红                | ✅ 一致       |
| 12  | `t675-ac5-matrix`               | AC5-⑧ 部分相交                | 红        | 红                | ✅ 一致       |
| 13  | `t675-ac6-tombstone-archive`    | AC6 归档并发                  | 红        | 红                | ✅ 一致       |
| 14  | `t675-field-types-remind-group` | 提醒组（组外改 + 组内对方改） | 红        | 红                | ✅ 一致       |
| —   | `t675-write-point-source-guard` | 允许清单内 `fieldBase`        | 红        | **绿（M1 达成）** | ✅ 按预期转绿 |

**多出的红条数 = 0**；护栏 14 条（M0 的 13 条 + 本项转绿）全绿，含 `mode='lww'` 双态 3 例。

## 6. 未过项 / 风险 / 遗留

- **未过项**：仅 ②（14 红）—— 全部是 M2–M4 尚未实现的设计红，非 M1 缺陷。
- **风险（均已留档，不阻塞）**：
    1. **projects 行记录层捕获**（§4.4）：`R-8` 解除后同族 `plain:` 误判会复现 ⇒ 后续实体批次须改实体层捕获（P3 备忘）。
    2. **`entityBefore` 浅拷贝对数组字段是引用共享**（`task-repo-impl.ts:152,561`）：今天所有写点都是**整体赋值**（`tags`/`remindWeekdays` 就地 `push/splice` 实测 grep = 0）⇒ 安全；若未来新增就地变更数组的写路径，`B` 会被静默污染成新值 ⇒ 届时改深拷（`structuredClone`）。
    3. **`restore` + 对方改字段并发**不自动合并（§4.5 已知边界，ADR「基准缺失 ⇒ 保守」）。
- **遗留（三出口）**：
    - **转办（M2 派单）**：`fieldBase` 形状约定写进 ADR/开工卡（§4.3 建议一句）；`conflictFields` 与字段域口径按 M2 落地。
    - **接受（含到期日）**：上述 3 条风险随 M2/M3 批次复评（不晚于 B 批收口）。
    - **无关闭项**：本轮为复核，不改库存代码，无新增缺陷条目。

## 7. 复跑

```text
git log --oneline -1                       # 期望 04f9f0bf
pnpm exec vp check                         # 0 error
pnpm exec vp test --run                    # 期望 415 文件 / 3262 例 / 14 红（全为 t675 M2–M4）
pnpm exec vp test --run packages/infrastructure/src/persistence-sync/__tests__/t675-   # 9 文件 / 28 例 / 14 红 14 绿
pnpm run guard:ddd && pnpm run guard:gate-pathspec && pnpm run guard:barrel-imports && pnpm run guard:mobile-imports && pnpm run guard:test-location
pnpm exec vp run webapp build && pnpm run desktop:build
```