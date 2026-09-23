# 2026-09-23 生产 barrel 拆分（T120b）可行性评审 —— 结论：**折中（收窄 import 面），否决「按层拆 barrel」与「删除根桶导出」**

- **日期**：2026-09-23
- **状态**：✅ 已接受（评审结论）｜⏳ 待 PM 拍板 D1–D5（§7）
- **评审对象**：T121 / T120b ——「生产 barrel 拆分」可行性、收益、风险
- **依据**：`docs/qa/2026-09-23-test-speed-profiling.md`（T118，`63cecabe`）；`docs/tasks-state.md` T118/T119/T120a/T121 条
- **范围**：`packages/infrastructure/index.ts`、`packages/shared/index.ts` 的**生产**导入面（barrel / 子路径 / `exports` 字段）与**消费者迁移面**
- **非范围**：`domain-*` 包的 `index.ts`（同型问题，另单）；`packages/shared/components` 内部组件结构重构；测试文件自身的深路径导入（= **T120a**，`qa-T119` 在制，本 ADR 不重复派发）
- **代码边界**：本 ADR 为**纯文档产出**，评审方**未修改任何仓库代码**（含 `package.json`、`index.ts`、`vite.config.ts`）；测量用临时脚本全部位于 `/tmp`，未落仓
- **影响面工具**：本次为**导入图（import graph）**问题，非符号调用面 ⇒ `codegraph impact/callers` 不适用；改用**自建静态导入图 + Vite SSR 真实模块图计数**（§2），已在下文标注为「未过项」之一

---

## 0. 结论摘要（先看这里）

| #      | 问题                   | 结论                                                                                                                                                                                 |
| :----- | :--------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q1** | 生产 barrel 是否应拆？ | **不应按「层」拆，也不应删根桶导出**。应做的是**收窄消费者的 import 面**（窄子树子路径）。层粒度实测几乎无收益（§2.3）。                                                             |
| **Q2** | 收益估算               | 测试侧：**W1（4 行改动）−8.5% 模块 / −16.5% Vue SFC**；W1+W3a **−16.4% / −39.7%**；全做 R+W3b **−22.9% / −39.7%**。生产构建侧：**≈ 0**（Rollup tree-shake），不作为收益依据。        |
| **Q3** | 风险面                 | 4 条逐条核实（§5）。**1 个真实新风险**：把「深路径」改成「**层子路径**」会把 Dexie 拖进移动端；**1 个既有失效**：AGENTS.md 移动端红线门禁 pathspec 写的是不存在的 `apps/mobileapp`。 |
| **Q4** | 建议做 / 不做 / 折中   | **折中 = 做 W1（强烈建议）+ W2（建议）；W3a/W3b 本轮不做（单独立卡）；否决 option ② 与 `exports`**（§3、§6）。                                                                       |

**一句话**：T118 的「barrel 根因」判断**成立**，但**解法不是拆 `index.ts`**，而是**把那 4+20 个「只需要一个 helper 却 import 了整层」的生产模块改成窄子路径**；其中**最高 ROI 是 `packages/infrastructure` 内 4 处对 `@nao-todo/shared` 根桶的导入**（4 行代码，换来 **−16.5% 的 Vue SFC 重复 transform**）。

---

## 1. 事实核对：对 PM 输入信封 / T118 报告的 6 处更正与补强

