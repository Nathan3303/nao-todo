# T557 · 桌面端「登录成功提示已出、界面仍停在登录页」—— 残余阻断路径（读码复核 r2）

> **形态**：只读复核（未改任何源码 / 未 commit / 未切分支；`read --offset/--limit` + `grep` 口径，`.codegraph` 未安装 ⇒ 影响面类结论为 grep 穷尽清点，非结构化调用图）。
> **基线**：`HEAD = 6c8cc424`（含 `7e93e5eb` 五项修复 + `v1.13.2`）。**产物一致性已静态核验**：`apps/desktop/out/renderer/index.html` 主入口 = `assets/index-howcwX2T.js`，该 chunk 在 `release/linux-unpacked/resources/app.asar` 内（asar header 命中），`out/` 与 asar 时间戳同为 `2026-10-26 22:18`；产物内含修复⑤（chunk 内命中 `common.navigationFailed` / `router-injection`）。
> **输入**：PM 派单 seq 13 + 中途证据补给 seq 14（`qa-T556` 实测：并发 checkin 一方必 `10022`；冷启动仍发两次 checkin）。**已修的 ①②③④⑤ 链路不再重推**（见 §五「已排除」）。
> **对齐**：`docs/reports/T551-auth-credential-audit.md` §四 / §六（DEF-85…DEF-93）、`docs/tasks-state.md`（DEF-87「仅部分修复」）、`docs/reports/defect-pool.md`。

---

## 一、结论

**① 与 ④ 都只作用在「登录时点」，没有解决「检入通道本身没有单飞」与「冲突码 `10022` 被当凭证失效」这两处。** 残余阻断路径按「能解释『提示已出但界面不动/回到登录页』」重排后，最可能是：

1. **P0-1：并发检入的 `10022` 被 fail-closed 判成凭证失效 ⇒ 清 `USER_JWT` ⇒ 回 `/auth/signin`。** 服务端 `10022` 的语义是**「我的旧 token 已被别的请求换掉了，请重试」**（CAS 冲突），客户端却按「会话失效」处理。此处**完全没有宽限**（宽限只挂在 axios 的 `10041` 分支上，`10022` 是 HTTP 200 业务码，永不经过它）。这条链**端到端读码闭合**，且与 `qa-T556` 的服务端实测 `10022` 直接对接。
2. **P0-2：第二路 checkin 的来源尚未定位（qa 实测两次，静态无法复现）**。`scheduler.start()` 只是「同实例重入幂等」，不是「检入单飞」；`lastCheckInAt` 只在**模块内存**里（reload 即丢）。
3. **P0-3：桌面复用了 web 数据面 ⇒ `/auth/checkin` 页就已经开始 `pull`（带旧 token）⇒ 检入轮换后 pull 收 `10041` ⇒ `syncService` 的失效回调不查宽限 ⇒ 清全套 + 回登录页。** 这是「重启/刷新回登录页」的独立机理（DEF-45 / DEF-87 家族），也覆盖「登录成功 → 首拉窗口」。

三个 P0 共用同一根因面：**「凭证失效」被当成一个全局布尔（谁先看到谁清），而不是「某个 token 失效」的局部事实** —— 于是任何陈旧/并发/无关的 `10022|10041` 都能清掉刚刚建立的会话，而用户只看到「成功提示之后什么也没发生」。

---

## 二、判定框架：三种互斥终态

| 终态                     | 观测特征                                                                                   | 归属路径       |
| :----------------------- | :----------------------------------------------------------------------------------------- | :------------- |
| **A 导航没发生**（失败） | `location.hash` 全程 `/auth/signin` 不变；`__NAO_ERROR_LOG__` 有 `auth:sign-in-navigation` | P1-4（导航面） |
| **B 导航发生又被撤销**   | hash 曾变为 `#/tasks`（或已渲染壳），随后回 `#/auth/signin`；`USER_JWT` 消失               | P0-1/2/3、P1-5 |
| **C 看到的不是本次会话** | 渲染层入口 chunk / 进程启动时间与「22:18 产物」不一致                                      | 见 §六 断言 0  |

判定顺序必须是 **C → A → B**：先证明「跑的是这份产物」，再判「导航有没有发生」，最后只在 B 里区分是哪一路清了凭证（§六 探针 4 直接抓「谁删了 `USER_JWT`」）。

---

## 三、残余阻断路径（排序：最可能 + 最易判伪在前）

