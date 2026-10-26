# T551 · 登录注册 + 用户凭证管理 —— 只读审计

> 范围：登录 / 注册 / check-in / 登出 / 深链 `query.redirect` / 错误分流 / 登录后导航；JWT 48h 与 7 天绝对期、`checkIn` 轮换、10s 宽限、`nao.deviceId`（K10）、本地凭证清理判据、桌面续期调度、Web 零行为变化。
> 形态：**只读审计**（未改代码 / 未改测试 / 未动分支；移动端仅读）。P0 判断已按 PM 要求**先行单独即报**（intercom）。
> 证据口径：`文件:行` 静态读码 + 定向测试（见 §七）；**未做真机 / 未跑全仓门禁**（无代码改动）。P0 根因结论标注为「高概率候选」，须热修后实证。
> 对齐文档：`docs/reports/T543-arch-review.md`（§五 5.3 / §七 R2）· `docs/prds/2026-10-25-desktop-tray-autostart.md`（AC6/AC8/RV10）· ADR `2026-09-23-web-offline-local-first-and-security-posture.md`（C-52/C-53/r11）· `docs/reports/defect-pool.md`。

## 一、结论摘要

1. **凭证失效不存在「唯一判据」**：客户端有 **5 处**判断、方向两套（fail-closed / fail-soft）、清理动作 3 套；服务端把「解析失败 / JWT 过期 / 会话不存在 / 已轮换 / 被顶号」压成同一个 `10041`，客户端只能靠时窗猜。
2. **P0 高概率根因（DEF-85）**：登录成功后续期调度器**立即** checkin 轮换 token，而登录导航 / 数据面正用旧 token 并行发请求 ⇒ 多个 `10041`；10s 宽限**只护一次** ⇒ 第 2 个 `10041` 触发 `clearAuthData()` + `replace('/auth/signin')` ⇒「登录成功提示已出、界面仍在登录页」。证据链见 §三。
3. **`safeReplace` 不是根因，但把任何失败变成完全静默**，且问题比 PM 线索更大：vue-router 4 在守卫中止 / 重定向时**返回（resolve）一个 `NavigationFailure`、不 reject**，现实现连返回值都不看 ⇒ 异常路径与中止路径**双静默**。
4. **冷启动存在同族缺陷**：调度器只看「有 token」即启动（`isAuthenticated` 仍为 false 时），与 `/auth/checkin` 页检入形成**双 checkin**；并发时服务端 CAS 的败者返回 `10022` ⇒ 被 fail-closed 判为凭证类 ⇒ 清凭证。此为 `DEF-45`（刷新回登录）的可疑机制，建议重新打开观察。
5. **清理口径分叉**：axios 的 `10041` 回调只清 store（不 `localSession.clear()` / 不 `cryptoService.lock()` / 不清离线授权），而 `AppRoot` 的同步失效回调清全套 ⇒ 同一次失效因「谁先发现」而结果不同。
6. **自愈闭环有洞**：`authExpiredFired` 永久不复位 ⇒ 假失效踢出后，同一页面生命周期内的**真实失效不再登出**。
7. **7 天绝对期与 AC6 自洽**（AC6 只承诺 48h；12h 续期覆盖 JWT 48h）；但 AC8「到期可见提示」只覆盖续期路径，普通请求先撞 `10041` 时是**静默登出**。

## 二、现状图谱

