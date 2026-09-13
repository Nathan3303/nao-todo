# 2026-09-13 桌面端离线边界加固（SHELL-05：门/壳导航必达兜底 + 依赖去重 + 内容视图就绪解耦）

- **交付**：PRD v1（P0 根治 6 项 + P1 加固 5 项）
- **终签**：✅ 通过（2026-09-13：QA T7/T8 实证 + 用户手动冒烟）
- **触发**：用户实测——断网冷启动→解锁→点「离线进入」无反应（含生产 Console 报错）
- **关联**：勘察报告 `docs/prds/2026-09-13-shell-05-offline-boundary-recon.md`；架构评审 `docs/adr/2026-09-13-shell-05-offline-entry-hardening.md`；QA 复现 `docs/reports/SHELL-05-offline-entry-repro.md` + `docs/reports/SHELL-05-prod-offline-entry.md`；前序 `docs/adr/2026-09-10-shell-03-offline-availability.md`（C-01…C-25 / BC-1…BC-7）

## 1. 问题证据与 5 Whys

| 根因 | 机制 | 证据（确证方式） |
| :--- | :--- | :--- |
| **H6（主根因，本单命门）** | `vue-router` 在桌面构建中为**两个物理实例**（根 `node_modules` 与 `apps/desktop/node_modules` 各一，peer 变体不同）；webapp 源码（经 `@` 复用）用实例 A 的 `createRouter`，桌面 `AppRoot.vue` 用实例 B 的 `useRouter` → 两个 inject key → `useRouter()` 返回 `undefined` → `onOffline` 的 `t.replace` 抛 `TypeError: Cannot read properties of undefined (reading 'replace')` → `gatePassed` 永不置位 → 停在门 | QA 生产构建复现（门 30s 不动、hash 不变、报错逐字一致）；`pnpm why vue-router` 2 instances；软链与产物分析 |
| **H1（放大器）** | `AppRoot.onOffline/onSignOut`、`initial-sync-gate.runSync()` 无 try/catch/finally；任一导航 reject/悬挂或同步异常 → 门永久停留 / 永加载 | 架构评审 + QA 注入验证 |
| **N-01 / D-08（确定性并列根因）** | tasks 三视图以 `profile`（网络数据）为初始化前置；离线 `profile=null` → `initialize()` 提前 return、**不清 `loading`** → 主区永久「加载中…」（无报错） | QA 忠实离线场景必现；架构 §1.4 |
| **B-07（观测缺口）** | 无全局 `unhandledrejection` / `onerror` / `router.onError` 兜底 → 才导致"没有任何控制台导出" | QA / 架构 |
| **H3 / B-04** | `LAST_VISITED_ROUTE` 失效深链 → `matched=0` → 白屏 | QA S3 |
| **N-02（独立缺陷）** | `deletion-notifier` 读 `userDeletion.value.isPending`，普通用户该对象 undefined → 挂载期未捕获 TypeError | QA §5.2 |

**5 Whys**：① 离线点「离线进入」无反应/进不去任务 → ② 门/壳导航与内容初始化均非"总函数"（异常即卡死）＋依赖多实例使关键能力失效 → ③ 离线路径历史只验收了 dev、且以网络数据（profile）当就绪条件、且共享源码时未约束同源依赖单实例 → ④ SHELL-03 的约束只覆盖门/壳，未下推到内容视图，也未覆盖"生产态/依赖解析" → ⑤ **命题：把"总函数"与"可观测"从门/壳下推到内容视图与构建层，消除一切"静默卡死"。**

## 2. 目标指标与埋点口径

| 项 | 口径 |
| :--- | :--- |
| 北极星 | 沿用先例；本单为可用性缺陷修复，不拆新指标 |
| 验收基线 | ① 生产构建离线进入可达（门关闭 + 内容非 loading）② 任一导航/同步异常都**有界终结**（门/壳/内容均不卡死）③ 失败**可观测**（结构化日志，无 PII）④ 目标路由合法化不白屏 |
| 埋点 | 不新增远端埋点；以 BC + 单测 + QA 实机替代 |

## 3. 范围 / 非范围

