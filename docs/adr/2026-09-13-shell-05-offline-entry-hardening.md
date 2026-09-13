# 2026-09-13 SHELL-05：离线进入加固（门/壳导航必达兜底 + 内容视图就绪判据解耦）

> 性质：**架构评审报告（只评不改）**。评审对象 = `docs/prds/2026-09-13-shell-05-offline-boundary-recon.md`（H1–H5 + B-01…B-13）与其前序 `docs/adr/2026-09-10-shell-03-offline-availability.md`（C-01…C-25、BC-1…BC-7）。
> 症状：断网冷启动 → 解锁成功 → 初始同步门失败态 → 点「离线进入」无反应（无控制台导出）。
> 结论：**有条件可行**——H1 是"无反应"的**结构性主根因**（门非总函数）；但静态排查已**证伪 H1 的两类常见触发**（重定向/无匹配不会 reject），触发源须实机捕获；同时本次评审**新增一个确定性、离线必现的根因 D-08**（`profile` 门控内容视图初始化 ⇒ 内容区永久 loading），须一并纳入 P0。
> 代码边界：本 ADR 为纯文档产出，评审方**未修改仓库代码**（只读评审；探针脚本已删除）。
> 评审日期：2026-09-13（终签日）

---

## 0. 评审输入与证据方法

| 输入                  | 说明                                                                                                                                 |
| :-------------------- | :----------------------------------------------------------------------------------------------------------------------------------- |
| PRD（勘察报告）       | `docs/prds/2026-09-13-shell-05-offline-boundary-recon.md`                                                                            |
| 前序 ADR              | `docs/adr/2026-09-10-shell-03-offline-availability.md`（附录 B 定义了离线进入的路由语义与四条件守卫，**BC-5 要求重验**）             |
| 关键代码              | `apps/desktop/.../AppRoot.vue`、`apps/desktop/.../components/initial-sync-gate.vue`、`apps/web/src/views/auth/routes.ts`、`apps/web/src/router.ts`、`apps/web/src/views/index/tasks/routes.ts` |
| 上游框架事实          | `vue-router@5.2.0`（非 4.x，行为有差异——见 §1.2 实测）                                                                               |
| 实测方法（本次新增）  | 用 `createMemoryHistory` 复刻 `router.ts` 三段守卫 + `tasks/calendar` 路由结构，跑 16 组 `LAST_VISITED / LAST_TASKS` 组合，观察 `router.replace` 是 resolve 还是 reject（临时脚本，评审后已删） |

**证据缺口（评审前置）**：用户未导出 Console。**本单所有触发源判定都必须以 QA 实机 Console + 未捕获异常为终审**；本报告的静态结论只用于收敛范围，不得当作触发源定论。

---

## 1. 根因分析

### 1.1 H1 判定 = **结构性主根因成立**（门非总函数），**触发源未证实**

`AppRoot.vue`：

```ts
const onOffline = async (): Promise<void> => {
    grantOfflineEntry()
    await router.replace(localStorage.getItem(LAST_VISITED_ROUTE_KEY) || '/tasks')  // 无 try/catch
    gatePassed.value = true                                                          // reject/hang 即永不到达
}
```

判定依据（充分性）：`gatePassed` 只能在 `await router.replace(...)` **正常 resolve 之后**置位；一旦该 await **reject 或悬挂**，模板 `v-else-if="!gatePassed"` 恒真 ⇒ 门永久停留、按钮不再产生任何可见状态变化 ⇒ **完全吻合"点了没反应"**。同文件 `onSignOut` 同型（`await router.replace('/auth/signin')` 后置位）。

所以：**H1 是"无反应"的充分条件，且是唯一能解释"门不消失"的结构缺陷。** 但它只是"放大器"，真正的问题在触发源。

### 1.2 触发源排查：**证伪两类常见猜测，收敛到"抛错/悬挂"**

`vue-router@5.2.0` 的 `push/replace` 只在以下情况 **reject**（源码 `pushWithRedirect` / `navigate` / `triggerError` / `handleRedirectRecord`）：

| #   | reject 触发                      | 本次实测结论                                                                                                      |
| :-- | :------------------------------- | :---------------------------------------------------------------------------------------------------------------- |
| R-a | 守卫**抛出/返回 rejected promise** | 可能；但静态通读三个守卫（`authBeforeEnter`、`router.beforeEach`、`tasks.beforeEnter`）**全为同步安全路径**，无网络调用、无抛点 |
| R-b | 懒加载组件 `import()` **reject**  | 可能；**唯一天然与"断网"相关的 reject**（chunk 需走网络时）。桌面端打包后走 `file://` 本地 chunk，概率低；**浏览器态 / dev 态概率高** |
| R-c | `handleRedirectRecord` 得 `Invalid redirect` | 不可能（本仓库所有 record `redirect` 均为合法 `path`/命名路由）                                              |
| R-d | 守卫重定向**成环 > 30 次**（`Infinite redirect in navigation guard`） | 已证伪：16 组 `LAST_VISITED/LAST_TASKS` 组合（含 `'/tasks'`、`'/tasks/'`、`'/settings/general'`、失效深链）**全部 resolve** |
| 非 reject | 重定向 / 无匹配 / 重复导航       | **resolve（返回 NavigationFailure 或 `matched=0`）**，不 reject。**无匹配 → `matched=0` ⇒ 空壳（属 B-04，见 §1.4）** |

**可证伪机制链条（H1，待实机验证）**：
`点击离线进入 → grantOfflineEntry() → router.replace(target) → [触发源：守卫抛错 或 目标 chunk import reject 或 悬挂] → onOffline 永不置位 gatePassed → 门停留 → 无反应`。
**验证方法（P0 落地后必跑）**：给 `onOffline` 加 `try/catch/finally` + `finally { gatePassed = true }`，并在 catch/`router.onError`/`window.onerror`/`unhandledrejection` 打点后重跑。① 若进入成功且日志无异常 ⇒ 触发源是**悬挂**或旧 build 残留；② 若进入成功且日志有 reject ⇒ **触发源被捕获并落库**；③ 若仍不进入 ⇒ H1 被证伪，须转查 `gatePassed` 之后的壳渲染（见 D-08）。

> **r2 回填（2026-09-13）**：上述"触发源未证实"**已关闭**。用户生产态 Console 给出 `TypeError: Cannot read properties of undefined (reading 'replace')`，经产物逐帧定罪 + `pnpm why` 实锤为 **H6（`useRouter()` 返回 undefined，双物理 `vue-router` 实例）**——见 §10 与 §1.5。H1 仍是"放大器"（无兜底把一次 TypeError 变成永久卡门），但不是触发源。

### 1.3 H2–H5 评估

