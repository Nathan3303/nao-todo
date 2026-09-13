# 2026-09-13 桌面端离线边界勘察（SHELL-05 立项前）

> 性质：**勘察报告**（非 PRD）。用于定位"离线进入无响应"根因 + 列出潜在边界，供用户圈定范围。
> 触发：用户实测——断网情况下桌面端无法进入「任务」，点击「离线进入」无反应，疑似控制台报错。
> 前序：SHELL-03 离线可用性（`docs/prds/2026-09-10-shell-03-offline-availability.md`，当时 QA PASS）。

## 1. 离线进入代码路径（现状）

```
UnlockGate(unlocked) → InitialSyncGate(syncService.start())
   ├─ ok  → emit synced   → AppRoot.onSynced: revokeOfflineEntry + gatePassed=true
   └─ fail→ 展示「重试 / 离线进入 / 登出」
                └─ 离线进入 → emit offline → AppRoot.onOffline:
                      grantOfflineEntry()
                      await router.replace(LAST_VISITED || '/tasks')   ← 无 try/catch
                      gatePassed = true
路由守卫（挂在 index 根路由）：beforeEnter = authBeforeEnter
   离线放行四条件（全本地）：flag 已授予 ∧ JWT 可解析 userId ∧ localSession.userId===jwt ∧ cryptoService.isUnlocked
   任一不满足 → 回落三分支（jwt 在但未认证 → auth-checkin；无 jwt → auth-signin；…）
```

## 2. 根因假设（按可能性排序，**待控制台报错确认**）

| # | 假设 | 机制 | 证据 | 是否解释"无反应+报错" |
| :--- | :--- | :--- | :--- | :--- |
| **H1** | `onOffline` 未兜底 | `await router.replace(...)` 若 **reject**（守卫抛错 / 懒加载 chunk 加载失败 / 导航被中断），异常冒泡 → `gatePassed` 永不置位 → 停在门，按钮"点了没反应" | `AppRoot.vue` `onOffline` 无 try/catch；对比 `check-in-page.vue` 对返回值有处理 | ✅ 高度吻合 |
| **H2** | 放行四条件在真实环境不成立 | 离线进入后导航到 `/tasks` 仍走 `authBeforeEnter`；若 `localSession.getCurrentUserId()` 或 `cryptoService.isUnlocked` 不满足 → 回落 `auth-checkin` → 离线检入失败 → 跳登录页 | `routes.ts` 四条件；`unlock-gate.checkLocal` 置 `localSession` | ✅ 表现像"被踢回登录页" |
| **H3** | 目标路由不可达/无匹配 | `LAST_VISITED_ROUTE` 指向已失效深链（如已删任务详情、`/settings*`、`/search/<id>`）→ 重定向/无匹配/空白 | `router.afterEach` 写入 `LAST_VISITED`；`settings-legacy-fallback` 等 | 部分（可能白屏而非报错） |
| **H4** | 门卡在 `syncing` | `syncService.start()` 内部 `finishRun` 若抛错 → `start()` reject；`initial-sync-gate` 的 `runSync()` 无 try/catch → `syncing` 永真，**按钮根本不出现** | `initial-sync-gate.vue` `runSync()` 顶层调用无 catch | 部分（按钮不可见） |
| **H5** | 凭证误判隐藏按钮 | `isCredentialFailure` 用文案正则 `/登录已过期\|401\|403/` 匹配，离线错误文案若含 "401/403" 片段 → 离线进入被隐藏 | `initial-sync-gate.vue`；SHELL-03 L8 已登记脆弱性 | 部分 |

## 3. 潜在边界清单（B-01…）

| ID | 边界 | 现状 | 风险 |
| :--- | :--- | :--- | :--- |
| B-01 | `onOffline` / `onSignOut` 无 try/catch | 任一导航异常即永久卡门 | **高**（当前疑似命中） |
| B-02 | `runSync()` 顶层调用无 try/catch | `start()` 意外 reject → 永加载 | 高 |
| B-03 | 离线放行四条件无"失败可见性" | 不满足时静默回落检入→登录，用户不知为何 | 中 |
| B-04 | `LAST_VISITED_ROUTE` 可为失效深链 | 直接 replace → 无匹配/白屏 | 中 |
| B-05 | `router.beforeEach` 的 section 重定向用 `LAST_TASKS_ROUTE`，可能指向失效路由 | 循环/落空白 | 中 |
| B-06 | 懒加载路由 chunk 离线不可用（web 尤其） | `router.replace` reject | 中（desktop 本地 chunk 影响小） |
| B-07 | 无全局 `unhandledrejection` / `uncaughtException` / `window.onerror` 兜底 | 错误不可见、无法上报 | 中 |
| B-08 | 离线进入后落 `tasks` 重定向缺 `viewType` | `/tasks` → `tasks-built-in-project`（无 viewType）→ 可能空壳 | 中 |
| B-09 | 离线标志仅内存：离线中刷新即失效，需重新走门 | 可接受，但快速刷新体验差 | 低 |
| B-10 | 使用中（非冷启动）断网无任何在线/离线状态提示与再同步入口 | 同步失败只在状态面板，任务页无提示 | 中 |
| B-11 | `isCredentialFailure` 文案正则脆弱 | 文案一变即误判 | 中（SHELL-03 L8） |
| B-12 | 本地库为空/无该用户数据时仍放行离线进入 | 进壳后空白无引导 | 低-中 |
| B-13 | `check-in-page` 对 `router.replace` 返回值处理与 AppRoot 不一致 | 语义漂移 | 低 |

## 4. 拟议范围（待用户圈定）