| 面              | 实现（单一真源优先）                                                                              | 备注                                                                                 |
| :-------------- | :------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------- |
| 认证用例        | `packages/domain-identity/.../auth-service/usecase.ts`                                            | signIn/signUp/checkIn/signOut；checkIn 失败按 `isCredentialError` 清认证             |
| 凭证分类        | `.../auth-service/error-classification.ts:14/62/102`                                              | 网络白名单（fail-closed）+ 读路径结构信号（fail-soft，方向相反）                     |
| 服务端契约      | `nao-todo-server`：`jwtValidator.go:37`、`appImpl.go:120/204`、`sessionRepoImpl.go:278`           | JWT 48h；会话 `expired_at=now+7d`；checkin 只换 token；失败码 `10041/10042/10022`    |
| 请求器          | `packages/shared/requester/axios.ts:45-67` + `auth-rotation.ts:20-44`                             | `10041` → 登出回调；10s 宽限、**单次消费**                                           |
| 登录页 / 检入页 | `apps/web/src/components/auth/{sign-in,check-in}-page.vue`                                        | `query.redirect` > `LAST_VISITED_ROUTE` > `/tasks`；成功导航走 `safeReplaceDeepLink` |
| 导航封装        | `apps/web/src/safe-navigation.ts:94-126`                                                          | `safeReplace` 吞异常、不看 `NavigationFailure`                                       |
| 路由守卫        | `apps/web/src/router.ts:18/29` + `views/auth/routes.ts:57`                                        | section 上次路由重定向；auth 三分支 + `bootstrapLocalData` + `restoreMirrorStatus`   |
| 桌面装配        | `apps/desktop/.../usecases/binding.ts:101-137`                                                    | signIn 后本地解锁 / 明文迁移；checkIn 记录发起时刻 + `markTokenRotated`              |
| 桌面续期        | `apps/desktop/.../hooks/use-desktop-session-renewal.ts:58-67` + `packages/shared/session-renewal` | 12h±10% / 退避 / `isIdle = !syncing`；**watch token 即启动**                         |
| 清理判据        | `presentation-identity/stores/user-store.ts:56-84`、`local-storage-policy.ts`                     | 键级清除；K10 白名单含 `nao.deviceId`；补清保留当前凭据（DEF-34）                    |
| 失效处置        | `apps/desktop/.../main.ts:18`、`apps/web/src/app.ts:22`、`AppRoot.vue:76-95`                      | axios 回调 vs 同步回调**两套清理**                                                   |

登录到进入应用的主链（桌面）：`signIn(HTTP)` → `setUserToken`（watch 落 localStorage）→ 本地解锁（PBKDF2 600k）→ 明文迁移（失败吞）→ `NueMessage.success` → `safeReplaceDeepLink` → `router.beforeEach`（section）→ `authBeforeEnter`（本地收敛 + 镜像状态）→ index 挂载 → `loadUserProfile/loadUserConfig` → 数据面 `syncService.start()`。

## 三、必答问题

### Q1 凭证失效的唯一判据是什么？有几处实现？是否存在自伤 / 无法自愈路径？

**结论：无唯一判据。**5 处实现、3 套动作：

| #   | 判据                                               | 位置                                          | 方向                      | 动作                                    |
| :-- | :------------------------------------------------- | :-------------------------------------------- | :------------------------ | :-------------------------------------- |
| 1   | `isCredentialError`（仅网络白名单豁免，其余=凭证） | `error-classification.ts:62`                  | fail-closed               | 清 store（checkin / 续期分类）          |
| 2   | `hasCredentialFailureSignal`（仅结构信号=凭证）    | `error-classification.ts:102`                 | **fail-soft（方向相反）** | 读路径回退门（`mirror-fallback.ts:64`） |
| 3   | axios 拦截器 `code===10041`                        | `axios.ts:59/67`                              | 单码                      | `onAuthExpired`（仅清 store）           |
| 4   | `syncService.isSessionExpiredCode`                 | `sync-service.ts:422`                         | 单码 `10041`              | `handleSessionExpired`（清全套）        |
| 5   | `InitialSyncGate` 的 `credentialFailure`           | `initial-sync-gate.vue` + `sync-retry.ts:104` | 同步运行结果              | 门/按钮语义                             |

自伤 / 无法自愈路径（均已确认代码存在）：

- **自伤登出**：轮换后旧 token 的**在途请求**收到 `10041`；宽限单次 ⇒ 第 2 个即登出（§三 P0 / DEF-86）。
- **冷启动双 checkin**：调度器以 token 存在即 `start()`，与 `/auth/checkin` 页面检入并发；服务端 CAS 败者 `10022` ⇒ fail-closed ⇒ 清凭证（DEF-87）。
- **被踢后无法自愈**：`authExpiredFired` 一旦置位永不复位（`axios.ts:45-50`），同页面生命周期内 axios 面的后续真实失效**不再登出**（DEF-89）。
- **清理不彻底**：axios 路径不 `localSession.clear()` / 不 `cryptoService.lock()`（`main.ts:18`、`app.ts:22`），桌面本地保险库保持解锁；与 `AppRoot.vue:76` 口径分叉（DEF-90）。
- **码面不全**：服务端还有 `10042`（`jwtValidator.go:44`），但 axios 拦截器只认 `10041`、`hasCredentialFailureSignal` 也不含 `10042` ⇒ 读路径不触发登出、只报错（归入 DEF-90）。
- **空 token**：`sync-service.ts:442` 无 JWT 时拼出 `Bearer null`，后台同步仍会打服务端并收 `10041`（DEF-93）。