| #   | 假设                     | 评估                                                                                                                                                                                                 | 结论                                                                                     |
| :-- | :----------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| H2  | 放行四条件不成立         | 四条件全为本地事实，解锁成功后 `localSession` 已置位、`cryptoService.isUnlocked===true`、JWT 可解析；若不成立，守卫**返回重定向**（resolve）→ 最终落 `/auth/checkin` → 可见跳登录页。**与"无反应"形态不符**；且单测已覆盖四条件 | **非主因**（但"失败无可见性"是真缺陷 → C-29）                                            |
| H3  | 目标路由失效/无匹配      | **实测确认**：无匹配路径 `router.replace` resolve 但 `matched=0` ⇒ `App` 挂载后 router-view 空 ⇒ **空壳/白屏**（不是门停留）。这是"无反应"的**可信替代解释**，必须由 QA 用 `router.currentRoute.value.matched.length` 区分 | **需排除**（纳入 P0：目标合法化 C-28/C-30）                                              |
| H4  | 门卡在 `syncing`         | `runSync()` 顶层无 try/catch 属实（真缺陷）。但若 `start()` reject，`syncing` 恒 true、**按钮根本不出现**，与"按钮可见可点"矛盾 ⇒ 本次非此形态                                                                            | **非本次主因**（仍须修：C-26）                                                           |
| H5  | `isCredentialFailure` 误判 | 用文案正则 `/登录已过期\|401\|403/` 判定，脆弱（SHELL-03 L8）。误判结果 = **隐藏「离线进入」按钮**，与"按钮可点"矛盾                                                                                                     | **非本次主因**（仍须修：C-34）                                                           |

### 1.4 【New】D-08：`profile` 门控内容视图初始化 ⇒ 离线内容区**永久 loading**（确定性、离线必现、无报错）

**这是本次评审新发现的根因级缺陷，PRD 未列。**

| 事实                                                                 | 证据                                                                                                              |
| :------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------- |
| 任务视图以 `profile` 为**初始化前置**；profile 为 null 时**直接 return**，`loading` 停在初始 `true` | `apps/web/src/components/tasks/built-in-project/built-in-project.ts:63`（`if (!props.projectId \|\| !profile.value) return`，`loading = ref(true)` 在 `:38`） |
| 同型另两处（同类扫描）                                               | `project.ts:58`、`tag.ts:55`（`loading = ref(true)` 同处）                                                        |
| `profile` 离线必为 null                                              | SHELL-03 §1.1：`profile` **仅内存**（`use-store-base` 纯 `ref`），冷启动离线加载失败 ⇒ 恒 null                      |
| 默认 viewType 自愈也**依赖 profile 之后的代码**                       | `built-in-project.ts:67`（`await switchViewType(preference.value?.viewType \|\| 'table')` 在 `!profile` 早退之后） |
| 组件渲染分支                                                         | `built-in-project/index.vue`：`<loading-comp v-if="loading" /> / <nue-container v-else>` ⇒ `loading` 恒 true 即**永久转圈**，且**无 `console.error`** |
| 后果                                                                 | 离线进入后：门消失 → 壳 + 侧栏出现 → **内容区永久 loading**（用户口语即"点了没反应"/"进不去任务"）。**完全解释"无控制台导出"** |

**性质**：SHELL-03 C-03（"网络装饰数据不得作为门/壳就绪条件"）**只施加于门/壳，未施加于视图内容层**——属约束覆盖漏项，同类缺陷大概率还有（本次只扫到 tasks 三视图）。

### 1.5 综合判定

| 层级 | 结论                                                                                                                                     |
| :--- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| **触发根因（r2 实锤）** | **H6**：桌面渲染层打包了**两个物理 `vue-router` 实例**；`AppRoot` 的 `useRouter()` 取 B 实例的 `routerKey`，而 router 由 A 实例 `createRouter` 安装、只提供 A 的 `routerKey` ⇒ `useRouter()` 恒 `undefined` ⇒ `t.replace` 抛 `TypeError`。**必须修**（P0，见 §10） |
| 结构根因（放大器） | **H1（门非总函数）**：`onOffline/onSignOut` 无兜底 ⇒ 任一导航异常/悬挂即永久卡门（把 H6 的一次 TypeError 放大为"点了没反应"）。**必须修**（P0） |
| 并列根因 | **D-08（新）**：`profile` 门控视图初始化 ⇒ 离线内容区永久 loading（确定性、无报错）。**必须修**（P0）；否则即便 H1/H6 修好，用户仍"看不到任务" |
| 观测缺口 | B-07（无全局未捕获异常处理）是"无控制台导出"的元凶 ⇒ **P0 必做可观测**，否则本单无法闭环验收                                               |

---

## 2. 约束清单（承接 C-01…C-25，新增 C-26…C-37）

> 术语：**总函数（total function）** = 任何执行路径都在**有限时间**内进入且仅进入一个显式终态，且**不因异常/悬挂而停在中间态**。

- [ ] **C-26 门/壳的导航与同步调用必达兜底（P0，修订 C-22）**：`AppRoot` 内所有 `router.replace/push` 一律 `try { await } catch { 记录 } finally { 推进终态 }`；**终态推进（`gatePassed=true`）必须在 `finally`，不得只在成功分支**。`grantOfflineEntry()` 已在 `try` 之前（授权先于跳转，与 B-1 一致）。`onSignOut` 同型。
    - 语义变更：**导航失败不得阻塞进入**。目标回退链见 C-28；失败时仍进壳，并由壳的自愈/空态承接（"永不卡死"优先于"目标正确"）。
    - `initial-sync-gate.vue` 的 `runSync()` 同样 `try/catch/finally`：任何意外异常都必须进入 `failed` 终态（展示分类文案），**禁止** `syncing` 永久 true。
- [ ] **C-27 全局未捕获异常可观测（P0，B-07）**：web/desktop 各自入口注册 **同源单点**实现：`window.addEventListener('error')`、`window.addEventListener('unhandledrejection')`、`app.config.errorHandler`、`router.onError`。统一结构化日志（`console.error` + **有界内存环形缓冲**，供 QA 导出；**禁 PII/禁 token**）。
    - 该约束是本单其余结论的**验收前提**：没有它，触发源无法定论、D-08 与 H1 无法区分。
