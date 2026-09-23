# T118 测试提速：先测量、后给方案

- 日期：2026-09-23
- 角色：qa
- 环境：本机 4 核 / 4 CPU · Node v24.20.0 · vitest 4.1.10 · jsdom 30.0.1
- 被测基线：`feat/ocdev` 干净树，HEAD `ea0336b5`（测量期间无其它会话并发跑全仓，`ps` 实测 vitest 进程数 = 0）
- 范围：**只测量、只给方案**。⛔ 未改任何实现代码 / 配置（临时探针文件已删除并 `git status` 复核）

---

## 一、结论（先看这里）

1. **套件是「聚合工作量」驱动，不是「调度/并行度」驱动。** 全仓聚合工作量 ≈ **243.5s**，wall ≈ **90s**，平均并发 **2.7 / 3 worker**（≈90% 利用率）。⇒ 想提速必须**减少聚合工作量**（重复 import、环境搭建、冗余 setup），**不是加 worker**。
2. **第一大可消除成本：`import` 聚合 69.82s** —— 根因是**内部包 barrel**（`packages/infrastructure/index.ts` 等 `export *` 全层导出）在 `isolate: true` 下**被每个测试文件重复全量导入**。实测单文件重导入成本 **~2.6s**，而该文件真正跑测试只花 **6ms**。
3. **第二大成本：`environment` 聚合 75.07s（占聚合工作量 30.8%）** —— 全部是 **jsdom 每文件重建**。受控实测：同样一个 trivial 测试，jsdom = **1.05s（environment 821ms）**，node = **0.224s（environment 1ms）**。⇒ **jsdom 税 ≈ 0.82s/文件 × 65 文件 ≈ 53s**。
4. **`tests` 聚合 82.05s（占聚合工作量 33.7%）** 是真实业务工作量（Dexie/IndexedDB/crypto），其中 **8 个 infrastructure 文件占 66.06s（全仓测试执行量的 75.4%）**，`local-repos.test.ts` 单文件 **24.29s** 是**关键路径起点**。
5. **最快的迭代命令是「显式路径」，不是 `--changed`**：显式路径 4.8s wall vs `--changed` 10.1s wall（固定开销 ~10s）vs `related --run` 16.1s wall。
6. **`--no-isolate` 能省 36% 时间（90s→58s），但 37 个测试变红 ⇒ 现状不可用**（跨文件状态泄漏）。它是「未来潜在收益」而非「立刻可做」。
7. **附带发现（缺陷候选）**：`sync.test.ts` 的 `BC-6/SHELL-06 退避未到期` 用例是**时间敏感 flaky**（同一提交下 isolate 跑 1 红、no-isolate 跑全绿、两次全仓均全绿）。建议登记缺陷池。

---

## 二、基线数字（全仓，3 次以内）

| 运行 | 配置                      | wall      | Test Files     | Tests                  | Duration 分解（transform / import / tests / environment） |
| ---- | ------------------------- | --------- | -------------- | ---------------------- | --------------------------------------------------------- |
| #1   | 默认（`--reporter=json`） | **89.5s** | 148            | 1254 passed / 0 failed | （JSON 无分解）CPU 249%、峰值 RSS 589MB                   |
| #2   | 默认（默认 reporter）     | **90s**   | 148            | 1254 passed / 0 failed | 87.59s = **16.59 / 69.82 / 82.05 / 75.07**                |
| #3   | `--no-isolate`            | **58s**   | 9 failed / 139 | **37 failed** / 1217   | 54.59s = 18.51 / **43.14** / 82.60 / 68.60                |

> 注：Duration 分解是**跨 worker 的聚合和**，可大于 wall。聚合总工作量（#2）= 16.59+69.82+82.05+75.07 = **243.53s** ÷ 90s wall = **平均并发 2.7**（worker 数上限实测 = 3）。
> 与 PM 基线（148 文件 / 1254 例 / 82–156s）一致：**148 / 1254 复现**，wall 落在区间下沿（干净树 + 无并发会话）。

---

## 三、Q1：每文件耗时分解（top 15）

按**测试执行耗时**（JSON `endTime - startTime`）排序，全 148 文件合计 87.67s，**top 15 占 86.0%**。