- **P0 必做（根治"无反应"）**：为门/壳的所有导航与同步调用加**必达兜底**（try/finally + 失败可见 + 永不卡死）；统一 `router.replace` 失败处理；`LAST_VISITED` 失效兜底到 `/tasks`；补**全局未捕获异常日志**（可观测）。
- **P1 加固**：四条件失败给明确文案/动作；`tasks` 落点补默认 `viewType`；离线进入后本地空数据引导。
- **P2**：使用中断网的在线/离线状态与手动再同步入口（可能另立）。
- **不在本单**：离线写入完整口径（SHELL-03 L2/L3）、离线专属常驻 UI（L4）、mobile 同类（L5）。

## 5. 复现与已知信息（用户确认）

- **复现步骤**：断网冷启动 → 输入密码**解锁成功** → 初始同步门显示失败态 + 「离线进入」→ 点击**无反应**。
- **控制台**：用户未查看 → **需 QA 实机抓取**（Console + 未捕获异常）。
- **已排除**：按钮可见且可点（非 H4/H5 的"按钮不可见"）；非"踢回登录页"明显表现（排除 H2 的直接形态，但需实机确认路由最终落地）。
- **推断**：解锁成功 ⇒ `localSession` 已置位、`cryptoService.isUnlocked=true` ⇒ 四条件大概率成立；点击无反应 ⇒ `onOffline` 在 `gatePassed=true` 之前抛错 ⇒ **H1（`router.replace` reject 未兜底）为主嫌**。需实机确认 reject 原因（守卫抛错 / chunk 加载 / 无匹配 / 其它）。

## 6. 用户提供的生产态 Console（2026-09-13）——新增根因 H6/N-03

```text
vue-ecosystem-Dowj-6PF.js:1 TypeError: Cannot read properties of undefined (reading 'replace')
    at u (index-DOz7xaey.js:2:153070)
    at Pn (vue-ecosystem-Dowj-6PF.js:1:19815)
    at Mn (vue-ecosystem-Dowj-6PF.js:1:19886)
    at Ur (vue-ecosystem-Dowj-6PF.js:1:42521)
    at l (index-DOz7xaey.js:2:148078)
    at Pn ... at Mn ... at Ur ...
    at _ (nue-ui-CjN0vhxe.js:1:5130)
    ...
```

**逐帧定罪（用当前 `apps/desktop/out` 产物反查列偏移）**：

| 帧 | 归属 | 含义 |
| :--- | :--- | :--- |
| `_` (nue-ui) | NueButton `onClick` | `function _(e){m.useThrottle?b(e):c("click",e)}` = 一次**按钮点击**（离线进入为 `nue-button`） |
| `l` (app) | `initial-sync-gate` 的 `onEnterOffline` | `l=()=>{a("offline")}` = emit offline |
| `u` (app) | `AppRoot.onOffline` | `u=async()=>{Rs=!0,await t.replace(localStorage.getItem(Ls)||"/tasks"),r.value=!0}` |
| `t` | `const t=ve()`，`ve` = vue-router 的 `u as ve` = **`useRouter()`** | `t.replace` 读 undefined ⇒ **`useRouter()` 返回 undefined** |

**判定**：用户个案 = **H6（生产态 `AppRoot` 的 `useRouter()` 为 undefined）**，与 H1（导航 reject 未兜底）是**不同机制但同处一线**（两者都使 `gatePassed` 永不置位 ⇒ 停在门 = "点击无反应"）。

**环境证据**：用户的 `nue-ui-CjN0vhxe.js` 与 `vue-ecosystem-Dowj-6PF.js` 与当前 `out/` **hash 一致**（同依赖、同构建配置），仅 `index-*.js`（app 源码）不同 ⇒ **生产/打包态特有**，dev（QA 环境）不复现。

**待查**：为何仅生产构建 `useRouter()` 为 undefined（候选：`vue-router` 双物理副本导致 inject key 不一致、插件安装顺序/去重差异、old build 残留）。QA 需在**生产构建**上复现并验证 `app.config.globalProperties.$router` / 注入可用性；arch 需从打包产物分析模块实例唯一性。

### 6.1 根因实锤（2026-09-13，PM 直接证据）

`pnpm why vue-router` → **`Found 1 version, 2 instances of vue-router`**；软链证实**按导入方解析到不同物理实例**：

```text
根 node_modules/vue-router            -> .pnpm/vue-router@5.2.0_…vite-plus-core…/   ← instance A（webapp 源码经根解析）
apps/desktop/node_modules/vue-router  -> .pnpm/vue-router@5.2.0_…@vue+compiler-sfc…/ ← instance B（桌面源码解析）
```

- `apps/web/src/router.ts`（经 `@` 别名被桌面复用）用 **A** 的 `createRouter`；`app.use(router)` 注册 **A 的 routerKey**。
- `apps/desktop/.../AppRoot.vue` 用 **B** 的 `useRouter` → 注入 **B 的 routerKey** → **undefined** → `t.replace` 抛错。
- 产物佐证：`vender/vue-router-*.js` 仅一个 chunk，但 `beforeEach` 等运行时符号仅 1 份（A 的运行时树摇后）＋ B 仅贡献极小的 `useRouter`/routerKey ⇒ 同 chunk 内两套 symbol。
- 为何在线“看似正常”：主路由导航均由 webapp 源码（A）完成；仅 `AppRoot` 的 `onOffline`/`onSignOut`/会话失效监听（B）在点击时爆。
- 复现面：dev 与 prod 均可（解析按导入方，与是否压缩无关）；与用户“dev 也一样”一致。

**修复方向**：`apps/desktop/electron.vite.config.ts` renderer 增 `resolve.dedupe: ['vue-router','vue','pinia']`；或统一/ hoist 依赖使单一实例（`pnpm.overrides`）。具体由架构定稿。

## 7. 待用户圈定的范围

按 §4 的 **P0 + P1** 立项？（P2 另议）