- [ ] **C-28 离线进入目标合法化与回退链（P0，B-04/B-05）**：`AppRoot` 在 `replace` 前用 `router.resolve(target)` 校验：`matched.length > 0` 且 `!target.startsWith('/auth')`；**回退链 = `LAST_VISITED_ROUTE → SECTION_LAST_ROUTE → '/tasks'`**；非法值**回写清理**（避免下次再撞）。禁裸 `localStorage.getItem(...)||'/tasks'`。
- [ ] **C-29 四条件不满足的显式出口（P1，B-03）**：`beforeEnter` 拒绝放行时不得静默回落；门侧在用户点「离线进入」前**预检四条件**，不满足时给出显式文案 + 动作（重试/重新登录/登出），并把"为何不能离线进入"归入 C-27 日志（不含 PII）。
- [ ] **C-30 `LAST_VISITED` / `SECTION_LAST` 失效兜底（P0，与 C-28 合并实现）**：`router.ts` 的 section 重定向同样必须校验 `resolve(saved) matched>0` 且与 `to` 不同记录，否则**清除该键**并放行；禁止把失效字符串当重定向目标（消除 B-05 的空白/空壳风险）。
- [ ] **C-31 内容视图就绪判据与 `profile` 解耦（P0，D-08，扩展 C-03 适用范围）**：`tasks/{built-in-project,project,tag}` 三视图**不得**以 `profile`（网络装饰数据）作为初始化前置；离线 profile 缺失时用**本地默认值/占位**继续，`loading` 必须有界（成功/空态/错误三终态之一）。`loadBuiltInProjectPreference(profile.email,…)` 的远端依赖需给出离线降级口径（本地默认 preference）。
- [ ] **C-32 默认 viewType 自愈与离线可用（P0，B-08）**：`/tasks`（及任何仅落到 `tasks-*-project` 而无 `viewType` 的落点）必须自愈到默认视图（`preference.viewType \|\| 'table'`）；**离线（preference 不可用）时同样有硬默认 `'table'`**。建议同时在 `tasks/routes.ts` 的 `/tasks` 重定向中显式带上默认 viewType（双保险）。
- [ ] **C-33 视图层 loading 有界 + 可交互出口（P1）**：将 C-01/C-02 的"总函数 + 失败可前进"从门/壳**下推到内容视图**：任何 `loading` 终态必须有上界或可重试/空态/错误出口；新增/修改视图必须有"失败组合 → 终态"矩阵与负向测试（扩展 C-13）。
- [ ] **C-34 凭证类失败判定结构化（P1，B-11/修订 C-06）**：`isCredentialFailure` 禁用文案正则，改为**错误码/错误分类**（401/403/10041/`isSessionExpired` 等显式字段）；文案变更不得再影响按钮可用性。
- [ ] **C-35 导航调用单一入口（P1）**：App 层提供 `safeNavigate(to, fallback)`（或 `safeReplace`）作为门/壳/check-in 的统一封装；`AppRoot.onOffline/onSignOut`、`check-in-page.vue:16-17`、`sign-in-page.vue:13`、`index-view.ts:176` 的裸 `router.replace` 逐步收敛（消除 B-13 语义漂移）。

**r2 新增（H6 同源依赖单实例）**

- [ ] **C-36 桌面渲染层共享 webapp 源时必须去重同源运行时依赖（P0）**：凡 `apps/desktop` 与 `apps/web` **共同解析**、且必须**单实例**的运行时依赖（至少 `vue`、`vue-router`、`pinia`），渲染构建必须保证**只有一个物理模块实例**。落点 = `apps/desktop/electron.vite.config.ts` renderer 的 `resolve.dedupe: ['vue', 'vue-router', 'pinia']`（详见 §10.4 的方案对比）。**显式排除 `nue-ui`**：桌面 `1.10.58` / web `1.11.0` 的双版本是 SHELL-02 已裁决的"行为等价子集"，**不得**去重（会改变桌面行为）。
- [ ] **C-37 生产注入自检 + 打包态回归（P0）**：① 渲染层入口（或 `AppRoot` 顶层 setup）做一次**生产自检**：解析 `useRouter()` 与 `getCurrentInstance()?.appContext.config.globalProperties.$router`，若前者 `undefined` 而后者存在 ⇒ **显式 `console.error` +（可选）降级使用 `$router`**（不得静默）；② 构建后断言 `vender/vue-router-*.js` 仅含 **1 套** routerKey/`provide`；③ 回归基线 **BC-12** 必须在**打包态**（`out/` 或 `release/`）上跑，不得只跑 dev/vitest。

> **判据口径**：C-26/C-27/C-28/C-31/C-32 为 **P0 必做**；C-29/C-33/C-34/C-35 为 P1 加固。C-31 是否随批见 D2。

---

## 3. 边界 B-01…B-13 逐条裁决

| ID   | 边界                                   | 是否纳入本单 | 约束          | 建议方案                                                                                                                                          | 风险                                                                                       |
| :--- | :------------------------------------- | :----------- | :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------- |
| B-01 | `onOffline/onSignOut` 无 try/catch     | **P0 纳入**  | C-26          | `try/catch/finally`；`gatePassed` 移入 `finally`；失败走 C-28 回退链 + C-27 打点                                                                    | 失败静默若只 catch 不打点 ⇒ 问题被隐藏；必须捆绑 C-27                                       |
| B-02 | `runSync()` 顶层无 catch               | **P0 纳入**  | C-26          | `try/catch/finally` 进入 `failed` 终态；文案归入既有 error family（C-12）                                                                          | 误把基础设施异常当"网络错误"展示 ⇒ 归因不准；用中性文案                                                     |
| B-03 | 四条件失败无可见性                     | **P1 纳入**  | C-29          | 门侧预检 + 显式文案/动作；日志带原因码（无 PII）                                                                                                   | 过度暴露判据细节有安全/体验争议 → 只给"无法离线进入，请重试/重新登录"级别                                |
| B-04 | `LAST_VISITED` 可为失效深链            | **P0 纳入**  | C-28/C-30     | `resolve` 校验 + 回退链 + 清理非法键                                                                                                               | 无匹配 `matched=0` 表现为空壳（实测），非门停留；必须区分                                          |
| B-05 | section 重定向指向失效路由             | **P0 纳入**  | C-30          | 同 B-04；重定向目标合法性校验，非法则清键放行                                                                                                       | 与 B-04 同一封装，避免两处实现漂移                                                          |
| B-06 | 懒加载 chunk 离线不可用                | **P1 部分**  | C-27          | 桌面端（本地 chunk）不在本单修 chunk 预缓存；**先靠 C-27 捕获是否真的发生**；浏览器/Web 端预缓存另立单                                              | 若误判为根因投入预缓存，收益低；应先证据后投入                                              |
| B-07 | 无全局未捕获异常兜底                   | **P0 纳入**  | C-27          | 四类钩子（`error`/`unhandledrejection`/`errorHandler`/`router.onError`）+ 有界缓冲                                                                  | 日志泄 PII/token → 白名单字段；缓冲无界 → 显式上限                                          |
| B-08 | `/tasks` 落点缺 `viewType`             | **P0 纳入**  | C-31/C-32     | `/tasks` 重定向带默认 viewType + 视图自愈；**注意**：D-08 的 profile 早退会让自愈也失效，两者必须同批                                                | 只补 viewType 不修 D-08 ⇒ 仍永久 loading（假修复）                                          |
| B-09 | 离线标志仅内存（刷新失效）             | **不纳入**   | —             | 保持现状（C-22 已定：内存 flag、刷新即失效属无粘性绕过）                                                                                            | 无                                                                                          |
| B-10 | 使用中断网无在线/离线提示与再同步入口  | **P2 另立**  | —             | 单独立项（顶栏状态 + 手动同步）                                                                                                                     | 与 SHELL-02 轨道/状态面板边界交叉，须先对齐宿主契约                                         |
| B-11 | `isCredentialFailure` 文案正则脆弱     | **P1 纳入**  | C-34          | 结构化错误分类替代正则                                                                                                                              | 需触达错误类型来源（infrastructure 错误对象），跨包改动面见 §4                               |
| B-12 | 本地库为空/无该用户数据仍放行离线进入  | **P1 纳入**  | C-33          | 视图空态引导（"本地暂无数据，联网后将自动同步"）+ 重试；**不阻断进入**                                                                               | 阻断进入会违背"离线优先"；只做引导                                                          |
| B-13 | check-in 对 replace 返回值处理不一致   | **P1 纳入**  | C-35          | 统一 `safeNavigate`；`sign-in-page.vue:13`/`index-view.ts:176` 的裸调用一并收敛                                                                     | 收敛面较大，可分两步（先 AppRoot，再其余）；不得在 P0 引入回归                              |
| B-14 | **（新）`profile` 门控任务视图初始化** | **P0 纳入**  | C-31          | tasks 三视图去 `profile` 前置；离线走本地默认 preference + 硬默认 viewType；loading 三终态                                                          | 远端 preference 的离线降级口径需产品确认（见 D2/D3）                                        |