| #   | 耗时       | 环境      | 例数 | 文件                                                                                       |
| --- | ---------- | --------- | ---- | ------------------------------------------------------------------------------------------ |
| 1   | **24.29s** | node      | 59   | `packages/infrastructure/src/persistence-local/__tests__/local-repos.test.ts`              |
| 2   | 13.34s     | node      | 34   | `packages/infrastructure/src/persistence-sync/__tests__/sync.test.ts`                      |
| 3   | 9.07s      | node      | 12   | `packages/infrastructure/src/persistence-sync/__tests__/def6-mirror-completeness.test.ts`  |
| 4   | 6.00s      | node      | 12   | `packages/infrastructure/src/persistence-local/__tests__/crypto-service.test.ts`           |
| 5   | 4.08s      | **jsdom** | 13   | `packages/infrastructure/src/persistence-go/fallback/__tests__/mirror-fallback.test.ts`    |
| 6   | 3.36s      | node      | 5    | `packages/infrastructure/src/persistence-local/__tests__/plaintext-migration.test.ts`      |
| 7   | 3.29s      | node      | 5    | `packages/infrastructure/src/persistence-local/__tests__/deletion-service.test.ts`         |
| 8   | 2.64s      | node      | 7    | `packages/infrastructure/src/persistence-sync/__tests__/pull-single-master.test.ts`        |
| 9   | 1.57s      | jsdom     | 19   | `apps/web/src/components/calendar/daily/__tests__/day-interaction-adjustments.test.ts`     |
| 10  | 1.57s      | jsdom     | 2    | `apps/desktop/src/renderer/src/__tests__/def6-mirror-e2e.test.ts`                          |
| 11  | 1.56s      | jsdom     | 14   | `apps/web/src/components/calendar/daily/__tests__/day-pan.test.ts`                         |
| 12  | 1.55s      | node      | 4    | `packages/infrastructure/src/persistence-sync/__tests__/mirror-status-persistence.test.ts` |
| 13  | 1.33s      | jsdom     | 13   | `apps/web/src/components/calendar/daily/__tests__/daily-interactions.test.ts`              |
| 14  | 0.88s      | jsdom     | 20   | `apps/web/src/components/search/__tests__/aside.test.ts`                                   |
| 15  | 0.88s      | jsdom     | 5    | `apps/web/src/components/calendar/monthly/__tests__/day-nav-shortcut.test.ts`              |

**关键结构事实**：**top 8 全是 infrastructure，合计 66.06s = 全仓测试执行量的 75.4%**；其余 140 个文件合计仅 ~21.6s。
`local-repos.test.ts` 在 t=0 启动、独占 24.29s，是**唯一关键路径**（首轮 3 文件并发窗口 = 26s，由它封顶）。