| | 内容 |
| :--- | :--- |
| **做 P0** | **T1 H6 依赖去重（根治项，C-36/C-37）**：`electron.vite.config.ts` renderer 增 `resolve.dedupe:['vue','vue-router','pinia']`（arch 方案 A，仅动构建配置、不改 lockfile/版本）＋ 启动注入自检（C-37①）＋ **`$router` 降级防御层**（C-37②，`app.use(router)` 直接写在 app 上，实例无关）；**注：H1 单独修是假修复**（router 仍 undefined → 壳挂 `/auth/checkin` → 被踢登录页）；**T2 H1 必达兜底**：`AppRoot.onOffline/onSignOut`、`initial-sync-gate.runSync()` 改 `try/catch/finally`，终态推进入 `finally`，异常必落显式终态并打点；**T3 B-07 可观测**：web/desktop 各注册 `window error`/`unhandledrejection`/`app.config.errorHandler`/`router.onError` + 有界内存缓冲（禁 token/email）；**T4 B-04/B-05 目标合法化**：`resolve` 校验 `matched>0` 且非 `/auth`，回退链 `LAST_VISITED → SECTION_LAST → /tasks`，非法键清理，section 重定向同校验；**T5 D-08/B-08 内容视图**：tasks 三视图去 `profile` 前置、离线本地默认 preference、`loading` 三终态（成功/空态/错误）、`/tasks` 落点默认 `viewType=table` 自愈 |
| **做 P1** | **T6**：C-29 四条件不满足显式出口；C-34 凭证失败结构化判定（替文案正则）；C-35 `safeNavigate` 收敛（AppRoot/check-in/sign-in/index-view）；C-33/B-12 内容 loading 有界 + 空库空态引导；**N-02** `deletion-notifier` 空值判空 |
| **非范围** | B-06 chunk 预缓存（证据驱动另立）；B-10 使用中断网在线/离线提示与手动同步（P2 另立）；离线写入完整口径（SHELL-03 L2/L3）；错误文案历史硬编码 i18n（SHELL-03 L1）；mobile 同类（L5）；头像/邮箱缓存扩展（L6） |
| **追加范围（用户 2026-09-13 明确）** | **AC11 离线功能可用性**：离线进入后主要功能本地可用，仅同步不可用。先由 **arch 静态审计 + QA 实机离线走查**产出缺口清单，再按 Must/Should 定修复范围（可能拆 SHELL-06）。不受影响的项不改。 |

## 4. 用户场景（画像 + 场景卡 + 关键路径 + 页面状态清单）

- **画像**：桌面端用户，常在无网/弱网环境启动并使用。
- **场景卡**：S1 断网冷启动 → 本地密码解锁 → 初始同步失败 →「离线进入」→ **进入任务并能看到本地数据（或显式空态）**；S2 异常注入（导航 reject/悬挂）→ 仍进壳且失败可查；S3 失效 `LAST_VISITED` → 回退 `/tasks` 不白屏；S4 凭证失效 → 不提供离线进入，走重新登录。
- **关键路径**：冷启动 → 解锁 → 门（失败态）→ 离线进入 → 目标合法化 → 壳 + 内容终态。
- **页面状态清单**：门 `checking/ready/error`；初始同步 `syncing/failed/ready`；内容 `loading/empty/error/ready`（新增有界）；身份 `真 profile/缓存首字母+离线/图标`。

## 5. 业务规则与不变量