---

## 4. P0 / P1 最小可行改动集（含跨包边界与 DDD）

### 4.1 P0（根治"无反应" + 可观测 + 离线可见内容）

| #   | 文件                                                                                      | 改动                                                                 | 边界/约束                                                                 |
| :-- | :---------------------------------------------------------------------------------------- | :------------------------------------------------------------------- | :------------------------------------------------------------------------ |
| P0-1 | `apps/desktop/src/renderer/src/AppRoot.vue`                                              | `onOffline/onSignOut` 加 `try/catch/finally`；`gatePassed` 入 `finally`；调用 C-28 校验/回退；catch 走 C-27 打点 | desktop 源；`@/*` → `apps/web/src/*`（同一 bundle）                        |
| P0-2 | `apps/desktop/src/renderer/src/components/initial-sync-gate.vue`                         | `runSync()` 加 `try/catch/finally`，异常必落 `failed` 终态             | 同上                                                                      |
| P0-3 | `apps/desktop/src/renderer/src/main.ts` + `apps/web/src/main.ts`（或 `packages/shared`） | 注册 C-27 四类全局钩子 + 有界日志缓冲                                  | **若落 `packages/shared`** ⇒ 纯工具、无 domain-* 反向依赖，`guard:ddd` 不受影响 |
| P0-4 | `apps/web/src/router.ts`（+ 新 `apps/web/src/.../safe-navigation.ts`）                    | C-28/C-30 目标合法化、回退链、非法键清理、`safeNavigate` 雏形          | web 源被 desktop 复用；**单写者**                                          |
| P0-5 | `apps/web/src/components/tasks/{built-in-project,project,tag}/*.ts`                       | C-31：去 `profile` 前置、离线本地默认 preference、loading 三终态       | 视图层（app），不涉及 domain-*；`guard:ddd` 不受影响                        |
| P0-6 | `apps/web/src/views/index/tasks/routes.ts`                                               | C-32：`/tasks` 重定向显式带默认 viewType                               | 与 P0-5 同批，否则 B-08 变成假修复                                         |

### 4.2 P1（加固）

| #   | 文件                                                          | 改动                                                     | 约束  |
| :-- | :------------------------------------------------------------ | :------------------------------------------------------- | :---- |
| P1-1 | `initial-sync-gate.vue` + `auth/routes.ts`                   | 离线进入前预检四条件 + 显式出口                          | C-29  |
| P1-2 | 内容视图加载/空态组件                                        | loading 有界 + 空态/错误态可前进（B-12）                 | C-33  |
| P1-3 | `initial-sync-gate.vue` / 错误对象来源                        | 凭证类失败结构化判定替正则                               | C-34  |
| P1-4 | `check-in-page.vue` / `sign-in-page.vue` / `index-view.ts`   | 收敛到 `safeNavigate`                                    | C-35  |
| P1-5 | （证据驱动）chunk/网络探针                                   | 仅在 C-27 证实 chunk reject 后，再评估预缓存（另立）      | B-06  |

### 4.3 DDD / 跨包约束

- 改动面集中在 **app 层**（`apps/web` + `apps/desktop`），**不新增 domain-* 端口/不变量**；`guard:ddd`（`scripts/guard-domain-isolation.mjs`）预期**零命中**。
- **不得**为省事把导航/日志工具塞进 `packages/domain-*`（会引入 infra/传输概念）；若需共享，落 `packages/shared` 中立工具或 app 层。
- `AppRoot.vue`（desktop）→ `@/*`（web）已存在跨包复用，本次**不扩大**该模式；C-28 helper 优先落在 web 源并经 `@/` 复用，避免两端各写一份（C-20 同源纪律的类推）。
- **单写者纪律**：P0-1/2（desktop）与 P0-4/5/6（web）**由同一 writer 串行**完成，避免离线验收对象漂移；`packages/shared`（P0-3 若采用）需确认无其它在飞单改同文件。

---

## 5. 风险清单

| #   | 风险                                                        | 影响                                        | 应对                                                                 |
| :-- | :---------------------------------------------------------- | :------------------------------------------ | :------------------------------------------------------------------- |
| R1  | 只修 H1（gate 兜底）不修 D-08                              | 门会消失，但任务内容区仍永久 loading ⇒ 用户仍"进不去" | P0-5/P0-6 与 P0-1 同批；BC 增补"离线进入后内容终态"断言               |
| R2  | 只修 D-08 不修 H1                                          | 一旦导航 reject/hang，门仍永久卡死          | P0-1/P0-2 必做                                                       |
| R3  | `catch` 后静默进壳，问题被隐藏                              | 同类缺陷复发且不可见                        | P0-1 catch 必须配 C-27 打点；验收要求"失败路径有日志"                 |
| R4  | 全局日志泄 PII/token                                        | 隐私/安全                                    | C-27 白名单字段；禁记录 token/email；有界缓冲                        |
| R5  | 无匹配 `matched=0` 被误判为"门卡死"                        | 根因误判、修错方向                          | QA 必报 `router.currentRoute.value.{fullPath,name,matched.length}`    |
| R6  | D-08 的离线 preference 降级改变既有偏好语义                 | 视图偏好漂移/回归                            | 离线只用**本地已存 preference**；无则硬默认 `table`，不写远端         |
| R7  | 触发源实为 chunk reject（浏览器/dev 态）而 P0 未覆盖预缓存  | 该环境仍失败                                | C-27 先捕获；确证后 B-06 另立单，不在本单扩大                         |
| R8  | vue-router 5 与 4 的失败语义差异被旧经验误导                | 误判 reject/resolve                         | 本文 §1.2 实测为准；后续升级框架须重跑该探针                          |