| #      | 原述                                                                                    | 核实结果                                                                                                                                                                                                                                                                                                             | 证据                                                                                                         |
| :----- | :-------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| **P1** | 「`packages/infrastructure/index.ts` **仅 5 行** `export *`」                           | ✅ **对**（5 行）。T118 报告 §5.3 正文写「4 行文件」与其代码块（5 行）不一致，属笔误。                                                                                                                                                                                                                               | `packages/infrastructure/index.ts`（5 行）；`packages/shared/index.ts`（10 行）                              |
| **P2** | 「只 import 1 个 helper 也要 transform + import 整层 **≈106 文件 ≈2.6s**」              | ⚠️ **低估**。106 = `packages/infrastructure/src` 的 `.ts` 总数（含测试）；**运行时真实闭包 = 360 个模块**（`infrastructure` 根桶 + `shared` 根桶 163 + `domain-*` 根桶），因为 **infra 内 4 个源文件 import 了 `@nao-todo/shared` 根桶**。**这是最重要的补强**：只拆 infrastructure 的桶，收益会被 shared 根桶吃掉。 | §2.1 实测 `infrastructure/index.ts` = **360 模块**；`grep -n "@nao-todo/shared" packages/infrastructure/src` |
| **P3** | 「`packages/shared/index.ts` 同型（10 条 `export *`）」                                 | ⚠️ **不完整**。10 条 `export *` 里**只有 `./components` 一条是成本源**：`shared/index.ts` 闭包 163 模块，而 `shared/components/index.ts` 单独就是 **163 模块** ⇒ 其余 9 条合计去重后 ≈ 89 模块。**真正的成本是 38 个 Vue SFC 被焊在根桶上**。                                                                        | §2.1；`packages/shared/components/index.ts`（38 条 `export *`）                                              |
| **P4** | 「测试文件直接 import `@nao-todo/infrastructure` **0**」                                | ✅ **对**（直引 0），但**间接可达 25 个测试文件**（静态图）；且 **`apps/*` 侧有 20 个直引根桶的生产模块**被测试可达（§6.2）。                                                                                                                                                                                        | §2.2、§6.2                                                                                                   |
| **P5** | 「受影响面约 **60 文件**」                                                              | ⚠️ **偏保守/口径不同**。若含「只取非组件符号」的根桶消费者，`@nao-todo/shared` 根桶的**值导入消费者共 203 个非测试文件**（其中 124 个完全不取组件符号 = **零迁移成本受益者**）。                                                                                                                                     | §2.4 分类统计                                                                                                |
| **P6** | 「移动端红线 = `git status --porcelain -- packages/presentation-react apps/mobileapp`」 | ❌ **门禁半失效**：**`apps/mobileapp` 目录不存在**（真实路径 `apps/mobile`，包名仍为 `@nao-todo/mobileapp`）。`git` 对不存在的 pathspec 静默忽略 ⇒ 该门禁**恒为 0**，实际只覆盖 `packages/presentation-react`。                                                                                                      | `ls -d apps/mobileapp` → No such file；`apps/mobile/package.json` name = `@nao-todo/mobileapp`               |

---

## 2. 实测证据（可复现，仓库未改动）

### 2.1 入口模块图计数（Vite SSR 真实加载，`ssr.noExternal: /@nao-todo\//`，逐入口独立 server 以模拟 `isolate`）

| 入口                                                                                 | 模块数    |
| :----------------------------------------------------------------------------------- | :-------- |
| `@nao-todo/infrastructure`（**根桶**）                                               | **360**   |
| `@nao-todo/shared`（**根桶**）                                                       | **163**   |
| `infra /persistence-local`（层）                                                     | 299       |
| `infra /persistence-sync`（层）                                                      | 290       |
| `infra /persistence-go`（层）                                                        | 172       |
| `shared /components`（子树）                                                         | **163**   |
| `shared /utils`                                                                      | 50        |
| `shared /hooks`                                                                      | 15        |
| `shared /requester`                                                                  | 6         |
| `shared /locales`                                                                    | 5         |
| `shared /constants`                                                                  | 4         |
| `shared /valueobjects`                                                               | 3         |
| `shared /types`                                                                      | 1         |
| `shared /entity`                                                                     | 1         |
| `infra /persistence-local/db/local-database`（叶）                                   | 39        |
| `infra /persistence-local/session/local-session`（叶）                               | 38        |
| `infra /persistence-go/utils`（叶）                                                  | 38        |
| `shared /utils/avatar`、`/constants/storage-keys`、`/valueobjects/json-string`（叶） | 1 / 1 / 1 |

**读法（决定性）**：

- **层粒度无效**：`persistence-local` = **299** vs 根桶 **360** ⇒ 按层拆只省 **17%**；而 `persistence-local` 正是**最贵测试所在层**（T118：`local-repos.test.ts` 24.29s、`crypto-service.test.ts` 6.00s、`plaintext-migration` 3.36s、`deletion-service` 3.29s）。
- **子树粒度极有效**：`shared/types` 1 / `shared/locales` 5 / `shared/valueobjects` 3 vs 根桶 **163** ⇒ 窄子路径可省 **98%**。