### P0-1 并发检入 ⇒ `10022` ⇒ fail-closed 清凭证 ⇒ 回登录页

**机制**：两次检入用**同一个 token** 并发 ⇒ 服务端 CAS 只许一次换发，败者返回 `10022`（语义 = 冲突可重试）⇒ 客户端 `isCredentialError` 是**网络白名单**（除网络类之外一切都是凭证类）⇒ `AuthUseCase.checkIn` 直接 `clearAuthData()`（删 `USER_JWT`）⇒ 页面侧 `replace('/auth/signin')`；若败者是续期侧，则 `credential-error` ⇒ 系统通知 + `handleSessionExpired`（清全套含 `cryptoService.lock()`）⇒ 用户看到「成功提示已出、界面回到/停在登录页」，且**没有任何错误原因**。

**读码证据**

- 服务端 CAS：`nao-todo-server/infrastructure/persistence/identity/sessionRepoImpl.go:278-298`（`UpdateToken`：`RowsAffected == 0` ⇒ 「会话已被其他请求轮换或删除」）。
- 服务端对外码：`nao-todo-server/interfaces/controllers/identity.go:169-186`（CheckIn 任一错误 ⇒ `Code: 10022, Message: "检入失败"`；成功 `10020`）。
- 客户端分类（fail-closed）：`packages/domain-identity/src/application/usecases/auth-service/error-classification.ts:14-23`（网络白名单只有 `ERR_NETWORK` / `ECONNABORTED` / `50300` / `40800` / `42900` / `10051`）、`:62-76`（非白名单 ⇒ `true`）、`:82`（`10022` **只**出现在读路径 fail-soft 集 `CREDENTIAL_FAILURE_CODES`，**不在**判定器里，故必然被判凭证）。
- 清凭证：`packages/domain-identity/src/application/usecases/auth-service/usecase.ts:74-82`（`checkIn` 失败 ⇒ `isCredentialError` ⇒ `clearAuthData()`）。
- 回登录页（两条）：`packages/presentation-identity/src/components/check-in.vue:39-52`（页面侧凭证类 ⇒ `router.replace('/auth/signin')`）；`apps/desktop/src/renderer/src/hooks/use-desktop-session-renewal.ts:46-53` + `apps/desktop/src/renderer/src/AppRoot.vue:93-97`（续期侧 ⇒ 通知 + `handleSessionExpired`）。
- **宽限不覆盖**：宽限只在 axios 响应拦截器的 `10041` 分支 `packages/shared/requester/axios.ts:74-81`（`code === 10041` / `errorCode === 10041`）；`10022` 是 HTTP 200 业务码，**永不进入**该分支（服务端 `Failure` 走 `http.StatusOK`：`nao-todo-server/interfaces/controllers/responser.go:28-30`）。

**最小判伪**：把 `PUT /auth/checkin` 的第二次（或调度器那一次）**不发**（CDP 拦截 / 先 `scheduler.stop()`），现象消失 ⇒ 成立。或：观测到 `10022` 响应与 `hash → #/auth/signin` **同一时刻（<200ms）**、且 `USER_JWT` 被删的调用栈里有 `AuthUseCase.checkIn`。

**修法方向（不写码）**：① 客户端把 `10022` 从「凭证失效」降级为「冲突-可重试」——用**当前 store token** 重试一次，仍失败才判失效（`10022` 与 `10041` 的服务端语义本就不同，属契约口径补齐）；② 检入**单飞**：同一 token 的并发 checkin 合并为一个 in-flight promise（复用其结果）；③ 服务端是否补一个「可重试」专用码（跨仓，需 PM 定，本轮可不做）。

---

### P0-2 第二路 checkin 的来源未定位（`start()` 不是单飞）

**机制候选**（按可疑度；三者都只在「已认证 + 有 token」时生效，故都必须先解释 `isAuthenticated` 何时变 true）：