---

## 6. 需 PM / 用户拍板

> 以下 trade-off 不替 PM 拍板；建议仅作架构偏好。

| ID   | 议题                                                                     | 建议 | 说明/影响                                                                                              |
| :--- | :----------------------------------------------------------------------- | :--- | :----------------------------------------------------------------------------------------------------- |
| D1   | P0 是否含 **D-08（C-31，tasks 三视图去 `profile` 前置）**                | 含   | 不含则离线进入后内容永久 loading，"无反应"在用户侧依旧；且属 SHELL-03 C-03 的约束覆盖漏项，应闭环      |
| D2   | 导航失败语义：**(A) 永不阻塞，进壳 + 回退 `/tasks` + 记录**，还是 **(B) 门停留并显式报错 + 重试** | A    | A 符合"门/壳总函数/永不卡死"；B 更保守但违背本轮根因。建议 A（配 C-27 日志）                          |
| D3   | 离线 preference 降级口径：远端 preference 不可用时用什么？               | 硬默认 `table` + 本地缓存（若有） | 影响 D-08 的落地与回归面；需产品确认是否接受"离线默认表格视图"                          |
| D4   | 全局错误日志落点：仅 console / console + 本地有界缓冲 / 远端上报          | console + 本地有界缓冲（本轮不做远端） | 远端上报涉隐私与基建，另立                                                       |
| D5   | B-12 本地库为空：只做空态引导，还是阻断离线进入？                        | 只做空态引导 | 阻断违背离线优先                                                                                       |
| D6   | B-06（chunk 预缓存）是否本轮做？                                         | 不做，证据驱动后另立 | 桌面端本地 chunk 概率低；浏览器态命中再投入                                                      |
| D7   | B-10（在线/离线状态与手动再同步）是否本轮做？                            | P2 另立 | 与 SHELL-02 轨道宿主契约交叉                                                                           |
| D8   | C-34（凭证类失败结构化）本轮是否做？                                     | 做（P1） | 若要压缩范围可延后，但需登记；不做则保留正则脆弱性                                                      |

---

## 7. 验收基线（建议新增，供 PRD/QA）

- **BC-8 导航总函数**：门/壳任一 `router.replace` 注入 reject（mock）⇒ **仍进入 `gatePassed=true` 终态**，且 C-27 记录一条错误。可自动化（AppRoot.test.ts 增例）。
- **BC-9 目标合法化**：`LAST_VISITED` 为失效路径 / `/auth/*` / 空 ⇒ 落点 `matched.length>0` 且非 auth；非法键被清理。可自动化。
- **BC-10 离线内容终态（D-08 回归线）**：`profile=null` + `/tasks`（无 viewType）⇒ 内容区在有限时间内进入**非 loading** 终态（渲染默认表格视图或显式空态），**不得永久 loading**。可自动化（组件级）。
- **BC-11 无匹配可见**：目标无匹配时不得停留在门；`matched=0` 必须由 C-28/C-30 消除或转显式空态。
- **BC-12 打包态离线进入（H6 回归线，r2 新增）**：在**生产构建**（`apps/desktop/out/` 或 `release/`）上，断网冷启动 → 解锁 → 同步失败 → 点「离线进入」⇒ ① `useRouter()` 非 `undefined`（或自检日志零命中）；② 路由从 `/auth/checkin` 变为目标路由；③ 内容区进入非 loading 终态（与 BC-10 联动）。可自动化：扩 `scripts/electron-smoke/shell-05-offline-repro.mjs` + 构建产物断言（C-37②）。

---

## 8. 变更管理

1. 本 ADR 为评审基线；实现期偏离 §2 任一约束 → 回到架构评审（口头同意不计）。
2. 本 ADR 修订/扩展 SHELL-03 的 **C-22**（顺序改为"必达兜底 + 失败仍进壳"）与 **C-03**（适用范围下推到内容视图）；SHELL-03 与本篇冲突时**以本篇更晚落盘者为准**，两篇互记一行。
3. 触发源实机结论（QA Console）回填至 §1.2 与 §1.5；若证实为 chunk reject，另立 B-06 单并回写。**r2：触发源已实锤为 H6（见 §10）；原 B-06 候选关闭**。
4. `guard:ddd` 若命中（预期不命中）→ 立即停止并按 DDD 分层重排落点。
5. 归档：`docs/adr/`，索引更新 `docs/adr/README.md`；日期取评审终签日。
6. **r2 变更（2026-09-13）**：新增 **C-36/C-37**、§10（H6 实锤）；**H6 并入 SHELL-05 P0**；`resolve.dedupe` 变更属于构建配置变更，落地后必须重跑 `desktop:build` 并在打包态验 BC-12。
7. **同源依赖纪律**：后续任何新增“desktop 与 web 共用且要求单实例”的依赖 ⇒ 必须同步更新 C-36 的 dedupe 清单，并在 §10.4 登记。

---

## 9. 证据索引

> 行号取自评审快照（2026-09-13）。定位歧义时以符号名/函数名为准。

- `apps/desktop/src/renderer/src/AppRoot.vue`：`onOffline`（`grantOfflineEntry` → `await router.replace(...)` → `gatePassed=true`）、`onSignOut`、`syncService.setSessionExpiredListener`
- `apps/desktop/src/renderer/src/components/initial-sync-gate.vue`：`runSync()`（顶层调用无 catch）、`isCredentialFailure` 正则、`onEnterOffline/onSignOut`
- `apps/web/src/views/auth/routes.ts:33-63`：`beforeEnter` 四条件与回落三分支
- `apps/web/src/views/auth/offline-entry.ts`：会话级 flag（内存）
- `apps/web/src/router.ts:14,17-38`：index 挂 `authBeforeEnter`；`beforeEach` 字符串重定向；`afterEach` 写 `LAST_VISITED`/section 键
- `apps/web/src/views/index/tasks/routes.ts:8-12`：`/tasks` → `tasks-built-in-project`（**无 viewType**）
- `apps/web/src/components/tasks/built-in-project/built-in-project.ts:38,63,67,82-89`：`loading=ref(true)`；`!profile` 早退；`switchViewType(preference||'table')`；projectId watch
- `apps/web/src/components/tasks/project/project.ts:38,58,67`；`apps/web/src/components/tasks/tag/tag.ts:55`：同型
- `apps/web/src/components/tasks/built-in-project/index.vue`：`v-if=loading` 分支
- `apps/web/src/views/index/index-view.ts:150-181`：`isLoading` + `.finally`；`route.name!=='index'` 早退
- `packages/infrastructure/src/persistence-local/crypto/crypto-service.ts:56`：`get isUnlocked()`（安全）
- `packages/infrastructure/src/persistence-local/session/local-session.ts:76-79`：`resolveUserIdFromStoredJwt`（解析失败返回 null，不抛）
- `node_modules/vue-router/dist/vue-router.esm-browser.js:2719-2760,2880-2890`：`pushWithRedirect` reject 条件（守卫抛错 / `Invalid redirect` / 无限重定向）；`replace` = `push`
- 前序：`docs/adr/2026-09-10-shell-03-offline-availability.md` §1.1（profile 仅内存）、附录 B（路由语义与四条件）、BC-5