### 2.2 单个生产模块的「根桶代价」（同一 harness）

| 模块                                                       | 现状 import                       | 模块数  |
| :--------------------------------------------------------- | :-------------------------------- | :------ |
| `infra/persistence-local/converters/task.ts`               | 无 shared 根桶                    | **73**  |
| `infra/persistence-local/converters/preference.ts`         | `@nao-todo/shared`（取 1 个 VO）  | **246** |
| `infra/persistence-local/deletion/local-storage-policy.ts` | `@nao-todo/shared`（取 1 个常量） | **200** |
| `infra/persistence-sync/sync-config.ts`                    | 无 shared 根桶                    | **1**   |
| `infra/persistence-sync/epoch.ts`                          | `@nao-todo/shared`（取 1 个函数） | **202** |
| `presentation/task/.../use-batch-executor.ts`              | `@nao-todo/shared`（取 `t`）      | **165** |
| `apps/web/views/auth/offline-prerequisites.ts`             | infra 根桶 + shared 根桶          | **361** |
| `apps/web/components/app/aside-v2/use-aside.ts`            | infra 根桶 + shared 根桶          | **403** |

⇒ **「取 1 个 helper 付整层」是实测事实**（`preference.ts` 246 vs `task.ts` 73 ⇒ 单条 shared 根桶导入 = **+173 模块**）。

### 2.3 逐测试文件模块图（148 个测试文件闭包之和 = Σmod / Σvue）

| 方案                                                                                  | Σmod  | Σvue | ΣKB   | 相对 S0（mod / vue / KB）    |
| :------------------------------------------------------------------------------------ | :---- | :--- | :---- | :--------------------------- |
| **S0 基线**                                                                           | 22735 | 3448 | 50903 | —                            |
| **W1**：`infrastructure` 内 **4 处** `@nao-todo/shared` 根桶值导入 → 窄子路径         | 20801 | 2878 | 47353 | **−8.5% / −16.5% / −7.0%**   |
| **W1+W3a**：+ 从 `shared/index.ts` 摘除 `export * from './components'` + 迁移 79 文件 | 19016 | 2080 | 45855 | −16.4% / **−39.7%** / −9.9%  |
| **R = W1+W3a+W2**：+ `apps/*` 20 个根桶消费者 → infra 层子路径                        | 18500 | 2080 | 44728 | **−18.6% / −39.7% / −12.1%** |
| **R+W3b**：+ 全部 ~150 个 shared 根桶消费者 → 窄子路径                                | 17520 | 2080 | 42317 | −22.9% / −39.7% / −16.9%     |

> 模型自检：`S0（建模）` 与 `P0（纯解析、不建模）` 三项数字**完全一致**（22735 / 3448 / 50903）⇒ 建模未失真。
> `Σvue` = 跨测试文件累计的 `.vue` 模块 transform 次数，是**比模块数更贴近耗时**的代理（Vue SFC transform 远贵于普通 `.ts`）。

### 2.4 逐文件收益（T118 点名的昂贵文件）

| 测试文件                                                                     | T118 实测 wall | S0       | W1          | W1+W3a     | R(+W2)      |
| :--------------------------------------------------------------------------- | :------------- | :------- | :---------- | :--------- | :---------- |
| `infra/persistence-sync/__tests__/sync.test.ts`（#2 最慢 13.34s）            | 13.34s         | 297m/38v | **172m/0v** | 172m/0v    | 172m/0v     |
| `apps/web/.../offline-entry-positive.test.ts`                                | 2.80s          | 366m/38v | **245m/0v** | 245m/0v    | **177m/0v** |
| `presentation/task/.../use-batch-executor.test.ts`                           | 1.94s          | 170m/38v | 170m/38v    | **85m/0v** | 85m/0v      |
| `apps/web/src/offline-read-only.test.ts`                                     | 2.65s          | 176m/38v | 176m/38v    | **91m/0v** | 91m/0v      |
| `apps/web/.../write-gate-wiring.test.ts`                                     | —              | 372m/38v | 372m/38v    | 287m/0v    | **257m/0v** |
| `infra/persistence-local/__tests__/crypto-service.test.ts`                   | 6.00s          | 40m/0v   | 40m/0v      | 40m/0v     | 40m/0v      |
| `apps/web/.../routes.test.ts`                                                | —              | 221m/41v | 221m/41v    | 221m/41v   | 221m/41v    |
| `apps/web/components/calendar/daily/.../day-interaction-adjustments.test.ts` | 1.57s          | 627m/95v | 627m/95v    | 627m/95v   | 625m/95v    |