- **(a) `scheduler.start()` 语义是「同实例重入幂等」，不是「检入单飞」**：`packages/shared/session-renewal/index.ts:164-186` —— `if (active) return` 只挡住「active 期间的重复调用」；一旦 `stop()` 过（登出/`clearAuthData`/token 短暂为空任一瞬），下一次 `start()` 会重新判窗口：**距上次发起 ≥60s ⇒ 立刻真发一次 checkin**（`RENEWAL_START_WINDOW_MS = 60*1000`，`:31`）。
- **(b) `lastCheckInAt` 只在模块内存（`session-renewal/index.ts:73-86`）**：窗口 reload / renderer 重启（含 `Ctrl+R`、崩溃重载）会让记录归零 ⇒ 新实例第一跳 `start()` 必走 `attempt()` 立即检入。**而检入页本身在 reload 后也会检入一次** ⇒ 天然双发。
- **(c) 检入页无幂等标记**：`packages/presentation-identity/src/components/check-in.vue:65` 每次挂载 `void checkIn()`；`apps/web/src/components/auth/check-in-page.vue` 全文件无「是否已检入/是否在途」判据 ⇒ 组件只要挂载两次就发两次。

**读码证据**：`apps/desktop/src/renderer/src/hooks/use-desktop-session-renewal.ts:56-71`（watch：`[isAuthenticated, token]` 变化即 `start()/stop()`；数组 getter 每次返回新引用 ⇒ **每次依赖变化都会回调**，靠 `start()` 的 `active` 兜住，而 `active` 是**每实例**的）；`apps/desktop/src/renderer/src/AppRoot.vue:89-99`（唯一装配点，但装配在根组件 setup ⇒ 根组件重挂/热重载会再造一个 scheduler + 新 `active=false`）。

**最小判伪**：抓 `/auth/checkin` **每一次**调用的 `new Error().stack`（§六 探针 2）——栈里出现 `use-desktop-session-renewal` ⇒ (a)/(b)；出现 `check-in.vue` 两次 ⇒ (c)。

**修法方向**：① 检入单飞下沉到 **模态**（`AuthUseCase.checkIn` 或 requester 层，按 token 键控 in-flight promise），调度器/页面/未来入口全受益；② `lastCheckInAt` 落 `sessionStorage`（跨 reload 复用，且不落业务键面）；③ 检入页加「已成功/在途」幂等门。

---

### P0-3 冷启动数据面 `pull` 与检入轮换竞态；sync 的 `10041` 处置**不查宽限**

**机制**：桌面复用 web 的 `useApp()`，`router.afterEach` + `router.isReady()` 即 `startWebDataPlane()` ⇒ **在 `/auth/checkin` 页就已经发起 `pull`（携带旧 token）**；随后检入 CAS 轮换 ⇒ 在途 pull 收 `10041` ⇒ `syncService` 走**自己的**失效回调（清全套 + `cryptoService.lock()` + `replace('/auth/signin')`），**完全不查 `consumeRotationGrace()`** ⇒ 10s 宽限窗口内也照样被踢。

**读码证据**

- 数据面启动点：`apps/web/src/app.ts:38-46`（`router.afterEach(() => startWebDataPlane())` + `router.isReady().then(...)`）⇒ 与「门」无关，auth 页也启动。
- 启动即拉：`apps/web/src/data-plane.ts:100-118`（`syncService.start()`，`activeUserId` 只按用户去重，不按 token）。
- 带旧 token：`packages/infrastructure/src/persistence-sync/sync-service.ts:442-446`（`Bearer ${getJWTFromLocalStorage()}`，**无 token 时拼 `Bearer null`**，DEF-93 仍在）。
- `10041` 处置（pull/push 两处，均**无宽限判据**）：`sync-service.ts:780-788`（`markCredentialFailure()` + `notifySessionExpired()`）、`:1155-1162`。
- 清全套 + 导航：`apps/desktop/src/renderer/src/AppRoot.vue:76-83`（`clearAuthData` + `localSession.clear` + `cryptoService.lock` + `safeReplace('/auth/signin')`），注册点 `:85`。
- 对照：宽限只存在于 axios 拦截器 `packages/shared/requester/axios.ts:74-76`（`handleCredentialExpired → consumeRotationGrace()`）。

**最小判伪**：把 `pull` 人为延迟到检入响应之后（或先把 `activeUserId` 置位使首拉跳过）⇒ `10041` 与踢出消失 ⇒ 成立。反向：在检入成功 ≤10s 内仍被踢 ⇒ 宽限已被绕开 ⇒ 成立。

**修法方向**：① sync 的 `10041` 处置**必须**与 axios 共用同一判据（宽限 / 「失败请求的 token === 当前 token」）；② 桌面数据面启动点后移到「门通过/壳挂载后」（当前是把 web 的 `afterEach` 启动点整段带到了桌面）；③ 中期：失效处置单点化（一个失效中心，三处调用方只上报事实）。

---