**r2 新增（H6 证据链）**

- `pnpm why vue-router`（pnpm 11.18.0）：`Found 1 version, 2 instances of vue-router`——`peer#2990 → @nao-todo/desktopapp`；`peer#4805 → nao-todo(root)`
- 软链：`node_modules/vue-router` → `.pnpm/vue-router@5.2.0_…@voidzero-dev+vite-plus-core…`（实例 A）；`apps/desktop/node_modules/vue-router` → `.pnpm/vue-router@5.2.0_…@vue+compiler-sfc@3.5.41…`（实例 B）
- 声明：root `package.json` `vue-router:^5.0.7`；`apps/desktop/package.json` `vue-router:^5.2.0`（同版本 5.2.0，仅 peer 上下文不同）
- 构建图：`apps/desktop/stats.html` 的 `assets/vender/vue-router-DrofmNyp.js` 同时包含 A/B 两套 `…/vue-router/dist/{vue-router,devtools,useApi}.js`（A 主模 41664B，B 主模 0B 但 useApi 177B）
- 产物定罪：`vender/vue-router-DrofmNyp.js` 中 `const We=Symbol(""); function Ue(){return e(We)}`（`Ue`=`useRouter`，仅此 1 处引用 `We`）与 `e.provide(R,me)`（`R` 为 A 的 routerKey）**分属两套 Symbol** ⇒ B 的 `We` 从未被 provide
- 复现脚本：`scripts/electron-smoke/shell-05-offline-repro.mjs`（已探针 `app.__vue_app__.config.globalProperties.$router`）

---

## 10. 追加评审（r2, 2026-09-13）：H6 实锤与修复

> 输入：用户生产态 Console（§6 of PRD）+ PM `pnpm why` + 本次对 `apps/desktop/stats.html` 与 `out/renderer/assets/vender/vue-router-*.js` 的静态分析。**结论：H6 成立。**

### 10.1 机制链（可验证）

```
apps/desktop/src/renderer/src/AppRoot.vue
  import { useRouter } from 'vue-router'   → Node 解析 apps/desktop/node_modules → 实例 B
  const router = useRouter()                → inject(B.routerKey) → undefined（从未 provide）
  await router.replace(...)                 → TypeError: Cannot read properties of undefined (reading 'replace')

apps/web/src/router.ts（经 @ 复用，位于 apps/web）
  import { createRouter } from 'vue-router' → Node 解析 root node_modules → 实例 A
  createRouter(...) / app.use(router)       → provide(A.routerKey, router)
```

A、B 是同版本（5.2.0）但**不同物理模块**，各自持有独立 `routerKey = Symbol("")`。注入链只认 Symbol 引用相等 ⇒ 跨实例必为 `undefined`。

### 10.2 为何“看运气”：构建图与产物证据

| 证据 | 结果 | 含义 |
| :--- | :--- | :--- |
| `pnpm why vue-router` | 1 version / **2 instances** | 双实例存在于依赖图 |
| `stats.html` `vender/vue-router-*.js` | 同时列 A、B 两套 `dist/*` | 两实例都被打进**同一 chunk**（`manualChunks` 只“同文件”不“去重”） |
| 产物 `vender/vue-router-*.js` | `provide(R,me)` 与 `function Ue(){return e(We)}` 的 `R≠We` | 提供的是 A 的 key，注入的是 B 的 key |

**与 `manualChunks` 的关系**：当前 `manualChunks` 把所有 `vue-router` id 归 `vender/vue-router`，但 **Rollup/Rolldown 按模块物理路径去重、不按包名**；两实例路径不同 ⇒ 仍两份。故 `manualChunks` **不是修复**（只会把两份放一个文件）。

### 10.3 dev 与 prod

双实例是**解析层（pnpm isolated linker + 两处 package.json 各声明依赖）**造成的，不依赖压缩：**只要两个副本都被加载即复现**。dev 下 QA 早前未复现，可能是该会话下 web 侧入口未跑到或探测未覆盖；**不得**以 dev 未复现为由否定 H6（生产已实锤）。

### 10.4 修复方向对比（只评不改）

| 方案 | 做法 | 评价 |
| :--- | :--- | :--- |
| **A（推荐，P0）** | `electron.vite.config.ts` renderer 加 `resolve.dedupe: ['vue', 'vue-router', 'pinia']` | 最小、只动构建配置；Vite 强制从工程根解析到**同一实例**（A 或 B 均可，只要唯一）。**不改 lockfile/版本** |
| B | `.npmrc` `resolve-peers-from-workspace-root=true`（+`dedupe-peer-dependents=true`），重装 | 从依赖图根治，惠及未来其它包；但需 `pnpm install`、可能改 lockfile，风险与评审面更大 |
| C | `resolve.alias` 把 `vue-router` 指向单一物理包 | 与 A 等价但更硬编码；A 更通用（含 vue/pinia） |
| D | `pnpm.overrides` | **无效**：两实例同版本 5.2.0，差异在 peer 上下文，overrides 不合并 peer 变体 |
| E | 仅改 `manualChunks` | **无效**（见 §10.2） |

**建议**：A 为 P0；B 为 P1 卫生（另开小单，避免与 SHELL-05 功能修复同批改 lockfile）。

### 10.5 对 webapp 构建与既有 BC 的影响

- `apps/web/vite.config.ts` 全部依赖自 root 解析 ⇒ **已是单实例**，**无需改动、无影响**。
- `resolve.dedupe` 仅作用于 desktop renderer；不改变包版本、不改 lockfile、不触碰 `nue-ui` 双版本意图。
- 既有 BC-1…BC-7 无回归面（构建配置层）；但必须重跑 `desktop:build` 并在**打包态**验 **BC-12**。

### 10.6 与 H1 的关系：**H1 不能替代 H6，且单独修 H1 会产生假修复**