⇒ **W1 一项就让 13.34s 的 `sync.test.ts` 从 38 个 Vue SFC 降到 0**；`routes.test.ts` / `day-interaction-adjustments.test.ts` 无收益（它们**真的**要用 presentation 组件，组件又用 shared 组件）。

### 2.5 根桶消费者分类（决定迁移成本）

对 `@nao-todo/shared` 根桶的**值导入**消费者（非测试文件，共 **203** 个）：

| 类别                                                    | 文件数  | 说明                                           |
| :------------------------------------------------------ | :------ | :--------------------------------------------- |
| **C. 只取非组件符号**（`t` / 类型 / utils / VO / 常量） | **124** | 摘除 `./components` 后**零迁移成本、白拿收益** |
| **A. 只取组件符号**                                     | **22**  | 需改 spec → `@nao-todo/shared/components`      |
| **B. 组件 + 非组件混取**                                | **57**  | 需拆成两条 import                              |

---

## 3. 决策：三选一裁定

### 3.1 否决 option ② 「按层拆分 `index.ts`」

- **收益**：层粒度实测仅 −17%（§2.1），且最贵的 `persistence-local` 层**一点也省不掉**。
- **代价**：`index.ts` 拆分本身不是加性操作 —— 要么改导出面（破坏性），要么只是把文件挪位置（**对 import 成本零影响**）。若为了「让消费者能按层引」而拆，等价于 option ① 但不加 `exports`，仍是加性；**但收益已被证明只有 17%**。
- **附带代价**：`packages/infrastructure/src/persistence-sync` **依赖** `persistence-local`（`sync-service.ts:9-51` 引 `localDatabase` / `localSession` / converters）与 `persistence-go`（converters / utils）⇒ 层与层**不是正交的**，按层拆桶会产生「引 sync 仍拖 Dexie」的直觉陷阱。

### 3.2 否决「删除/重构根桶的 `export *`」（破坏性收窄导出面）

- 破坏面：`apps/*` 20 处 + `packages/*` 5 处 + **16 个测试文件**直引根桶（§6.3）；且**收益与「加子路径 + 迁移消费者」完全重合**（同一个模块图，换个改法）。
- 唯一例外是 **W3a（仅摘 `./components` 一条）**：收益显著（−39.7% Vue，§2.3）但需 79 文件迁移，**建议单独立卡**，本轮不做（§7-D3）。

### 3.3 ✅ 采纳 option ③「窄子树子路径 + 消费者迁移」（不加 `exports` 字段）

- **目标粒度**：**子树/叶子**，不是层 —— `@nao-todo/shared/{types,locales,requester,valueobjects,constants,utils/*}`、`@nao-todo/infrastructure/src/<layer>/<file>`。
- **形式**：沿用**仓库既有深路径范式**（`@nao-todo/shared/types` 已 69 处、`@nao-todo/infrastructure/src/persistence-go/**` 已 14 处），**不新增 `exports` 字段**。
    - 理由：`exports` 是**加性**的，但**收益为 0**（深路径已可用），而**风险非 0**（§5.1）；且 `exports` **无法**用来强制移动端红线（同一包同时服务 desktop/web/mobile，不能全局删 `./persistence-local`）。属于 YAGNI，**建议单独立卡**（§7-D2）。
- **不拆 `index.ts`、不删根桶导出** ⇒ 对既有调用点**零破坏**，未迁移的消费者行为不变。

---

## 4. 收益估算

### 4.1 测试侧（可量化，结构性）