| 规则 | 内容 |
| :--- | :--- |
| R1 总函数 | 门/壳/**内容视图**任何路径都须在有限时间进入且仅进入一个显式终态，不因异常/悬挂停在中间态 |
| R2 失败可前进 | 失败终态必须可重试/可离线进入/可登出；内容失败须有重试/空态出口 |
| R3 网络数据不得作就绪条件 | `profile` 等网络装饰数据不得作为门/壳/**内容视图**的初始化前置（扩展 SHELL-03 C-03） |
| R4 依赖单实例 | 桌面渲染层共享 webapp 源码时，同源框架依赖（vue/vue-router/pinia 等）必须解析为**单实例**（inject key 唯一） |
| R5 可观测 | 未捕获异常必须结构化记录（禁 PII/token），有界缓冲可供 QA 导出 |
| R6 目标合法化 | 离线进入/回退的目标必须先 `resolve` 校验；非法键清理；禁裸 `localStorage.getItem(...)||'/tasks'` |
| R7 离线授权 | 沿用 SHELL-03 C-22…C-25（内存 flag、四条件、凭证失败不授予），仅**顺序**修订为"必达兜底 + 失败仍进壳" |
| R8 既有不变量 | 同步协议/表结构/游标不改；`syncStatus` 订阅方兼容；`guard:ddd` 通过；颜色仅 shadlike 令牌 |

## 6. NFRs

- 生产与 dev 行为一致（不再出现"dev 去重、prod 多实例"的差异）。
- 全局日志**有界**（显式上限）、字段白名单（无 token/email/正文）。
- 无无界定时器；无新增网络请求。
- 门内终态可达时间 ≤ SHELL-03 基线（≤2s 可解锁态）；内容终态有界。
- 门禁：`vp check` + `vp test`（含新增单测）+ `webapp`/`desktopapp` 构建绿；`guard:ddd` 通过。

## 7. AC（Given/When/Then，五覆盖）

| # | 覆盖 | 对应 | Given | When | Then |
| :--- | :--- | :--- | :--- | :--- | :--- |
| AC1 | 主路径 | H6/T1 | **生产构建**、断网、已解锁 | 点「离线进入」 | 门关闭并进入任务；**无 `TypeError … 'replace'`**；`useRouter()` 可用 |
| AC1b | 主路径 | H6/C-37 | 生产构建 | 启动 | 注入自检报告 router 可用；即使 `useRouter()` 异常，`$router` 降级层仍能完成导航 |
| AC2 | 主路径 | T1 | 同上 | 进入后 | 任务内容区在有限时间进入**非 loading** 终态（有本地数据=默认视图；无数据=显式空态） |
| AC3 | 异常 | H1/T2 | 注入导航 reject/悬挂（mock） | 点「离线进入」/点登出 | 仍在有限时间进入 `gatePassed` 终态（进壳），且记录一条结构化错误；**门不永久停留** |
| AC4 | 异常 | T2 | `syncService.start()` 注入 reject | 挂载初始同步门 | 门进入 `failed` 终态（含三键），**不永加载** |
| AC5 | 边界 | B-04/B-05/T4 | `LAST_VISITED` 为失效路径/`/auth/*`/空 | 离线进入 | 回退链生效，落点 `matched>0` 且非 `/auth`；非法键被清理；**不白屏** |
| AC6 | 边界 | D-08/B-08/T5 | `profile=null` + `/tasks`（无 viewType） | 进入任务 | 内容区自愈默认 `table`；不永久 loading |
| AC7 | 负向闭环 | B-07/T3 | 任意未捕获异常（如 N-02） | 触发 | 控制台有结构化记录且本地缓冲可取；**无 token/email** |
| AC8 | 负向闭环 | N-02/T6 | 普通用户（无待注销记录） | 进入壳 | **无 `deletion-notifier` TypeError** |
| AC9 | 设计一致性 | P1/T6 | 四条件不满足 / 凭证失效 | 点离线进入 | 显式文案/动作（重试/重新登录），**不静默回落**；凭证失败不展示离线进入 |
| AC10 | NFR/回归 | 全量 | 在线路径、双主题、SHELL-03 BC-1…BC-7 | 回归 | 全过；`guard:ddd` 通过；dev/prod 行为一致 |
| **AC11** | **主路径（用户追加 2026-09-13）** | 审计/待定 | 已**离线进入**桌面壳、断网 | 使用主要功能（任务浏览/新建/完成/编辑、日历、番茄、搜索、清单/标签、设置、本地提醒） | 全部**本地可用**、无网络前置阻塞、无未捕获异常；**仅同步**展示失败/待推送态，**不阻塞功能** |

**数据不达标处置预案**：AC1/AC2 若生产构建仍失败 → 回退 RD 定位（优先核对 vue-router 单实例与目标合法化）；任一 AC 退化则回退到对应 P0 子项并重验。

## 8. 决策留痕（✅ 待用户确认）

| # | 决策点 | 建议 |
| :--- | :--- | :--- |
| D1 | P0 含 D-08（tasks 去 `profile` 前置） | 含 |
| D2 | 导航失败语义 | A（永不阻塞进壳 + 回退 + 记录） |
| D3 | 离线 preference 降级 | 本地缓存优先，缺省硬默认 `table`，不写远端 |
| D4 | 全局错误日志落点 | console + 本地有界缓冲（不做远端） |
| D5 | 本地库为空 | 仅空态引导（不阻断） |
| D6 | chunk 预缓存 | 本轮不做（证据驱动另立） |
| D7 | 使用中断网在线/离线提示与手动同步 | P2 另立 |
| D8 | 凭证失败结构化判定 | P1 本轮做 |
| D9 | N-02 `deletion-notifier` 空值崩溃 | P1 随单 |
| D10 | H6 修复方式（arch 追加） | **A：`resolve.dedupe` 入 P0**；B（`.npmrc` 根治）作 P1 另单（不动 lockfile） |
| D11 | 是否加 `$router` 降级防御层（C-37②，arch 追加） | 加（廉价、跨实例安全） |

## 9. 优先级（RICE）

| 子项 | Reach | Impact | Conf | Effort(人天) | RICE | 档 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| T1 H6 依赖去重 + 注入自检 | 10 | 3 | 0.95 | 0.5 | ~57 | **P0** |
| T2 H1 必达兜底 | 10 | 3 | 0.95 | 0.5 | ~57 | **P0** |
| T5 D-08/B-08 内容终态 | 10 | 3 | 0.9 | 1.0 | ~27 | **P0** |
| T4 目标合法化 | 9 | 2 | 0.9 | 0.5 | ~32 | **P0** |
| T3 可观测 | 10 | 2 | 0.95 | 0.5 | ~38 | **P0** |
| T6 P1 加固（含 N-02） | 8 | 2 | 0.85 | 1.0 | ~13.6 | P1 |
| **合计** | | | | **~4.0** | | |

战略筛子：通过（不做则离线不可用、数据信任受损）；MoSCoW=**Must**；Kano=基础型。

## 10. 上线闭环

- 无 DB/schema/协议变更；回滚 = revert 对应提交（H6 为构建配置，回滚即恢复旧行为，但须同时回滚依赖）。
- 验证：单测（`AppRoot`/`initial-sync-gate`/router 目标合法化/内容视图）+ **QA 生产构建实机**（复用 `scripts/electron-smoke/`）+ 用户手动冒烟。
- 监控口径：无未捕获异常；门内终态可达。

## 11. 变更治理

- 本单修订 SHELL-03 的 C-22（顺序）与 C-03（适用范围下推内容视图），冲突以本单更晚落盘为准（ADR 已记）。
- 实现期偏离 ADR §2 约束 → 回架构评审；触发源/根因回填 ADR。
- HC/热修：本单为缺陷修复，若发布后复发按 Hotfix 24h 补单。

## 12. 派发记录（待填）

| 任务 | 会话 | commit | 结果 |
| :--- | :--- | :--- | :--- |
| T1 H6 依赖去重 + 注入自检 + `$router` 降级 | rd-fe | `6273acc3` | ✅ vue-router 2实例→1；575 例 |
| T2 H1 必达兜底 | rd-fe | `f7576426` | ✅ 578 例 |
| T3 全局可观测 | rd-fe | `0b031a4c` | ✅ 584 例 |
| T4 目标合法化 | rd-fe | `3f288ffa` | ✅ 598 例 |
| T5 内容视图终态/viewType | rd-fe | `3c6a8fc6` | ✅ 605 例 |
| T6 P1 加固（含 N-02） | rd-fe | `e58cf46f`/`c1f86354` | ✅ 619 例；guard:ddd OK |
| N-04 离线设置页 profile 空值判空 | rd-fe | `9e6f41c7` | ✅ 622 例 |
| G12/G14 离线登出 + 昵称占位 | rd-fe | `385e1d75` | ✅ 626 例；guard:ddd OK |
| T7 生产构建离线回归 | qa | 报告 `docs/reports/SHELL-05-verification.md` | ✅ AC1–AC10 全过；用户原始场景闭环 |
| 生产构建离线回归 | qa | — | ⏳ |

## 13. 追加需求：离线写入与自动回传（建议拆 SHELL-06）

用户口径（2026-09-13）：**离线本地照常写；联网后自动补传**。代码核实后，当前实现**不满足**：

| # | 现状证据 | 后果 |
| :--- | :--- | :--- |
| G1 | `sync-service.ts:246` `MAX_PUSH_RETRY=5`；`:599` `if (retryCount >= 5) continue` | 队列项达 5 次即**永久跳过**，无重置路径（SHELL-03 L3） |
| G2 | 失败一次对**整批**队列项 `markFailed()`（每一项 +1） | 离线一次推送尝试即把全部待写 +1；2s 防抖下几次编辑即可触顶 |
| G3 | 推送仅由「本地写 → `schedulePush` 2s 防抖」或 `manualSync` 触发；**无 `online` 监听/周期重试/前台恢复触发** | 断网写入 → 恢复网络后若不继续写，**永不自动补传** |
| G4 | 无本地写上限/暂停提示（SHELL-03 L2） | 超限后用户无可见说明 |
| G5 | 同步状态轨（SHELL-02）已展示 待推送/失败 计数 | 可见性部分具备，可复用 |

**建议**：拆 **SHELL-06 离线写入与自动回传**（本体量在 infrastructure/同步层 + 状态可见性，与 SHELL-05 的"门/壳/内容就绪"不同风险面）。范围建议：
- **R1 回传触发**：`online` 事件（仅作提示，不作鉴权——沿用 C-22 禁用语义）+ 应用前台/启动 + 周期退避 → 自动 `pullAll+pushAll`；
- **R2 重试语义**：区分"离线暂停"与"真实失败"；恢复连接/启动时**重置离线暂停计数**；保留退避上限避免打爆；
- **R3 本地写上限 + 暂停可见性**（L2）：超限时显式提示，不静默丢；
- **R4 触顶项可恢复**：`retryCount>=5` 的项在恢复连接后可再次尝试（手动或自动）；
- **R5 不阻塞功能**：回传失败不影响本地读写与渲染（AC11 已覆盖）。

AC12（建议）：Given 离线期间完成 N 次本地写入 → When 恢复网络且无新写入 → Then 队列在有限时间内自动补传完毕（或失败可重试、状态可见），本地已生效数据不变。

## 14. 待决项（截至 2026-09-13 收口）

| # | 待决 | 状态 |
| :--- | :--- | :--- |
| P1 | SHELL-06 是否立项 | ✅ 已立项并交付（见 `2026-09-13-shell-06-offline-backfill.md`） |
| P2 | Web 端「统一架构」 | ❌ **不做**（用户 2026-09-13 决定；不再评估） |
| P3 | D11–D15 | ✅ 已定稿（D12 `nextAttemptAt` / D13 周期退避 / D14 单表1000·总2000 / D15 随单） |

> 本轮（SHELL-05）验收“离线可进入 + 本地数据可用 + 回传缺口定位”；SHELL-06 已单独交付闭环。

## 15. 已知说明与验收口径（环境差异）

| # | 现象 | 定性 | 处置 |
| :--- | :--- | :--- | :--- |
| ENV-1 | **dev（`pnpm desktop:dev`）断网后 Ctrl+R 白屏** | **非缺陷**：dev 渲染进程由 Vite dev server（`http://localhost:5173`）提供，DevTools「离线」会一并切断 → 模块拉取失败 | 仅作环境口径登记；**不得**据此判定桌面端离线能力。离线能力须在**打包版（`file://`）**验证 |
| ENV-2 | 离线重载后需**重新解锁** | **设计预期**：离线进入授权为会话级内存 flag（SHELL-03 C-22，不落盘、无粘性） | 不修；重载 → 解锁门 → 离线进入 为正常链路 |
| ENV-3 | 旧报错 `index-DOz7xaey.js`（用户早期构建）与当前产物 hash 不同 | 判读说明：vendor chunk hash 一致、app chunk 不同；同一缺陷形状（H6） | 以当前源码重建产物为准（T1 已根治） |

> 待 QA T8 给出**打包版 `file://` 离线重载**结论：正常回解锁门 ⇒ 终签；仍白屏 ⇒ 真缺陷，回退 RD 修复后再验。

## 16. 验收结果（截至 2026-09-13）

| 层级 | 结果 | 来源 |
| :--- | :--- | :--- |
| 用户原始场景 | ✅ 闭环：打包版断网冷启动 → 解锁 → 离线进入 → 门关闭、进入 `#/tasks/all/table`、无 `'replace'` TypeError、内容非 loading | QA T7 |
| AC1–AC10 | ✅ 全过 | QA T7 |
| 离线功能面 | 14 可用 / **0 真实不可用** / 3 降级 / 8 未覆盖（同步以外均可用） | QA T7 |
| SHELL-03 回归 | ✅ 20 PASS / 0 FAIL | QA T7 |
| 打包版离线重载 | ✅ 不白屏，回落解锁门；`__NAO_ERROR_LOG__` 0 条；整链仍通 | QA T8 |
| dev/web 离线重载 | 白屏 = 资源不可达（非回归，见 §15 ENV-1） | QA T8 |
| H6 根治 | ✅ vue-router 单实例 + `$router` 降级层在位 | T1 / QA T8 |
| 缺陷修复 | N-04 `9e6f41c7`；G12/G14 `385e1d75` | rd-fe |
| 门禁 | `vp test` **626 例**全绿；webapp/desktop 构建 ✓；`guard:ddd` OK | rd-fe |

**未覆盖（待用户冒烟或后续专项）**：任务 勾选完成/编辑/删除/拖拽排序、日历任务条、清单创建·重命名、设置保存（8 项）；G12/G14 未做专项实机。
**用户终签**：✅ 通过（用户 2026-09-13 手动冒烟无问题）。