### P1-4 导航未完成的安静面（`sign-in` 页走裸 `useRouter()`）

**机制**：若 `useRouter()` 在该组件位置返回 `undefined`（H6 家族回归 / 装配变化），`safeReplace` 的 `router` 不可用分支**只记结构化日志、不给用户提示**（修复⑤ 的可见提示与重试都在「有 router」之后）⇒ 成功提示之后完全静默。

**读码证据**：`apps/web/src/safe-navigation.ts:118-126`（`if (!router) { recordShellError(...); return }`，**无 `notifyNavigationFailed()`**）；`:134-144`（有 router 才提示 + 250ms 重试）；`apps/web/src/components/auth/sign-in-page.vue:13-14,26-36`（裸 `useRouter()`，未用 `apps/web/src/router-access.ts` 的 `resolveRouter()`）；对照 `apps/desktop/src/renderer/src/AppRoot.vue:38-40`（桌面根用 `resolveRouter()` 兜底）。
**当前产物已排除 H6**：`apps/desktop/stats.html` 中 `vue-router@5.2.0` 仅 1 条模块 id、`out/renderer/assets/vender/vue-router-*.js` 单文件（SHELL-05 §10 同口径） ⇒ **本条在本产物上不成立**，仅列为「回归风险 + 唯一完全静默的导航失效口」。
**另含**：守卫内两个 `await` 抛错/悬挂同样落在「导航未完成」，但会经⑤ 提示（`apps/web/src/views/auth/routes.ts:90-95`；`bootstrapLocalData` 全程 Dexie：`apps/web/src/views/auth/bootstrap-local-data.ts:44-78`）。

**最小判伪**：`__NAO_ERROR_LOG__` 中出现 `auth:sign-in-navigation` + 消息「router 不可用，导航中止：…」；`location.hash` 不变。
**修法方向**：auth 两页改用 `resolveRouter()`；`router 不可用` 分支也给可见提示（与⑤ 口径一致）。

---

### P1-5 `10041` 处置既不比对 token、又有三套清理口径

**机制**：失效判据是「收到了 `10041`」，不是「**当前** token 失效」。任何**用旧/空 token 发出**的请求（在途 pull / profile / config / epoch，或 `Bearer null`）返回 `10041` 时，都能把**刚刚建立**的会话清掉；三处清理动作还不一致（只清 store / 清全套 / 停摆+通知）。

**读码证据**：`packages/shared/requester/axios.ts:63-76`（每实例一个 `authExpiredFired` 闩，`consumeRotationGrace()` 之外不比对请求 token；`onAuthExpired` 回调签名不带 token）；`apps/desktop/src/renderer/src/main.ts:14-21` 与 `apps/web/src/app.ts:18-25`（**桌面两端各 init 一次** ⇒ 两个实例、两套闩；`packages/shared/requester/index.ts:22-45` 后 init 覆盖全局实现）；`sync-service.ts:427-429`（第二套口径）；`AppRoot.vue:93-97`（第三套）。陈旧请求的真实存在点：`apps/desktop/src/renderer/src/components/unlock-gate.vue:104-111`（**未登录也发** `GET /user/profile`）+ `:113-117`（`phase==='ready'` 即发）⇒ 冷启动必有一次无 token 请求，其 `10041` 会打到全局失效回调（`Bearer null` 同理：`sync-service.ts:442-446`）。

**最小判伪**：给每个请求记录 `Authorization` 快照；若「失败请求 token ≠ 当前 store token」仍触发清理 ⇒ 成立。
**修法方向**：失效处置加前置判据（**失败请求的 token === 当前 token** 才允许清）；三套口径收敛为一处。

---

### P2-6 契约违规：`sign-in` 成功未 `revokeOfflineEntry()`（C-25）

**证据**：`apps/web/src/components/auth/sign-in-page.vue:22-37` 只做 `resetAuthExpiredLatch()` + 深链导航，**没有** `revokeOfflineEntry()`；而 `apps/web/src/components/auth/check-in-page.vue:22` 有；契约写在 `apps/web/src/views/auth/offline-entry.ts:10-22`（「登录/检入成功…必须清」）。后果：守卫走离线分支（`routes.ts:63-81`）、只读闸门残留（登录后写被拦）。**不产生「停在登录页」**，但与本次症状同页同路径，顺手登记。
**最小判伪**：先「离线进入」再登录，若写操作仍被只读拦截 ⇒ 成立。

---