**按顶层目录**（测试执行耗时占比）：`packages` 73 文件/640 例/**72.8s（83.1%）** · `apps/web` 67/564/**12.2s（13.9%）** · `apps`（desktop）8/50/**2.6s（3.0%）**。

---

## 四、Q2：环境成本（jsdom 是否主成本？）

**是——jsdom 是「聚合工作量」的最大单项之一，但不是「测试执行」的主要成本。**

| 环境  | 文件数    | 例数 | 测试执行合计 | 占比  | 平均 ms/例 |
| ----- | --------- | ---- | ------------ | ----- | ---------- |
| jsdom | 65（44%） | 461  | 21.3s        | 24.3% | **46ms**   |
| node  | 83（56%） | 793  | 66.3s        | 75.7% | **84ms**   |

但**测试执行耗时严重低估 jsdom 成本**。受控对照（同样 trivial 内容，仅换 docblock，各跑 1 次）：

| 探针（trivial，1 例）          | wall Duration | transform | import | tests | **environment** |
| ------------------------------ | ------------- | --------- | ------ | ----- | --------------- |
| `// @vitest-environment jsdom` | **1.05s**     | 24ms      | 38ms   | 4ms   | **821ms**       |
| `// @vitest-environment node`  | **0.224s**    | 25ms      | 40ms   | 4ms   | **1ms**         |

⇒ **jsdom 环境搭建 ≈ 0.82s/文件（固定税）**。65 个 jsdom 文件 ⇒ **~53s 纯环境搭建**，与全仓 `environment` 聚合 **75.07s** 吻合（差值来自少数重文件的环境额外开销）。
⇒ 一个 trivial 测试放 jsdom 里就要 **1.05s**，放 node 里只要 **0.224s**：**4.7 倍**。

---

## 五、Q3：导入成本（被重复导入且昂贵的模块）

### 5.1 硬证据：overhead 吃掉 97%

同一批 **20 个「测试执行最快」的文件**（按 JSON 耗时选的，测试执行合计仅 0.2s）：

| 运行    | wall Duration | transform | import     | tests     | environment |
| ------- | ------------- | --------- | ---------- | --------- | ----------- |
| 20 文件 | **6.22s**     | 7.44s     | **12.14s** | **0.20s** | 1.00s       |

⇒ **真正跑测试只占 3%，97% 是 transform + import + environment。**

### 5.2 逐文件归因（20 个文件各跑 1 次，取 `Duration` 行）

明显分成两类：

| 类别     | 文件数 | wall           | transform      | import         |
| -------- | ------ | -------------- | -------------- | -------------- |
| 便宜     | 16     | ~0.22–0.33s    | 31–118ms       | 46–216ms       |
| **昂贵** | **4**  | **1.94–2.83s** | **1.30–2.06s** | **1.69–2.65s** |

4 个昂贵文件（**tests 只有 6–10ms**）：

| wall  | transform | import | 文件                                                                                      | 它 import 了什么                                         |
| ----- | --------- | ------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 2.83s | 2.06s     | 2.65s  | `apps/web/src/views/auth/offline-prerequisites.test.ts`                                   | 仅 `vite-plus/test` + `./offline-prerequisites`          |
| 2.80s | 2.04s     | 2.62s  | `apps/web/src/views/auth/__tests__/offline-entry-positive.test.ts`                        | 仅 `vite-plus/test` + `../offline-prerequisites`         |
| 2.65s | 1.30s     | 1.69s  | `apps/web/src/offline-read-only.test.ts`                                                  | `@nao-todo/presentation/offline` + `./offline-read-only` |
| 1.94s | 1.36s     | 1.77s  | `packages/presentation/task/components/multi-select/__tests__/use-batch-executor.test.ts` | `vue` + `dayjs` + `@nao-todo/shared`                     |

### 5.3 根因：**barrel 全层导出 × `isolate: true` = 每文件重付**

`apps/web/src/views/auth/offline-prerequisites.ts` 全部 import 只有一行：

```text
1:import {
6:} from '@nao-todo/infrastructure'
```

而 `packages/infrastructure/index.ts`（**4 行文件**）是：

```text
export * from './src/built-in'
export * from './src/observability'
export * from './src/persistence-go'
export * from './src/persistence-local'
export * from './src/persistence-sync'
```

⇒ 一个只用到 1 个 helper 的测试文件，被迫 **transform + import 整个 infrastructure 层（`packages/infrastructure/src` 共 106 个 .ts，含 Dexie / crypto / sync 引擎）**，代价 **~2.6s**。
`isolate: true`（默认）下**每个测试文件都重新付一遍**（模块注册表每文件重置）。
`packages/shared/index.ts` 同型（10 条 `export *`）。

**测试文件直接 import 各 barrel 的数量**：`@nao-todo/domain-task` **41** · `@nao-todo/shared` **17** · `@nao-todo/presentation` **13** · `@nao-todo/presentation/offline` **3** · `@nao-todo/infrastructure` 0（**全是经中间模块间接引入**，故 grep 无法发现 —— 必须看 import 图）。

**`css?raw` 不是成本来源**（已排除）：仅 5 个测试文件用 `query: '?raw'`，CSS 资源均 1–9KB，非热路径。

---

## 六、Q4：单因素对照实验（≤3 组，子集）

**子集 S = 上述 20 个「测试执行最快」文件**（97 例）。选它是因为它把「overhead」信号最大化、且单次仅 ~6s。

| 组          | 唯一变更                                    | wall Duration | 相对 control     | transform | import | tests  | 语义       |
| ----------- | ------------------------------------------- | ------------- | ---------------- | --------- | ------ | ------ | ---------- |
| **control** | 默认（forks · isolate=true · 默认 workers） | **6.22s**     | —                | 7.44s     | 12.14s | 0.20s  | 97/97 pass |
| **E1**      | `--pool=threads`                            | 6.47s         | **+4%（更慢）**  | 6.20s     | 10.39s | 0.196s | 97/97 pass |
| **E2**      | `--no-isolate`                              | **4.60s**     | **−26%（更快）** | 6.47s     | 9.57s  | 0.107s | 97/97 pass |
| **E3**      | `--maxWorkers=4`                            | 6.85s         | **+10%（更慢）** | 11.47s    | 17.45s | 0.298s | 97/97 pass |

**读法**：

- **E1 `threads` 无收益**（+4%）；import 略降但 wall 反升 ⇒ 4 核机上 fork↔thread 不是瓶颈。
- **E2 `--no-isolate` 是唯一有效项**（−26%），机制正是**省掉重复 import**（模块注册表跨文件共享）。
- **E3 `maxWorkers=4` 反而更慢（+10%）**，且 transform/import **聚合反升**（11.47s / 17.45s）⇒ **4 个 worker 抢 4 个核 + 主进程 = 过订阅，且每个 worker 各建一份模块图 ⇒ 重复 transform**。默认 3 worker 已是 4 核机的较优点。

### 6.1 优胜项的全仓验证（`--no-isolate`）——**结论：不可用**

| 运行              | wall            | Test Files         | Tests                | import 聚合        |
| ----------------- | --------------- | ------------------ | -------------------- | ------------------ |
| #2 默认           | 90s             | 148 passed         | 1254 passed          | 69.82s             |
| #3 `--no-isolate` | **58s（−36%）** | **9 failed / 139** | **37 failed / 1217** | **43.14s（−38%）** |

失败形态全部是**跨文件状态泄漏**（正是 `isolate` 要防的）：

- `TypeError: __vite_ssr_import_1__.cryptoService.hasKeyBundle is not a function`（`unlock-gate` ×9）
- `DatabaseClosedError: MissingAPIError IndexedDB API missing`（`deletion-wipe` ×5，jsdom/IndexedDB 被前一个文件 teardown 掉）
- `TypeError: Cannot read properties of undefined (reading 'ok')`、`vi.mock` 泄漏（`use-export-task` / `initial-sync-gate` / `check-in` 等）

⇒ **`--no-isolate` 有真实 36% 收益，但需要先修跨文件泄漏才能启用**（P2，见方案表）。

### 6.2 子集风险复核中发现的 flaky 用例

`packages/infrastructure` 子集对照：

| 运行            | 结果                                         |
| --------------- | -------------------------------------------- |
| 默认（isolate） | **1 failed** / 20 passed（227 passed / 228） |
| `--no-isolate`  | **21 passed / 228 passed**                   |

失败用例：`sync.test.ts > BC-6/SHELL-06：退避未到期 ⇒ 运行必终结且不误发；start 重置退避后可重试`。
同一提交下**时红时绿**（两次全仓均全绿）⇒ **时间敏感 flaky**（退避到期判定依赖真实时钟/负载）。**建议登记缺陷池（DEF 候选，非本次范围）。**

---

## 七、Q5：迭代提速可行性（改一个文件后最快的验证命令）

**`--changed` 支持 ✅**（`--changed [since]`，vitest 4.1.10）；**`related` 支持 ✅**；**按路径过滤 ✅**。实测 wall（含进程启动 ~2s）：

| 命令                                                       | 选中文件/例 | Duration | **wall**  | 说明                                                                       |
| ---------------------------------------------------------- | ----------- | -------- | --------- | -------------------------------------------------------------------------- |
| `pnpm exec vp test --run --changed`（**干净树**）          | 0           | —        | **2.2s**  | 输出 `No test files found, exiting with code 0`，行为正确                  |
| `pnpm exec vp test --run --changed`（改 1 个测试文件）     | 1 / 6       | 228ms    | **10.1s** | 固定开销 ~10s（git diff + 受影响集推导）                                   |
| `pnpm exec vp test related --run <src>`                    | 7 / 46      | 7.05s    | **16.1s** | 改 **src** 时的「受影响面」正确，但**过度选择**（1 个 src → 7 文件）且最慢 |
| `pnpm exec vp test --run <显式 test 路径>`                 | 1 / 5       | 2.71s    | **4.8s**  | **最快**（该文件是 jsdom + barrel，属最贵一档；node 文件 ~2–3s）           |
| `pnpm exec vp test related --run <仅经 barrel 可达的 src>` | **0**       | —        | 11.9s     | ⚠️ **盲区**：`crypto-service.ts` 经 barrel 被引用时 `related` 找不到测试   |

### 推荐命令（写进纪律）

```text
# 改的是测试文件本身（绝大多数迭代场景）—— 最快
pnpm exec vp test --run <改动的 test 文件路径>

# 改的是 src，且该 src 被直接 import（非仅经 barrel）—— 安全面
pnpm exec vp test related --run <改动的 src 路径>

# 不确定影响面 / 想省事（接受 ~10s 固定开销）
pnpm exec vp test --run --changed

# ⛔ 不要用 --changed 追速度：它比显式路径慢 2 倍（10.1s vs 4.8s）
# ⛔ 不要因为 related 找不到就以为「无影响」：经 barrel 的引用是 related 的盲区
```

**对 `related` 盲区的实操兜底**：改 src 前先 `grep -rl "<symbol>" packages apps --include="*.test.ts"`，或对 barrel 类改动直接跑所属包（`vp test --run packages/<pkg>`，如 infrastructure 全包 29.5s）。

---

## 八、方案表

优先级：**P0 = 立刻可做（零/低风险，收益确定）** · **P1 = 建议（需一次验证或少量改动）** · **P2 = 观察（收益大但风险/成本高）**

| #   | 改动                                                                                                                                                                                 | 预期收益                                                                                                                       | 风险                                                                                                    | 代价                                      | 优先级 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------ |
| 1   | **迭代命令规范化**：迭代期用**显式 test 路径**，弃用 `--changed`（10.1s→4.8s）；改 src 用 `related --run` 并注意 barrel 盲区                                                         | 单文件迭代 **−50% wall**（10.1s→4.8s）；每日累积可观                                                                           | **零**                                                                                                  | 只改纪律/文档                             | **P0** |
| 2   | **拆分 `local-repos.test.ts`（24.29s，唯一关键路径）** 为 3–4 个按域切分的文件（如 repos CRUD / 查询 / 迁移）                                                                        | 关键路径 24.3s → 理论 ~8s；首轮窗口 26s → ~~15s（**全仓 −8~~12%**）                                                            | **低**（只动测试组织，不改断言）                                                                        | 低（1 文件重排 + 复跑该包）               | **P0** |
| 3   | **消除测试对 barrel 的间接依赖**：测试/被测模块改**深路径导入**（如 `@nao-todo/infrastructure/src/persistence-local/crypto-service`），或按层拆分 `packages/infrastructure/index.ts` | 单文件 import **2.6s → ~0.2s**；受影响面约 60 文件，**全仓 import 聚合 69.82s 可望腰斩**（−20~30s wall）                       | 中（动生产 import 结构需 arch 评审；深路径导入会改测试代码，面较大）                                    | 中                                        | **P1** |
| 4   | **评估 `happy-dom` 替换 jsdom**（新增依赖 + 改 65 处 docblock 或去掉 docblock 走全局默认）                                                                                           | `environment` 聚合 **75.07s（30.8%）** 是最大单项；jsdom 实测 **821ms/文件**，happy-dom 通常快 3–10× ⇒ 目标省 **~15–20s wall** | **中高**：新依赖 + happy-dom 与 jsdom 语义差异（DOM API 完整度/事件模型），需**全量回归**               | 中（加依赖 + 批量改 docblock + 全仓验证） | **P1** |
| 5   | **全仓验证一次 `--maxWorkers=4`**（批末跑 1 次，只变这一个因素）                                                                                                                     | 实测平均 CPU 利用率仅 **249%/400% = 62%**，理论上限 +5~10%；但子集 E3 显示 **+10% 更慢**（矛盾，需全仓定论）                   | 低（只改 CLI 参数，可回退）                                                                             | **低（1 次全仓 ~90s）**                   | **P1** |
| 6   | **减少 jsdom 文件数**：逐个核实 65 个 jsdom 文件中哪些其实不需要 DOM（纯逻辑/hook 测试），改回 node                                                                                  | 每改 1 个文件省 **~0.82s 聚合**；若 65→30，省 ~28s 聚合 ≈ **−9s wall**                                                         | 中（需逐个验证，改错会真红）                                                                            | 中高（65 文件排查）                       | **P2** |
| 7   | **`--no-isolate` 分段启用**（先修跨文件泄漏，再按包/环境开 `isolate:false`）                                                                                                         | **−36% wall（90s→58s）**，本次测得的最大单项收益                                                                               | **高**：现状 **37 红**（IndexedDB 被 teardown、模块单例、`vi.mock` 泄漏）；需先做「测试间状态隔离」专项 | 高（专项修复 + 全量回归）                 | **P2** |
| 8   | **全仓 `vp test` 加 `--reporter=default` 之外的机器可读产物**（如 `--reporter=json`）供后续 profiling 复用                                                                           | 无提速；但让「谁的面转红」定位更快                                                                                             | 零                                                                                                      | 极低                                      | **P2** |

### 不建议做的事（避免后人重复踩）

| 项                                                   | 实测证据                                                                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| ❌ **`--pool=threads`**                              | 子集 E1：**6.22s → 6.47s（+4%，更慢）**。import 聚合略降但 wall 反升。                                                |
| ❌ **`--maxWorkers=4`（4 核机）**                    | 子集 E3：**6.22s → 6.85s（+10%，更慢）**，且 transform/import 聚合**反升**（重复 transform）。默认 3 worker 已较优。  |
| ❌ **全仓 `--no-isolate`（当前状态）**               | 全仓 #3：**−36% wall 但 37 红 / 9 文件**。跨文件状态泄漏。                                                            |
| ❌ **用 `--changed` 追迭代速度**                     | 固定开销 **~10.1s** > 显式路径 **4.8s**（慢 2 倍）。                                                                  |
| ❌ **并发跑全仓**                                    | AGENTS.md 已禁；PM 实测 82↔156s 抖动主因。本次测量全程 `ps` 确认独占。                                                |
| ❌ **在 `css?raw` / CSS 上做优化**                   | 仅 5 个测试文件使用 `?raw`，CSS 均 1–9KB，**非热路径**（已排除）。                                                    |
| ❌ **盲目给 `related` 结果当「影响面全集」**         | `related` 对**仅经 barrel 可达的 src** 会返回 **0 文件**（`crypto-service.ts` 实测），是**盲区**，不是「无影响」。    |
| ❌ **把 `environment 75s` 当成「jsdom 文件测试慢」** | 两个不同成本：jsdom **环境搭建** 0.82s/文件（固定税）≠ 测试执行（jsdom 平均 **46ms/例，反而比 node 的 84ms 更省**）。 |

---

## 九、未做项 / 边界

- ⛔ **未改任何实现代码 / `vite.config.ts`**（本报告纯测量 + 方案）。临时探针文件 `apps/web/src/__t118-env-{jsdom,node}.test.ts` 已删除，`git status --porcelain` 复核为空。
- ⛔ **未跑第 4 次全仓**（PM 上限 3 次，已用满：#1 json 基线 / #2 默认基线+分解 / #3 `--no-isolate` 验证）。⇒ **方案 #5（`maxWorkers=4` 全仓）留给批末 PM/qa 跑**。
- ⛔ **未测 `happy-dom`**：仓库**未安装** `happy-dom`（`node_modules/happy-dom` 不存在），装依赖超出「只测量」范围。方案 #4 的收益为**基于 jsdom 实测 821ms/文件 + 行业经验的估算**，非本项目实测。
- ⛔ **未做覆盖度/正确性变更**：本次不评估「提速后是否漏测」；方案 #3/#6/#7 若落地**必须**配全量回归。
- ⚠️ **单机 4 核、无并发会话**：绝对 wall 数字随机器负载波动（PM 基线 82–156s），**相对比值（−26% / −36% / +4% / +10%）比绝对值更可信**。
- ⚠️ **flaky 用例未登记**：`sync.test.ts` BC-6/SHELL-06（时间敏感）建议 PM 登记缺陷池，超出本任务范围。
- 未复核 `--changed` 对**未跟踪新文件**的行为（本次只测了跟踪文件的修改）。

---

## 十、复现命令

```text
# 基线 + 逐文件耗时（JSON）
pnpm exec vp test --run --reporter=json --outputFile=/tmp/full.json
# 聚合分解（transform / import / tests / environment）
pnpm exec vp test --run
# 环境税受控对照：同内容 trivial 文件，仅换 docblock
#   // @vitest-environment jsdom   → environment 821ms
#   // @vitest-environment node    → environment 1ms
pnpm exec vp test --run <单个 test 文件>
# 单因素对照（子集）
pnpm exec vp test --run --pool=threads <子集>
pnpm exec vp test --run --no-isolate <子集>
pnpm exec vp test --run --maxWorkers=4 <子集>
```