只加 `try/catch/finally` 时：`router` 仍 `undefined` ⇒ 目标 `replace` 从未发生 ⇒ `finally` 置 `gatePassed=true` 后，壳挂在**原路由 `/auth/checkin`** 上；`App.vue` 的 `<router-view>` 渲染 auth entry ⇒ check-in 离线失败 ⇒ 跳 `/auth/signin`。用户将看到“进了一下又被踢回登录页”——**比现状更难归因**。因此：

- **H6（C-36）与 H1（C-26）都必须修，且 H6 是根治项**；
- H1 不得静默吃掉 H6（catch 必配 C-27 打点 + C-37 自检）。

### 10.7 是否并入 SHELL-05 P0

**是，必须并入 P0**：

- 它是本次“无反应”的**直接触发原因**，不修则用户问题不消失；
- 修法小（1 行配置）但属**构建配置**，需单独评审与打包态验收；
- 与 P0-1/P0-5 同一验收闭环（BC-12/BC-10）。

### 10.8 遗留/待拍板（追加）

| ID | 议题 | 建议 |
| :--- | :--- | :--- |
| D9 | H6 修复走 A（`resolve.dedupe`）还是 B（`.npmrc` 根治） | **A（P0）+ B（P1 另单）** |
| D10 | 是否加入 C-37① 的“`$router` 降级”防御层（非仅自检报错） | 建议加（廉价且跨实例安全；`$router` 由 `app.use(router)` 直接写在 app 上，实例无关） |

---

## 11. 离线功能面审计（AC11，r3, 2026-09-13）——含 PRE-SHELL-06 同步回传设计

> 输入：用户追加口径「桌面端离线可进入，**主要功能不受网络影响（仅同步不可用）**」+「**离线本地照常写；联网后自动补传**」；PM 预扫 G1–G5；本次逐面静态审计。
> 结论：**功能面（任务/日历/番茄/搜索/清单标签/本地提醒）已本地优先、离线可用**；**缺口集中在“离线写入→回传”同步层（G1–G5 及同族）**，建议**拆 SHELL-06**。

### 11.1 关键架构事实（审计前提）

桌面端与 web 端同源码但**装配不同**：desktop 经 `@/hooks` 别名（`electron.vite.config.ts` 中 `@/hooks → apps/desktop/src/renderer/src/hooks`）覆盖 web 的 `@/hooks`，其 usecase 工厂**全部使用本地仓储**（`newLocalTaskRepository` / `newLocalProjectRepository` / `newLocalTagRepository` / `newLocalPomodoroRepository` / `newLocalTaskCommentRepository` / `newLocalTaskCheckItemRepository`，见 `apps/desktop/src/renderer/src/hooks/usecases/*`）。

⇒ **数据面 = IndexedDB（加密）本地真源**；网络仅用于 `syncService`（拉/推）与身份（profile/config/auth）。审计重点是：**哪些面把"网络数据/网络调用"当成了前置或阻塞**。

### 11.2 逐面扫描结果

| 面 | 离线行为 | 判定 | 证据 |
| :--- | :--- | :--- | :--- |
| 门/壳（进入） | 离线进入 + 壳渲染 | ✅（SHELL-05 T1–T5 已修） | H6/H1/D-08/B-07/B-04 |
| 任务·浏览/分页 | 本地 Dexie 查询；`use-task-loader` 失败置 `error` 并非永载 | ✅ | `LocalTaskRepoImpl.list`（try/catch 返回元组）；`use-task-loader.ts` |
| 任务·新建/完成/编辑/删除/拖拽排序 | 本地写 + `markDirty`（后台队列） | ✅（写可用） | `LocalTaskRepoImpl`（`:122,153,168,243` 等 markDirty） |
| 任务·详情（子任务/评论/检查项） | 本地仓储 | ✅ | `newLocalTaskCommentRepository` / `newLocalTaskCheckItemRepository` |
| 日历（月/周） | 本地 `taskUseCase.list`，`runSweep` try/finally 有界 | ✅ | `use-calendar-monthly.ts:75-100` |
| 番茄（计时/记录） | 本地仓储；记录 loader 失败置 error | ✅ | `use-pomodoro-usecase.ts` / `use-pomodoro-record-usecase.ts` |
| 搜索 | 本地 `taskUseCase.list`；项目/标签 `allSettled` | ✅ | `use-search.ts:220,254` |
| 清单/标签 | 本地仓储 + 本地偏好（localStorage/Dexie） | ✅ | `use-project-usecase.ts` / `use-tag-usecase.ts` |
| 本地提醒 | 扫描本地任务 + 精确调度，零网络 | ✅ | `use-local-reminder.ts` |
| 侧栏/同步状态轨 | 身份降级为缓存首字母；状态只展示不同步 | ✅ | `use-aside.ts`；`sync-status-bar.vue` |
| 设置·主题/语言/快捷键 | 本地 | ✅ | `theme-store` / `locale-store` |
| 设置·退出登录 | `authUseCase.signOut(userToken)` **远程**；离线 err ⇒ toast"退出登录失败"并 **return（不本地登出）** | ⚠️ Should | `settings/profile-updater/index.vue` |
| 设置·会话管理 | `loadSessions` 远程；离线 toast，不阻塞 | ⚠️ Could | `session-manager.vue:18-27` |
| 设置·资料展示 | `profile` 离线为 null ⇒ 字段空（未复用缓存昵称） | ⚠️ Could | `settings/profile-updater` |
| 身份 profile/config 拉取 | `IndexViewInitialize` 的 `Promise.all(...)` + `.finally` 置 `isLoading=false` ⇒ **有界**；服务身份类操作离线必失败（合理） | ✅ | `index-view.ts:167-184` |
| 同步（拉/推） | 离线失败 → 状态可见；**但存在永久不回传风险（G1–G4/G8/G11）** | ❌ Must | `sync-service.ts` / `sync-tracker.ts` |

> **重要防线已存在**：拉取 LWW 冲突时若本地有未推送修改（在 `syncQueue`）则**保留队列**（`applyPullBatch:505-518`）；推送确认前快照 `localUpdatedAt`，推送期间本地新改则保留队列重推（`:687-693`）。⇒ 不存在"拉取静默覆盖本地未推送"的普通场景。残余风险 = **远端时间戳新于本地未推送修改**时按 LWW 本地丢弃（设计口径，非缺陷；需在 SHELL-06 明确）。

### 11.3 缺口清单（G1–G14；Must/Should/Could）