### Q2 登录成功到「进入应用」之间有多少 await / 守卫 / 静默失败点？

| 阶段                                                                                                         | await / 守卫       | 失败可见性                                               |
| :----------------------------------------------------------------------------------------------------------- | :----------------- | :------------------------------------------------------- |
| 1 `POST /auth/signin`                                                                                        | 网络               | 可见（表单错误）                                         |
| 2 `setUserToken` → watch 写 localStorage                                                                     | 微任务（顺序依赖） | 不可见（若顺序变化会命中步骤 3）                         |
| 3 `resolveUserIdFromStoredJwt()`                                                                             | 本地               | 可见（文案误导：「本地数据解锁失败」）                   |
| 4 `cryptoService.ensureUnlocked`（PBKDF2 600k + IDB）                                                        | **是**             | 可见但**误诊为密码错**（DEF-91）                         |
| 5 `runPlaintextMigration`                                                                                    | **是**             | **静默**（仅 console）                                   |
| 6 `NueMessage.success` + emit                                                                                | —                  | 用户可见的最后一个成功信号                               |
| 7 `safeReplaceDeepLink` → `router.resolve` + `router.replace`                                                | **是**             | **静默**（异常 + `NavigationFailure` 都不看，DEF-88）    |
| 8 `router.beforeEach`（section 重定向）                                                                      | 守卫               | 静默（可能改写深链落点，非缺陷）                         |
| 9 `authBeforeEnter` → `bootstrapLocalData` + `restoreMirrorStatus`                                           | **2 个 await**     | **静默**（抛错=导航中止=仍停在登录页）                   |
| 10 index 挂载 → `Promise.all(loadUserProfile, loadUserConfig)`                                               | **是**             | 仅结束 loading；**无错误提示**（10041 还会触发全局登出） |
| 11 数据面 `syncService.start()` + `pullAndMergeUserConfig`（`app.ts:41` / `data-plane.ts:100/107`）          | 后台               | 静默（10041 → 同步失效回调）                             |
| 12 续期调度器 `watch(token)` → `scheduler.start()` → **立即 checkin**（`use-desktop-session-renewal.ts:63`） | 后台               | 静默（正是 P0 触发点）                                   |

**静默面结论**：成功提示之后仍有 **≥3 个 await + 2 个守卫 + 3 个后台任务**，其中 **5 类失败对用户不可见**。P0 属于「7/9/12 组合」。

### Q3 桌面端与 Web 端差异清单；桌面新增代码是否有无保护调用？

| 能力                   | Web           | 桌面                                        | 共享                                   |
| :--------------------- | :------------ | :------------------------------------------ | :------------------------------------- |
| 认证用例 / 分类 / 仓储 | ✅            | ✅（经 `decorateAuthUseCase` 叠加）         | 同一 AuthUseCase + `isCredentialError` |
| signIn 附加步骤        | 无            | 本地会话 + 密钥包解锁 + 明文迁移            | —                                      |
| checkIn 附加           | 无            | `recordCheckInAttempt` + `markTokenRotated` | 同一 hook                              |
| 续期调度               | **不启动**    | 12h±10% / 退避 / resume / online            | 纯调度器共享                           |
| 启动门                 | 无            | `bootstrap/unlock/initialSync` 三门         | `bootstrapLocalData` 共享              |
| 数据面                 | `app.ts` 启动 | **同 `app.ts` 也会启动**（复用 web 源码）   | `data-plane.ts`                        |
| 失效处置               | axios 回调    | axios 回调 **+** 同步回调（两套）           | —                                      |