- 见 §2.3 / §2.4。**W1 = 4 行代码换 −16.5% Vue SFC 重复 transform**，是全表**最高 ROI 单项**。
- **对 T118 「import 聚合 69.82s」的折算（估算，非实测）**：Vue SFC transform 权重远高于普通 `.ts`，按 `Σvue` 降幅折算，`R` 方案可望让 `import` 聚合降 **~20–30%**（69.82s → ~50–56s），在 2.7 并发下折合 **wall −5~8s**。
- ⚠️ **必须纠正 T118 方案 #3 的乐观口径**：报告写「全仓 import 聚合 69.82s 可望**腰斩**（−20~30s wall）」。按本次实测**不成立**，因为：
    1. `local-repos.test.ts`（24.29s 关键路径）的**测试执行**时间不变，且其闭包仅 40 模块（`crypto-service.test.ts` = 40m/0v，已是廉价图）⇒ 关键路径不受影响；
    2. jsdom 固定税（~53s 聚合）与 import 无关，不受本方案影响；
    3. Σmod 全做也只有 −22.9%。
       ⇒ **建议把 T118 方案 #3 的预期从「−20~~30s wall」下调为「−5~~8s wall，且集中在个别文件」**，避免批末验收时口径落空。

### 4.2 生产构建侧（**≈ 0，不作为收益依据**）

- `apps/web` / `apps/desktop` 走 Rollup 打包，`export *` 在**打包期被 tree-shake**；真正被保留的都是**实际被用到**的模块（组件、`vue-i18n`、`axios`）⇒ 拆 barrel **不改变产物体积**。
- 唯一真实的生产侧价值是**移动端（ReactLynx / `apps/mobile`）**：其打包器与 tree-shake 保障不同，一旦 `presentation-react` 误引根桶，会把 **38 个 Vue SFC + `vue-i18n` + `axios`** 拖进 Lynx 产物（§5.3）。现状靠**约定**避免，建议**加守卫固化**。
- ⚠️ **未实测**：本次未做 bundle 体积对照（未跑 `webapp build` / `desktop:build` 前后对比），故生产侧结论为**推定**，已列入「未过项」。

---

## 5. 风险逐条核实（勿凭印象）

### 5.1 生产构建 / 别名