## 四、PM 六个怀疑面逐条结论

| #   | 怀疑面                                     | 结论                                                                                                                                                                                                                                                                   | 依据                                                                                                                                                                                                                                        |
| :-- | :----------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 打包态 preload / `desktopAPI` 缺失         | **排除（且为反证）**：所有访问都经 `getDesktopBridge()` 空保护；**若桥缺失，续期器根本不启动 ⇒ 不会有登录瞬间轮换 ⇒ 反而不会出现本条症状**                                                                                                                             | `apps/desktop/src/preload/index.ts:13-30`（已暴露）、`apps/desktop/src/renderer/src/desktop-bridge.ts:40-43`、`use-desktop-session-renewal.ts:42-43`、asar 内含 `preload/index.js`（静态核验）                                              |
| 2   | 登录后路由落点 / 重试自循环                | **排除（落点合法、无自循环）**；但「守卫在 jwt=null 时送回 `/auth/signin`」是 P0 链的**末段**，不是原因                                                                                                                                                                | `apps/web/src/safe-navigation.ts:33-40`（`/auth*` 拒绝 + 清键）、`apps/web/src/router.ts:30-38`（`afterEach` 不写 `/auth`）、`views/auth/routes.ts:37-52`（`/`不携带 `redirect`）、`safe-navigation.ts:99-101`（`duplicated` 静默，不重试） |
| 3   | 离线门 / 同步门挡在壳外                    | **排除**：登录页本身在壳内（`gatePassed=true` 之后才挂 `App`），`InitialSyncGate` 此时已卸载；唯一残留是 P2-6（离线分支只影响只读/守卫分支优先级，不阻断）                                                                                                             | `apps/desktop/src/renderer/src/AppRoot.vue:170-186`（模板四态）、`routes.ts:63-81`                                                                                                                                                          |
| 4   | `isAuthenticated` 与 token 来源分裂        | **冷启动确有**：store 初值 `isAuthenticated:false` + token 来自 localStorage ⇒ 守卫判「JWT 在而未认证」→ `/auth/checkin`（设计行为）；**登录后不分叉**（先置 flag 再 set token）。但「半清状态」真实存在：`clearAuthData()` 只改 store，`USER_JWT` 由 watch 微任务删除 | `packages/presentation-identity/src/stores/user-store.ts:17`、`:56-60`、`:69-84`（watch 删键）、`usecase.ts:45-46`（登录写入顺序）、`routes.ts:86-98`                                                                                       |
| 5   | 登录页自身（chunk / asar / CSP / 加载）    | **排除**：116 个产物文件、**0** 条悬空相对引用；asar 内主 chunk 与 preload 齐全；CSP 生产策略含 `connect-src https://todobe.nathanao.space` 与产物 API 一致                                                                                                            | `apps/desktop/out/renderer/**` 静态扫描（0 missing）、`apps/desktop/electron.vite.config.ts:80-141`、`apps/desktop/src/renderer/index.html:5-8`、`apps/desktop/.env.production`                                                             |
| 6   | 新增：并发检入 `10022` / 双发/陈旧 `10041` | **成立，且为首选**（P0-1/2/3/5）；`qa-T556` 的服务端实测 `10022` 正好落在 P0-1 的入口                                                                                                                                                                                  | §三 P0-1…P1-5                                                                                                                                                                                                                               |

---

## 五、已排除 / 不再推的链（避免重复劳动）

1. 五项修复自身的落点：`recordCheckInAttempt` 确实在 `setUserToken` **之前**（`usecase.ts:39-46`）、宽限确为窗口级且窗外仍登出（`auth-rotation.ts:20-44`）、闩确被复位（`axios.ts:16-29` + `sign-in-page.vue:25`）、watch 条件确为 `authed && token`（`use-desktop-session-renewal.ts:64-71` + `AppRoot.vue:90-92`）、`NavigationFailure` 确被检查（`safe-navigation.ts:130-144`）。
2. 双 `vue-router` 实例（H6）：本产物单实例（`stats.html` 单条模块 id + 单 chunk）。
3. 产物/构建完整性：无缺 chunk、无 asar 缺件、CSP 与 API 源一致。
4. `LAST_VISITED_ROUTE` 指回 `/auth/*`：不可能（写入侧过滤 + 读取侧拒绝并清键）。
5. 「离线进入 / 同步门」把用户挡在登录页：门在登录页之前就已通过并卸载。
6. `desktopAPI` 缺失导致渲染中断：无未保护调用；且缺桥会使续期器**不启动**（与症状方向相反）。