| ID | 面 | 现象 | 根因 | 严重度 | 建议 | 归属 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **G1** | 同步 | 离线写入项触顶后**永不重推**，联网恢复也不补传 | `MAX_PUSH_RETRY=5` + `retryCount>=5 continue` + **无重置路径** | **Must** | R2/R4（暂停语义 + 可恢复） | **SHELL-06** |
| **G2** | 同步 | 离线几次编辑即触顶 | 一次网络失败对**整批脏队列** `markFailed()`（每项 +1） | **Must** | R2（离线暂停不计数） | **SHELL-06** |
| **G3** | 同步 | 恢复网络后**不自动补传**，只能手动重试/重启 | 无 `online` 监听、无周期退避、无前台恢复触发 | **Must** | R1 | **SHELL-06** |
| **G4** | 同步 | 无本地写上限/暂停可见性 | 无队列上限与暂停态 UI | **Must** | R3 | **SHELL-06** |
| **G6** | 同步/门 | 触顶后每次冷启动 `start()` 恒失败 ⇒ 门恒失败，每次需手动离线进入 | G1 衍生（`noteRunError(ERR_PUSH_RETRY_EXCEEDED)`） | Should | R4 | **SHELL-06** |
| **G8** | 同步 | 触顶的**删除**项永不推送 ⇒ 远端数据"复活" | 同 G1（`deletions` 也受 `retryCount` 跳过） | **Must** | R2/R4 | **SHELL-06** |
| **G11** | 同步 | 离线期每次写仍 2s 防抖发起推送 ⇒ 无效请求 + 加速触顶 | `setDirtyListener → schedulePush` 无离线/退避判断 | Must/Should | R1/R2 | **SHELL-06** |
| G7 | 同步 | 远端时间戳新于本地未推送修改 ⇒ LWW 丢弃本地 | 设计口径（LWW） | 非缺口 | SHELL-06 文档化 | SHELL-06 |
| G13 | 设置 | 会话管理离线 toast 噪声 | 网络子功能离线无降级态 | Could | 离线置"需联网"占位 | 可随 SHELL-06 P1 |
| G14 | 设置 | 资料页离线字段空 | `profile` null，未复用 C-15 缓存昵称 | Could | 复用 `readCachedNickname` 占位 | 可随 SHELL-05 P1 |
| G12 | 设置 | 离线无法退出登录 | `signOut` 远程失败即 return | Should | 本地清认证 + 导航，远程登出尽力而为（与 `password-updater` 同构） | 小修，随 SHELL-05 P1 或 SHELL-06 |

**结论：功能面无 Must 缺口**（均本地优先）；**所有 Must 均在同步回传层（G1/G2/G3/G4/G8/G11）**。

### 11.4 PRE-SHELL-06：最小方案（R1–R5）

> 原则：沿用 SHELL-03 的 run 生命周期（C-07…C-11）与 C-22（不得用 `navigator.onLine` 作鉴权/放行）。同步始终后台、**绝不阻塞本地 CRUD**。

- **R1 回传触发（re-submission）**：
    - `window.addEventListener('online')` **仅作触发/提示**，不作鉴权与放行判据（`onLine=false` 不可靠，故 offline 事件**不阻断**，仅 online 事件触发一次 `manualSync`）。
    - 触发源：① 启动/解锁（已有 `start()`）；② 前台恢复（`visibilitychange→visible`，节流）；③ 指数退避定时（仅当有待推送/失败项：5s→10s→30s→60s→120s 封顶，成功清零）；④ `online` 即时一次。
    - 全部经 `syncService.enqueue` 串行队列防重入；凭证类失败仍走会话失效（不自动重试）。
- **R2 重试语义（暂停 vs 真实失败）**：
    - **网络类**（`ERR_NETWORK`/超时/5xx/归一化断网）⇒ **暂停**：**不累加 `retryCount`**，仅记 `lastAttemptAt`；网络/前台恢复⇒**清暂停态并立即重试**（根治 G2/G11）。
    - **业务/数据类**（未确认/字段不匹配/非 401-403 的 4xx）⇒ 计 `retryCount`（有限次 + 退避）。
    - **凭证类**（401/403/10041）⇒ 维持现状（不累加、跳登录）。
- **R3 本地写上限 + 暂停可见性**：队列超阈值（建议单表/总量双阈值）⇒ UI 显式「待同步（暂停）」+ 计数 + 「立即重试」；**不阻断本地写**；硬上限仅提示不丢数据（根治 G4）。
- **R4 触顶项可恢复**：新增 `syncTracker.resetFailed(userId)`（或改 `retryCount` 为 `nextAttemptAt` 退避），在**手动同步/网络恢复/前台恢复/重启**时重置，使触顶项重新入列（根治 G1/G6/G8）。
- **R5 不阻塞功能（AC11 不变）**：本地 CRUD 不等网络；UI 仅消费 `syncStatus`；同步失败不得改变任何页面的可用性。

**AC12（可测）**：① 离线写 N 次→联网 ⇒ **无需手动**自动补传，最终 `pendingCount/failedCount→0`；② 离线连续≥5 次编辑**不触顶**；③ 恢复网络后 ≤ 1 个退避周期内自动推送；④ 触顶项在手动同步后恢复（G1/G8）；⑤ 离线期 UI 仍可 CRUD（AC11）；⑥ 凭证失效仍跳登录、不自动重试。

**BC 建议**：**BC-13** 离线回传自动恢复；**BC-14** 离线暂停不消耗重试额度；**BC-15** 触顶可恢复（含删除项）；**BC-16** 本地写不阻塞/不丢（队列可增长且可见）。

### 11.5 裁决：拆 SHELL-06（建议）

- **不并入 SHELL-05 P0**：SHELL-05 P0 是"**门/壳/依赖/内容就绪**"的可用性缺陷修复（已完成 T1–T6）；同步回传属**同步层语义**，改动面在 `packages/infrastructure/src/persistence-sync/*`，与 SHELL-03 的 run 边界/BC-3/BC-6 交叉，需独立 ADR 与回归，合并会显著放大风险面（违反"变更最小化"）。
- **拆 SHELL-06**：范围 = R1–R5 + G1/G2/G3/G4/G8/G11；P1 = G6/G12/G13。
- **SHELL-05 侧仍可顺手做的小修**（P1，不涉同步层）：**G12**（离线本地登出，与 `password-updater` 同构）、**G14**（设置页复用离线昵称缓存）。

### 11.6 待拍板（追加）

| ID | 议题 | 建议 |
| :--- | :--- | :--- |
| D11 | 同步回传缺口（G1–G4/G8/G11）**并入 SHELL-05 P0** 还是**拆 SHELL-06** | **拆 SHELL-06**（风险面在同步层） |
| D12 | R2 重试语义：维持 `retryCount` 上限 + 恢复重置，还是改 `nextAttemptAt` 指数退避 | 推荐后者（退避 + 可恢复，消除"触顶即永久"） |
| D13 | R1 是否引入周期退避定时器（保活/耗电权衡） | 仅在有待推送/失败时启用，最长 120s，成功即停 |
| D14 | R3 本地写硬上限阈值与超限文案 | 需 PM/用户定阈值与文案 |
| D15 | G12/G14 是否随 SHELL-05 P1 同批 | 建议同批（小改、离线体验） |