无保护调用核对：`desktopAPI` / IPC 均经 `getDesktopBridge()` 空保护（`desktop-bridge.ts`、`use-desktop-session-renewal.ts:39`、`use-desktop-shell.ts` 全 null-safe）；`useDesktopShell()` 被 `index-view` 无条件调用但无副作用（不自动 `refresh`）。**风险集中在 2 处**：① `cryptoService`（WebCrypto / IndexedDB）在登录链硬 await，失败被归因为「密码错」；② `theme-store.ts:58` 的 `window.matchMedia` 无 `typeof` 守卫（Electron 有，非当前症状，P3）。

### Q4 7 天绝对期与「常驻不掉线」承诺是否自洽？

**自洽，但边界需写清**：JWT 48h，12h 续期留 4 倍余量 ⇒ AC6（≥48h）成立；服务端 `Create` 写 `now+7d`、`UpdateToken` 不动 `expired_at`（已读码确认）⇒ 7 天硬上限不可续成无限；RV10（关机/休眠 >48h 需重登）合理。**缺口**：AC8「到期可见提示」只在续期器发现凭证失败时发通知；若普通请求先撞 `10041`，`onAuthExpired` 直接静默登出（DEF-92）。

## 四、DEF-85（P0）专项判断

**结论：`safeReplace` 是放大器，不是根因。**根因候选 = **登录时点的 token 轮换竞态**：

1. `useDesktopSessionRenewal` 的 `watch(() => authToken(), { immediate: true })`（`:63`）在 `setUserToken` 后立刻 `scheduler.start()`。
2. 登录路径**从未** `recordCheckInAttempt()`（只有 `useCase.checkIn` 包装里记，`binding.ts:106`）⇒ `lastCheckInAt === null` ⇒ `start()` 走 `attempt()` **立即 checkin**（`session-renewal/index.ts` start 分支）。
3. 服务端 `CheckIn` CAS 换 token（`appImpl.go:153-157`），旧 token HTTP 路径立即失效（`Validate` 走 DB 查 token）。
4. 同一时刻，登录导航后的 `loadUserProfile` / `loadUserConfig`（`index-view.ts:234`）与数据面 pull（`data-plane.ts:100`）正用**旧 token** 发出 / 在途 ⇒ 多个 `10041`。
5. `consumeRotationGrace()` **只放行第一个**（`auth-rotation.ts:20/36`，`consumed=true`）⇒ 第二个 `10041` 调 `notifyAuthExpired` → `clearAuthData()` + `replace('/auth/signin')`（`main.ts:18` / `app.ts:22`）⇒ **登录页原地不动**（或极短闪回）。
6. 该路径**没有任何用户可见错误**；`safeReplace` 吞掉异常，且 `replace` 被守卫中止时只 resolve 一个 `NavigationFailure`（**不看返回值**）⇒ 现象就是「提示成功、页面不动」。

为什么 web 不坏：web 没有续期器、从不 `markTokenRotated`，也不在登录后主动轮换 token（冷启动 checkin 在进壳前完成）。

**正确修法（最小集，建议热修）**：

- ① 在 `AuthUseCase.signIn` 的**成功分支、`setUserToken` 之前** `recordCheckInAttempt()`（登录本身已换新 token，下一次 12h 后）——直接消除登录时点轮换。
  ⚠️ 记录点**不能**放在桌面装饰器 `await originalSignIn()` 之后：`setUserToken` 触发的 store watch 微任务会先于装饰器续体执行，`scheduler.start()` 的同步段已读到 `lastCheckInAt=null` 并发出 checkin；放晚等于没修。
- ② 宽限改为**窗口级**（同一次轮换 10s 内的所有 `10041` 都不触发登出；或对命中者用新 token 重试一次），不再「单次消费」。
- ③ 提供并调用 `resetAuthExpired()`，在 signIn / checkIn 成功后复位 `authExpiredFired`（恢复自愈）。
- ④ 调度器 `watch` 条件从「有 token」改为「`isAuthenticated && token`」——冷启动时页面检入先记录发起时刻，`start()` 命中 60s 复用窗，不再双 checkin（DEF-87）。
- ⑤ 登录成功导航失败必须**可见**（检查 `NavigationFailure`；失败时提示 + 一次回退/重试），并补回归断言。