| 项                               | 核实结果                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| :------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@` 别名（web/desktop 各自定义） | ✅ **不受影响**。`apps/web/vite.config.ts:9-12` 与 `apps/desktop/electron.vite.config.ts:34-46` 各自定义；本方案**只改 import 语句**，不触碰别名。                                                                                                                                                                                                                                                                                                                                                           |
| `@nao-todo/*` 解析               | ✅ **不受影响**。当前**全部 11 个 `packages/*` 与 3 个 `apps/*` 均无 `exports` 字段**，靠 `main: index.ts` + pnpm workspace 符号链接 + `moduleResolution: bundler` 解析深路径。                                                                                                                                                                                                                                                                                                                              |
| ⚠️ **若新增 `exports` 字段**     | 🔴 **真实破坏面**：一旦某包有 `exports`，未列出的子路径**立即不可解析**。现存深路径调用点：`@nao-todo/infrastructure/src/**` **14 处**（`packages/presentation-react/src/logic/*`）、`@nao-todo/domain-identity/src/**` **15 处**、`@nao-todo/presentation-react/src/**` 2 处、`@nao-todo/webapp/src/**` **9 处**（desktop→webapp）。⇒ **加 `exports` 必须同时列 `"./src/*": "./src/*"` 与 `"./package.json"`**，否则 `webapp build` / `desktop:build` / `vp check` 三处同时红。**这是本任务最容易踩的坑**。 |
| 生产包体                         | 推定 **≈ 0**（§4.2，未实测）。                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

### 5.2 `guard:ddd`（领域隔离）

| 项                                   | 核实结果                                                                                                                                                                                                                                                                      |
| :----------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 是否会被触发？                       | ✅ **不会**。守卫判定为 `/from '@nao-todo\/shared'/`（`scripts/guard-domain-isolation.mjs:35`），实测对 `'@nao-todo/shared'` → `true`，对 `'@nao-todo/shared/types'` / `'@nao-todo/shared/constants/task'` → **`false`**（node 验证）。窄子路径**本就合法**（全仓已 69 处）。 |
| domain 包当前是否引 infrastructure？ | ✅ **完全不引**（`grep` 仅命中 `packages/domain-task/src/application/usecases/task-{check-item,comment}.ts` 的 **4 行注释**）。                                                                                                                                               |
| 现状基线                             | `pnpm run guard:ddd` → `[guard:ddd] OK`，**rc=0**。                                                                                                                                                                                                                           |
| 建议（非必须）                       | 若做 W3a，可把守卫扩一条「domain 包禁引 `@nao-todo/shared/components`」，巩固领域纯度。                                                                                                                                                                                       |

### 5.3 移动端红线（既有已知坑：`persistence-local` ⇒ Dexie）

| 项                                              | 核实结果                                                                                                                                                                                                                                                                                                                                                                                                                |
| :---------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **现状是否安全**                                | ✅ **安全**。`packages/presentation-react` 的 14 处 infrastructure 引用**全部**落在 `src/persistence-go/**` 与 `src/built-in/**`（**Dexie 无关**）；`apps/mobile`（包名 `@nao-todo/mobileapp`）源码**只引** `@nao-todo/presentation-react` + `@nao-todo/shared/requester/lynx`，**不引 infrastructure**。`grep -rn "dexie\|persistence-local\|persistence-sync" packages/presentation-react apps/mobile` = **0 命中**。 |
| **新风险来自哪里**                              | 🔴 **来自「深路径 → 层子路径」的迁移**：`@nao-todo/infrastructure/persistence-local` **看起来更规范，实则把 Dexie + 26 个本地仓储模块拖进移动端**。⇒ **这是我不推荐 layer subpath（option ①/② 的层形式）的第二个理由**。                                                                                                                                                                                                |
| 现状靠什么保证                                  | ⚠️ **仅靠约定**（无守卫）。`presentation-react/package.json` 甚至**声明了** `@nao-todo/infrastructure` 依赖，任何人都可以合法写出根桶导入。                                                                                                                                                                                                                                                                             |
| 🔴 **另发现：AGENTS.md 红线门禁 pathspec 失效** | 门禁写作 `git status --porcelain -- packages/presentation-react apps/mobileapp`，但 **`apps/mobileapp` 不存在**（`ls -d apps/mobileapp` → No such file）。`git` 对不存在 pathspec **静默忽略** ⇒ 门禁**恒为 0**，实际只覆盖 `packages/presentation-react` 一个路径。**建议 PM 修正为 `apps/mobile`**（§7-D4）。                                                                                                         |
| 建议（非必须）                                  | 新增守卫：`packages/presentation-react` 与 `apps/mobile` **禁止** `@nao-todo/infrastructure`（根桶）、`/persistence-local`、`/persistence-sync`、`dexie`（§7-D5）。                                                                                                                                                                                                                                                     |

### 5.4 `apps/desktop` / `apps/web` 既有 import 是否需连带改

- 采用**推荐方案**（保留根桶 + 消费者按需收窄）⇒ **只改「测试可达 + 高杠杆」的那批，其余不动**（清单见 §6.2）。
- **不需要**连带改：`packages/presentation-react`（已全窄路径）、`apps/mobile`（不引 infrastructure）、`domain-*` 包（不引 infrastructure）。
- **必须与 T120a 划清**：**16 个测试文件**直引根桶（§6.3）属 **T120a（`qa-T119`）范围**，本单**不重复派发**，避免双写冲突。

---

## 6. 落点与连带同步清单（含 Owner）

### 6.1 W1 —— `packages/infrastructure` 内 4 处 shared 根桶值导入（**最高 ROI：4 行**）

| #   | 文件:行                                                                            | 现取符号                   | 改为                                        | Owner（建议） |
| :-- | :--------------------------------------------------------------------------------- | :------------------------- | :------------------------------------------ | :------------ |
| W1a | `packages/infrastructure/src/persistence-local/converters/preference.ts:3`         | `JsonStringValueObject`    | `@nao-todo/shared/valueobjects/json-string` | rd-fe         |
| W1b | `packages/infrastructure/src/persistence-local/deletion/local-storage-policy.ts:7` | `PLAINTEXT_NOTICE_ACK_KEY` | `@nao-todo/shared/constants/storage-keys`   | rd-fe         |
| W1c | `packages/infrastructure/src/persistence-sync/epoch.ts:7`                          | `getRequesterImpl`         | `@nao-todo/shared/requester`                | rd-fe         |
| W1d | `packages/infrastructure/src/persistence-sync/sync-service.ts:8`                   | `getRequesterImpl`         | `@nao-todo/shared/requester`                | rd-fe         |

> 其余 33 处 infra→shared 引用**均为 `import type`（编译期擦除，零运行时成本）**，**不要动**。
> 验证：`pnpm exec vp test --run packages/infrastructure/src/persistence-sync/__tests__/sync.test.ts`（预期 38v → 0v）+ `pnpm exec vp check` + `pnpm run guard:ddd`。

### 6.2 W2 —— `apps/*` 20 个根桶消费者 → 窄子路径（按测试可达度排序）

| 可达测试数 | 文件                                                             | 建议 Owner |
| :--------- | :--------------------------------------------------------------- | :--------- |
| 20         | `apps/web/src/hooks/usecases/binding.ts`                         | rd-fe      |
| 20         | `apps/web/src/hooks/use-mirror-loaded-count.ts`                  | rd-fe      |
| 19         | `apps/web/src/hooks/usecases/use-auth-usecase.ts`                | rd-fe      |
| 19         | `apps/web/src/hooks/usecases/use-built-in-project-usecase.ts`    | rd-fe      |
| 19         | `apps/web/src/hooks/use-sync-status.ts`                          | rd-fe      |
| 19         | `apps/web/src/hooks/use-manual-sync.ts`                          | rd-fe      |
| 19         | `apps/web/src/hooks/usecases/use-user-usecase.ts`                | rd-fe      |
| 12         | `apps/web/src/views/auth/sign-out-wipe.ts`                       | rd-fe      |
| 11         | `apps/web/src/views/auth/sign-out-broadcast.ts`                  | rd-fe      |
| 10         | `apps/web/src/components/settings/profile-updater/index.vue`     | rd-fe      |
| 9          | `apps/web/src/components/app/aside-v2/use-aside.ts`              | rd-fe      |
| 7          | `apps/web/src/views/auth/offline-prerequisites.ts`               | rd-fe      |
| 5          | `apps/web/src/views/auth/bootstrap-local-data.ts`                | rd-fe      |
| 4          | `apps/desktop/src/renderer/src/components/initial-sync-gate.vue` | rd-fe      |
| 3          | `apps/desktop/src/renderer/src/components/unlock-gate.vue`       | rd-fe      |
| 3          | `apps/web/src/views/auth/routes.ts`                              | rd-fe      |
| 3          | `apps/web/src/data-plane.ts`                                     | rd-fe      |
| 2          | `apps/desktop/src/renderer/src/AppRoot.vue`                      | rd-fe      |
| 2          | `apps/desktop/src/renderer/src/hooks/use-local-reminder.ts`      | rd-fe      |
| 1          | `apps/desktop/src/renderer/src/hooks/usecases/binding.ts`        | rd-fe      |

> ⚠️ **W2 必须用「窄叶/窄子树」深路径，不得用层子路径**（层子路径 = 移动端 Dexie 风险，§5.3）。

### 6.3 与本单**必须划清**的既有工作（避免双写）

| 事项                                                                                                                                                                               | 归属                                                 | 处置                                                               |
| :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------- | :----------------------------------------------------------------- |
| **16 个测试文件直引根桶**（`infrastructure/src/**/__tests__` 6 · `presentation/task/**/__tests__` 3 · `apps/web/**/__tests__` 5 · `presentation-react` 1 · `persistence-local` 1） | **T120a（`qa-T119`）**                               | 本单**不派**；W1/W2 完成后由 T120a 一并收口                        |
| `local-repos.test.ts` 拆分                                                                                                                                                         | **T119**                                             | 无关，勿动                                                         |
| `domain-*` 包 `index.ts` 同型 barrel                                                                                                                                               | 本单**非范围**                                       | 若要做，**另立卡**（`domain-task` 闭包 33 模块，量级远小于 infra） |
| `packages/shared/utils/get-jwt-payload.ts`（**零调用、未被 `utils/index.ts` 导出** 的死文件）                                                                                      | 基础设施清理（同 `infrastructure-cleanup` ADR 范式） | **仅登记，不删**（AGENTS.md §3：发现未关联死代码只提不删）         |

### 6.4 文档连带同步清单（若 D1/D2 拍板改变结论）

| 文档/位置                                    | 需同步内容                                                     | Owner |
| :------------------------------------------- | :------------------------------------------------------------- | :---- |
| `docs/qa/2026-09-23-test-speed-profiling.md` | 方案 #3 的预期从「−20~~30s wall」下调为「−5~~8s wall」（§4.1） | qa    |
| `docs/tasks-state.md` T118 条                | 同上口径修正 + T121 结论摘要                                   | PM    |
| `AGENTS.md` 移动端红线门禁                   | `apps/mobileapp` → `apps/mobile`（§5.3-P6）                    | PM    |
| 本 ADR 索引                                  | `docs/adr/README.md` 追加一行                                  | arch  |

---

## 7. 待 PM 拍板决策点（trade-off 不替 PM 拍板）

| #      | 决策点                                                                                                                                                    | 我的建议                                                                                                                                       |
| :----- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | **W1 是否本轮做**（4 行改动，−16.5% Vue SFC）；是否连带 W2（20 文件，再 −2.2pt 模块）                                                                     | **W1 本轮必做**；W2 建议同批（同 Owner、同验证口径）                                                                                           |
| **D2** | 是否接受「**不拆 `index.ts`、不删根桶导出、不加 `exports`**」的折中口径（即把 T120b 从「生产 barrel 拆分」正名为「**import 面收窄**」）                   | **接受**；`exports` 单独立卡（收益 0、风险非 0，§3.3）                                                                                         |
| **D3** | **W3a 是否单独立卡**（摘除 `shared/index.ts` 的 `./components` + 迁移 79 文件）—— 收益 −7.9pt 模块 / **−23.2pt Vue**，但属**破坏性导出面收窄** + 大 churn | **建议立卡但降优先级**（等 W1/W2 实测后再定；若用户在意单文件迭代延迟，`use-batch-executor` / `offline-read-only` 可各 −50% 模块 / −100% Vue） |
| **D4** | 移动端红线门禁 pathspec 修正（`apps/mobileapp` → `apps/mobile`）                                                                                          | **立即修**（门禁当前半失效，属**验收口径漏洞**，优先级高于本单收益项）                                                                         |
| **D5** | 是否新增移动端守卫（禁 `infrastructure` 根桶 / `persistence-local` / `persistence-sync` / `dexie`）                                                       | **建议加**（并入 `guard:ddd` 或新脚本；现状仅靠约定，§5.3）                                                                                    |

---

## 8. 变更管理

- 本 ADR 的结论若被后续实测推翻（例如 W1 落地后全仓 wall 无改善）⇒ **回到架构评审**，并按 §6.4 同步口径。
- **实现期偏离约束**：W1/W2 落地时**不得**顺手改 `index.ts` 的导出面、**不得**新增 `exports` 字段、**不得**把 `presentation-react` / `apps/mobile` 的 import 改到 `persistence-local` / `persistence-sync`（移动端红线，§5.3）。
- **验收口径**：W1/W2 的收益验收用**结构性指标 + 单文件实测**双轨 —— ① 结构：`Σvue`（38 → 0 的目标文件）；② 实测：`pnpm exec vp test --run <改动 test 文件>` 的 `import` 行前后对比。**不承诺全仓 wall 数字**（全仓由批末 PM/qa 统一跑，见 AGENTS.md）。
- **未过项（诚实登记）**：① 未用 `codegraph impact/callers`（本次为导入图问题，不适用；已用自建静态导入图 + Vite SSR 实测模块数替代）；② 生产构建侧收益未实测（未做 bundle 体积对照）；③ 未跑全仓门禁（**无代码变更**，本单为纯评审 + docs-only 提交）；④ 未测 `Σvue` → wall-clock 的转换系数（§4.1 的 wall 折算为**估算**）。