---

## 六、给 qa 的取证指令包（实机 CDP；全部为运行时探针，不改源码）

**前置**：跑**打包产物**（`apps/desktop/release/linux-unpacked/nao-todo --no-sandbox --remote-debugging-port=9333`），用 `scripts/electron-smoke/lib/cdp.mjs` 的 `connectRenderer({ port: 9333 })` 附着（该库已封装 `Runtime.evaluate` / `Network.enable` / console 采集）。

### 断言 0（先做，一次性；排除「跑的不是这份产物」）

```js
document.querySelector('script[type=module]').src // 必须含 index-howcwX2T.js
typeof window.desktopAPI // 'object'
window.__NAO_ERROR_LOG__?.filter((e) => e.source.startsWith('router-injection')) // 期望 []
```

```bash
ps -eo pid,lstart,exe,cmd | grep -E "nao-todo" | grep -v grep   # 启动时间应晚于 22:18，exe 指向 linux-unpacked
```

⇒ 任一不符：**先关掉所有 nao-todo 进程**（含托盘常驻实例）再重跑；单实例锁会让新进程静默退出并聚焦旧窗口（`apps/desktop/src/main/single-instance.ts:37-45`）。

### 探针 1（判定 A 还是 B：导航是否发生）

```js
window.__H__ = []
addEventListener('hashchange', () => __H__.push([Date.now(), location.hash]))
```

点登录后等 8s，读 `__H__`。

### 探针 2（抓「第二路 checkin」的调用栈与被用 token —— 直判 P0-2）

```js
;(() => {
    const log = (window.__CK__ = [])
    const pick = (h) =>
        String(h || '')
            .replace(/^Bearer\s+/i, '')
            .slice(0, 12)
    const open = XMLHttpRequest.prototype.open,
        send = XMLHttpRequest.prototype.send
    XMLHttpRequest.prototype.open = function (m, u) {
        this.__m = m
        this.__u = u
        return open.apply(this, arguments)
    }
    XMLHttpRequest.prototype.send = function (b) {
        if (String(this.__u).includes('/auth/checkin')) {
            let auth = ''
            try {
                auth = pick(this.getRequestHeader && this.getRequestHeader('Authorization'))
            } catch {}
            if (!auth) {
                try {
                    auth = pick(JSON.parse(b || '{}').jwt)
                } catch {}
            }
            log.push({
                t: Date.now(),
                method: this.__m,
                url: String(this.__u),
                token: auth,
                stack: new Error().stack
            })
        }
        return send.apply(this, arguments)
    }
})()
```

判定：`__CK__.length` 应=1；若=2 —— **看 `stack`**：

- 含 `use-desktop-session-renewal` ⇒ P0-2(a)/(b)（`start()`/`trigger()` 走了 `attempt()`）；
- 含 `check-in.vue` 两次 ⇒ P0-2(c)（检入页二次挂载）；
- `token` 不同（第二个=第一个轮换后的值）⇒ 第二路发生在第一次**成功之后**（指向调度器/reload 后新实例，而非并发页面双挂）。

### 探针 3（网络层：谁先谁后、谁带旧 token、谁返回 10022/10041）

`Network.enable` + 收集，只保留 `auth/checkin`、`sync/pull`、`user/profile`、`user/config`；对每个响应取 body 的 `code`（HTTP 仍 200），记录 `(t, url, Authorization 前 12 字符, code)`。要断言的三件事：

1. `/auth/checkin` 是否**并发**（两次请求时间差 < 首次响应耗时）；
2. 任一次 checkin 是否 `code=10022`；
3. `sync/pull` 或 `user/*` 是否在轮换后仍带**旧 token** 并返回 `10041`（⇒ P0-3 / P1-4）。

### 探针 4（**最狠一条**：直接抓「谁删了 USER_JWT」）

```js
;(() => {
    const rm = Storage.prototype.removeItem,
        log = (window.__RM__ = [])
    Storage.prototype.removeItem = function (k) {
        if (String(k).toUpperCase().includes('USER_JWT'))
            log.push({ t: Date.now(), k, stack: new Error().stack })
        return rm.apply(this, arguments)
    }
    const si = Storage.prototype.setItem
    Storage.prototype.setItem = function (k, v) {
        if (String(k).toUpperCase().includes('USER_JWT'))
            log.push({ t: Date.now(), set: String(v).slice(0, 12) })
        return si.apply(this, arguments)
    }
})()
```