**验证判据（热修后）**：全新 userData 登录 ⇒ 1) 成功后稳定进入 `/tasks`；2) 10 分钟内 token 只轮换 0 次（下一次在 12h 后）；3) 人为让 checkin 先完成（把 checkin 响应延时调到 0、数据面请求延时 300ms）仍不登出；4) 冷启动（有 JWT、`isAuthenticated=false`）只发生 **1 次** checkin；5) 守卫抛错时用户看到错误提示而非静默停留。

## 五、缺陷对账（已有 `DEF-*`）

| 编号      | 结论                       | 证据 / 说明                                                                              |
| :-------- | :------------------------- | :--------------------------------------------------------------------------------------- |
| DEF-5     | **仍为已修**               | 无 `localStorage.clear()`（生产码仅测试用）；网络类保留认证（`error-classification.ts`） |
| DEF-14    | **已交付**（跨仓）         | `nao-todo-server#57` / `504b917`；AC7 生产对账仍待用户                                   |
| DEF-15    | **已修，但引入新 P0 风险** | 12h 续期成立；登录 / 冷启动时点轮换竞态 = DEF-86/87（本审计新增）                        |
| DEF-18    | **仍存在（已裁定不修）**   | 移动端 `compose-auth-usecase.ts:69/80`：任何 checkIn 失败清认证；属红线，仅登记          |
| DEF-25    | **已修**                   | `auth-repo-impl/impl.ts:24-42` 透传 `code` + `businessCode`                              |
| DEF-33    | **仍为已修**               | fail-closed 判据在 `error-classification.ts:62`；`10022/10021/10041` 均按凭证类          |
| DEF-34    | **仍为已修**               | `resumePendingWipe` → `preserveActiveSessionCredentials: true`；无残留调用点             |
| DEF-45    | **未复现，但机制可疑**     | 冷启动双 checkin（DEF-87）可解释「刷新回登录」；建议重开观察而非销案                     |
| DEF-85    | **在制（P0）**             | 根因候选见 §四；热修建议 ①②③⑤ 为最小集                                                   |
| DEF-30/31 | 不在本范围                 | 同步 / 布局面，未核                                                                      |

## 六、新增缺陷建议（建议编号 DEF-86 起；⚠️ 本报告不改缺陷池，由 PM 回写）

| 建议号 | 级别   | 缺陷                                                                                                                  | 不修的后果                                                                             | 跨仓                          |
| :----- | :----- | :-------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------- | :---------------------------- |
| DEF-86 | **P0** | 登录时点立即 checkin 轮换 × 登录期请求风暴 × **单次**宽限 ⇒ 自伤登出（DEF-85 根因候选）                               | 桌面端登录后无法进入（当前事故）；任何续期时点都可能随机踢人                           | 否（可选服务端旧 token 宽限） |
| DEF-87 | **P0** | 冷启动「token 存在即启动续期」与 `/auth/checkin` 页面检入**双 checkin**；CAS 败者 `10022` 被 fail-closed 清凭证       | 刷新 / 重开桌面端随机回登录页（DEF-45 家族）                                           | 否                            |
| DEF-88 | P1     | `safeReplace` 静默：吞异常且**不检查 `NavigationFailure`**                                                            | 登录 / 检入 / 登出导航失败对用户完全不可见，只能靠控制台                               | 否                            |
| DEF-89 | P1     | `authExpiredFired` 永不复位（`axios.ts:45`）                                                                          | 一次假失效后，axios 面的真实失效不再登出 ⇒ 用户卡在「请求全失败但仍是登录态」          | 否                            |
| DEF-90 | P1     | 凭证失效清理口径分叉（axios 仅清 store；sync 清全套；checkin 不清本地保险库）+ `10042` 未纳入                         | 失效后本地保险库仍解锁；桌面「同源复用」承诺不成立；安全姿态不一致                     | 否                            |
| DEF-91 | P1     | 本地密钥包密码与账号密码脱钩：他设备改密后，桌面登录**远端成功、本地解锁失败** ⇒ 硬阻断，文案称「密码错」，无恢复出口 | 用户在任一设备改密后，其他桌面端可能永久无法登录（除手工清数据）                       | 否                            |
| DEF-92 | P2     | AC8「到期可见提示」只覆盖续期路径；普通请求先撞 `10041` 时静默登出                                                    | 7 天到期日用户被无提示踢出，与 PRD 承诺不符                                            | 否                            |
| DEF-93 | P2     | `sync-service.ts:442` 无 JWT 时发 `Bearer null`；后台同步不复用 axios 的 `authExpiredFired` 去重                      | 登出后仍持续打服务端收 `10041`，日志噪音 + 重复导航                                    | 否                            |
| DEF-94 | P2     | `initRequester` 双初始化（desktop `main.ts:14` + web `app.ts:18`）⇒ 两套 `authExpiredFired` / 回调实例                | 去重语义与清理动作取决于请求由哪个实例发出，难复现、难审计                             | 否                            |
| DEF-95 | P3     | 注册成功 `router.push('/auth/signin')` 丢弃 `query.redirect`；注册入口链接不带 redirect                               | 深链用户注册后被送回默认页，需再找一次                                                 | 否                            |
| DEF-96 | P3     | `getDeviceId` 的 localStorage 读写无 try/catch；`theme-store.ts:58` 的 `matchMedia` 无守卫                            | 隐私模式 / 配额异常时请求拦截器抛错（登录也会失败）；`matchMedia` 缺失时主题初始化抛错 | 否                            |