### 判读决策表

| 观测                                                                                | 定罪                                  |
| :---------------------------------------------------------------------------------- | :------------------------------------ |
| `__H__` 全程只有 `#/auth/signin` + `__NAO_ERROR_LOG__` 有 `auth:sign-in-navigation` | **A：导航失败**（P1-4 / 守卫抛错）    |
| `__H__` 有 `#/tasks` 后再回 `#/auth/signin`                                         | **B：被撤销** → 看 `__RM__` / 探针 3  |
| `__CK__` 两条 + 其中一条响应 `10022`                                                | **P0-1 成立**（分类器 + 非单飞）      |
| 两条 `__CK__` 并发（间距 < 首次响应耗时）                                           | **P0-1 成立**（必然一胜一败）         |
| `__RM__` 栈含 `AuthUseCase.checkIn`                                                 | P0-1（10022 清凭证）                  |
| `__RM__` 栈含 `sync-service` / `AppRoot` + 探针 3 见 pull 带旧 token 收 `10041`     | P0-3                                  |
| `__RM__` 栈含 `main.ts/app.ts onAuthExpired`，且失败请求 token ≠ 当前 token         | P1-4                                  |
| `__CK__` 第二条栈含 `use-desktop-session-renewal`                                   | P0-2(a)/(b)                           |
| `__CK__` 两条栈都含 `check-in.vue`                                                  | P0-2(c)                               |
| 出现 `session.expired` 系统通知                                                     | 续期侧凭证失败（`AppRoot.vue:93-97`） |

### 建议的**受控复现**（把「偶发」变「必现」，供修法回归用）

1. CDP 把**第二次** `/auth/checkin`（或 `sync/pull`）延迟 300ms ⇒ 若稳定出现「回到登录页」，P0-1/P0-3 定性完成。
2. 冷启动（有有效 JWT）连按两次 `Ctrl+R` 窗口重载 ⇒ 验证 P0-2(b)（`lastCheckInAt` 内存态丢失）；
3. 先「离线进入」再登录 ⇒ 验证 P2-6（写操作仍被只读拦截）。

---

## 七、需 PM 拍板

1. **`10022` 的契约归类**：客户端降级为「冲突-可重试」（+重试一次）即可闭环，不依赖服务端；是否需要同时提请服务端补「可重试」专用码（跨仓、P2）？
2. **单飞落在哪一层**：`AuthUseCase.checkIn`（域层，页面/调度器/未来入口全覆盖，推荐）vs 仅调度器内单飞（范围小但留洞）。
3. **失效处置收敛范围**：本轮是否只做「失败请求 token === 当前 token」前置判据 + sync 共用宽限（P0-3/P1-4 的最小闭环），还是借此把三套清理口径一次性收敛（范围上一个量级，建议独立小批）。
4. **桌面数据面启动点**：是否接受把桌面侧的 `startWebDataPlane` 从 `router.afterEach` 后移到「门通过/壳挂载后」（两端同源代码，需明确 Web 零行为变化口径）。
5. 归档：本报告是否并入 `docs/reports/T551-…` 家族并回写 `DEF-87`（「部分修复」→ 追加未修半：`10022` 分类 + 双发来源未定位）、新登记 `DEF-97`（`10022` fail-closed）、`DEF-98`（sync 失效处置绕过宽限）。

---

## 八、限制与口径

- **无实机**：本节全部为静态读码 + 产物静态核验；三条 P0 均需 §六 探针实证后方可定罪（P0-1 的服务端半边已由 `qa-T556` 实测确认）。
- **grep 口径**：`pi-codegraph` 未安装，`checkin` 发起点的穷尽清点来自 `grep "\.checkIn("`（命中：续期端口、`check-in.vue`、域/仓储定义；`presentation-react` 属移动端红线，未纳范围）⇒ 若存在动态装载入口（`import.meta.glob` 类），本清点可能漏项。
- **产物核验命令**（可复核）：asar header 读取 `scripts`（node `readUInt32LE(12)`）+ `out/renderer` 相对引用全量扫描（116 文件 / 0 missing）+ `stats.html` 模块 id 去重（`vue-router@5.2.0` ×1）。
- **未跑门禁**：本轮零代码改动（只读），未跑 `vp check` / `vp test`；本报告为新增文档，未提交。