**修复顺序**：`DEF-86 + 87 + 88`（同一热修，`v1.13.1`）→ `DEF-89 + 90`（凭证口径收口，独立小批）→ `DEF-91`（本地保险库恢复出口，需产品文案）→ `DEF-92/93/94` → `DEF-95/96`。
**测试缺口（必须补）**：登录 → 调度器**不得**立即 checkin；宽限对同轮换的 **N 个** `10041` 均生效；冷启动只 1 次 checkin；`replace` 返回 `NavigationFailure` 时可见失败；`authExpiredFired` 在重登后复位。现有 `auth-rotation.test.ts` 把「单次消费」写成断言，修语义时必须同步改写。

## 七、证据与限制

- 定向测试：`NODE_OPTIONS=--no-experimental-webstorage pnpm exec vp test --run packages/shared/requester/__tests__/auth-rotation.test.ts packages/shared/session-renewal/__tests__/renewal-scheduler.test.ts apps/desktop/src/renderer/src/hooks/usecases/__tests__/binding.test.ts apps/web/src/views/auth/__tests__/deep-link-resume.test.ts packages/domain-identity/src/application/usecases/auth-service/__tests__/checkin-failure-split.test.ts` ⇒ **5 文件 / 52 例 / 0 红 / exit 0 / 2.71s**（仅验证现有语义，未覆盖上述缺口）。
- 读码面（约 30 文件）：`apps/web/src/{router.ts,safe-navigation.ts,app.ts,data-plane.ts,views/auth/**,components/auth/**}`、`apps/desktop/src/renderer/src/{AppRoot.vue,main.ts,hooks/**}`、`packages/{domain-identity,infrastructure,shared,presentation-identity}` 相关模块、跨仓 `nao-todo-server`（只读）。
- 限制：**无用户日志 / 无真机复现**；P0 根因是「代码机制 + 时序」推断，不是抓包实证；`docs` 所述 R2 风险此前因无 QA 账号**从未在登录路径验证**（`docs/qa/2026-10-25-t544-baseline.md` §阻塞）。按项目纪律未跑全仓门禁（只读、无代码改动）。

## 八、需 PM 拍板

1. **热修范围**：`DEF-86/87/88` 是否同批（推荐同批，三者共享登录导航面）；② 宽限语义改「窗口级」是否接受（会弱化「真实失效 10s 内不登出」的区分度）。
2. **`safeReplace` 修复取向**：A 仅加可见提示（最小）；B 提示 + 一次回退/重试（推荐，需定义回退目标）。
3. **`DEF-91` 恢复出口**：是否允许「重置本机本地缓存后继续登录」（当前明文姿态下风险低；若未来恢复密文需重新评估）。
4. **跨仓**：是否要求服务端为 `10041` 增加原因码（`rotated|expired|revoked|replaced`）或旧 token 宽限（ADR 备选 6）——这能把客户端的「时窗猜测」变成确定性判据；不改则 `DEF-86` 只能靠客户端收口。