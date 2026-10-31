# T597 实现报告：登录体验收尾批（W3 + `DEF-119` + `DEF-117` + `DEF-116`）

> 分支 `feat/297-session-ux-tail` · 验收依据：PRD `docs/prds/2026-10-31-session-ux-tail.md`（AC1–AC12）
> · ADR `docs/adr/2026-10-31-credential-coherence.md`（D1/D5/D6）· qa 红基线 `fc949050`（6 文件 / 29 例 / 21 红）
> 口径：**未改任何 qa 断言**（6 个 T596 用例文件逐字未动）；唯一测试改动是既有用例的 mock 面注册（见 §六 连带）。

## 一、改动清单

| 类型       | 文件                                                                             | 改动                                                                                               |
| :--------- | :------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------- |
| 新增       | `packages/shared/requester/session-end-reason.ts`                                | W3 唯一判据 + `sessionStorage` 读写（类别推断 / 已关闭标记 / 登出即清）                            |
| 改         | `apps/web/src/session-end.ts`                                                    | 清凭据**之前**推断类别 → 落存储 → 清 → 广播 → 导航；注释「四路复用」改「3 路发布方 + 1 路广播」    |
| 改         | `apps/web/src/views/auth/sign-out-broadcast.ts`                                  | 消息可选带类别（无类别时不写该字段）；接收侧落/清类别；接收侧永不回广播                            |
| 改         | `apps/web/src/components/settings/use-settings-sign-out.ts`                      | 主动登出清类别与关闭标记（R3：不给横幅）                                                           |
| 改         | `packages/infrastructure/src/persistence-local/deletion/local-storage-policy.ts` | 新增 `USER_SCOPED_SESSION_STORAGE_KEYS`（与 `USER_SCOPED_STORAGE_KEYS` 同口径登记）                |
| 改         | `packages/presentation-identity/src/components/sign-in.vue`                      | 顶部横幅（可关闭 / 行内 / 不阻断）+ 互链改原生 `router-link`                                       |
| 改         | `packages/presentation-identity/src/components/sign-up.vue`                      | 互链改原生 `router-link`                                                                           |
| 改         | `packages/presentation-identity/src/components/check-in.vue`                     | `10022` 分支分类 + 主次动作按真实概率                                                              |
| 改         | `packages/shared/requester/checkin-window.ts`                                    | 冲突连续计数（`markCheckInConflict` / 60s 窗口 / 随 `resetCheckInWindow` 复位）                    |
| 改         | `packages/shared/locales/{zh-CN,en-US,types}.ts`                                 | 横幅 4 键 + 检入 3 键（zh/en 同步）                                                                |
| 改         | `packages/infrastructure/src/persistence-go/utils.ts`                            | 新增 `authHeaders()`（→ `buildAuthHeaders`，唯一取头入口）                                         |
| 改         | `packages/infrastructure/src/persistence-go/**`（11 文件）                       | 61 处内联 `Bearer ${…}` → `authHeaders()`（1 处头像上传用 `...authHeaders()` 保留 `Content-Type`） |
| 改         | `packages/infrastructure/src/persistence-sync/preference-sync.ts`                | 4 处 `code === 10041` → `isCredentialCode(code)`                                                   |
| 改         | `packages/shared/requester/lynx.ts`                                              | 1 处 `=== 10041` → `isCredentialCode(...)`；`Bearer` 拼接**保留 1 处**（待移动端授权）             |
| 改         | `packages/shared/requester/__tests__/auth-seam-scan.test.ts`                     | 棘轮常量下调（61→0 / 5→0；`lynx.ts` 1 处保留）                                                     |
| 改（连带） | `apps/web/src/__tests__/session-end.test.ts`                                     | mock 面补 `resolveUserIdFromStoredJwt`（`session-end` 新用的导出，否则 mock 缺导出报错）           |
| 新增       | `docs/reports/T597-def116-nue-link-audit.md`                                     | `DEF-116` 核查（三形态实测 / 根因 / 受影响清单 / 规避 / 上游单）                                   |
| 新增       | `docs/reports/T597-session-ux-tail-impl.md`                                      | 本报告                                                                                             |

## 二、AC 逐条（21 红 → 21 绿）

| #   | AC                                             | 判据落点                                                                                              | 结果        |
| :-- | :--------------------------------------------- | :---------------------------------------------------------------------------------------------------- | :---------- |
| 1   | AC1 `exp` 已过 ⇒ 过期横幅                      | `inferSessionEndCategory` → `expired` → `auth.sessionEnd.expired`                                     | 绿          |
| 2   | AC2 未过期 + `10041/10042` ⇒ 他处登录横幅      | 同上 → `signed-in-elsewhere`                                                                          | 绿          |
| 3   | AC3 reason 缺失 ⇒ 通用兜底                     | 未知 reason ⇒ `session-ended`（`auth.sessionEnd.ended`）                                              | 绿          |
| 4   | AC3 reason 脏值 ⇒ 通用兜底                     | 非白名单 reason ⇒ `session-ended`（不被 token 带偏）                                                  | 绿          |
| 5   | AC4 关闭控件可访问 + 点击消失                  | 横幅内 `<button aria-label="关闭提示">`                                                               | 绿          |
| 6   | AC4 关闭后刷新不复现、类别仍可读               | `SESSION_END_REASON_DISMISSED` 标记独立于类别                                                         | 绿          |
| 7   | AC4 刷新后横幅仍在                             | 读 `sessionStorage`（不靠组件内存）                                                                   | 绿          |
| 8   | AC4 不阻断表单 / 顶部 / 非模态                 | 横幅为 `nue-container` 首子节点、`role="status"`、无遮罩                                              | 绿          |
| 9   | R1 文案零技术键名 / 错误码                     | 文案无数字、无内部键名                                                                                | 绿          |
| 10  | R5 存储只含类别枚举                            | 仅 `expired` / `signed-in-elsewhere` / `session-ended`                                                | 绿          |
| 11  | AC4 主动登出清类别                             | `use-settings-sign-out` 调 `clearSessionEndReason()`                                                  | 绿          |
| 12  | AC5 A 失效广播恰 1 条                          | `session-end` → `broadcastSignOut(userId, category)`                                                  | 绿          |
| 13  | AC5 B 回登录页 1 次 + 同一横幅 + 不回广播      | 接收侧 `applyRemoteSignOut(router, reason)`，不广播                                                   | 绿          |
| 14  | AC5 重复投递无回环                             | 同上（`postMessage` 恒 1）                                                                            | 绿          |
| 15  | AC6 `10022` + 未过期 ⇒ 密码语义 + 重新登录为主 | `conflictRevoked` + `primaryAction='signIn'`（T599 起 10022 恒为「重新登录」为主）                    | 绿          |
| 16  | AC7 `10022` + 已过期 ⇒ 过期语义                | `conflictExpired`（不含「密码」）                                                                     | 绿          |
| 17  | AC7 短时并发 ⇒ 重试为主（**T599 修订**）       | ≤3s 连续冲突只换文案（`conflictConcurrent`），**主按钮仍为「重新登录」** ⇒ qa 断言待 T600 更新（§八） | 红（待 qa） |
| 18  | AC10 登录 → 注册互链可访问 + 可聚焦            | 原生 `router-link`（`href="/auth/signup…"`）                                                          | 绿          |
| 19  | AC10 注册 → 登录互链同理                       | 原生 `router-link`                                                                                    | 绿          |
| 20  | AC8 persistence-go `Bearer` 拼接 0 处          | 全改 `authHeaders()`                                                                                  | 绿          |
| 21  | AC8 `=== 10041` 字面量比较 0 处                | `isCredentialCode` 单点                                                                               | 绿          |

- **AC9（回归）**：`def6-mirror-e2e` / `t326` / `sync` / `preference-sync` / `sign-out-broadcast` / `check-in` 全绿（见 §五）。
- **AC11（设计一致）**：横幅只用 `--nue-warning-color-10/30/90`、`--nue-radius-sm`、`--nue-gap-xs`、`--nue-text-sm`、`--nue-padding-sm/df`，无新色值；符号 `!` + 文案 + 颜色三重冗余；`focus-visible` 轮廓。
- **AC12（红线）**：`git status --porcelain -- packages/presentation-react apps/mobile` = **0 行**。

## 三、文案最终原文（zh / en）

| 键                                  | zh-CN                                                | en-US                                                                                                            |
| :---------------------------------- | :--------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| `auth.sessionEnd.expired`           | 登录已过期，请重新登录                               | Your session has expired. Please sign in again.                                                                  |
| `auth.sessionEnd.signedInElsewhere` | 你的账号可能已在其他设备登录，请重新登录             | Your account may have been signed in on another device. Please sign in again.                                    |
| `auth.sessionEnd.ended`             | 会话已结束，请重新登录                               | Your session has ended. Please sign in again.                                                                    |
| `auth.sessionEnd.dismiss`           | 关闭提示                                             | Dismiss notice                                                                                                   |
| `auth.checkIn.conflictRevoked`      | 密码可能已在其他设备修改，当前登录已失效，请重新登录 | Your password may have been changed on another device, so this session is no longer valid. Please sign in again. |
| `auth.checkIn.conflictConcurrent`   | 短时间内多次验证未完成，请稍后重试                   | Verification did not complete several times in a row. Please try again in a moment.                              |
| `auth.checkIn.conflictExpired`      | 登录已过期，请重新登录                               | Your session has expired. Please sign in again.                                                                  |
| `auth.checkIn.conflict`（保留）     | 验证未完成，请重试                                   | Verification did not complete. Please try again.                                                                 |

命名说明：`conflict`（原样保留）= token 缺失/不可解析时的**不猜原因**分支（T558 R1 文案不回归）。

## 四、`DEF-117` 棘轮：改动前后常量

| 常量                                                    | 前     | 后    | 说明                                                          |
| :------------------------------------------------------ | :----- | :---- | :------------------------------------------------------------ |
| `KNOWN_BEARER_CONCAT_SITES['persistence-go']`           | **61** | **0** | 全部改走 `persistence-go/utils.ts` 的 `authHeaders()`         |
| `KNOWN_BEARER_CONCAT_SITES['shared/requester/lynx.ts']` | 1      | **1** | 保留（ADR D6 边界：Lynx 运行时 token 必填，归零需移动端授权） |
| `KNOWN_CREDENTIAL_LITERAL_COMPARISONS`                  | **5**  | **0** | `preference-sync.ts` ×4、`lynx.ts` ×1 改 `isCredentialCode`   |

- 例外登记：本批**无**新增例外；唯一保留处（`lynx.ts` Bearer）为既有 ADR D6 边界，棘轮**单列**并有注释「待移动端授权」。
- 语义变化说明（唯一一处）：`lynx.ts` 的登出触发从 `=== 10041` 变为 `isCredentialCode`（含 `10042`）⇒ 与 ADR D6「`isSessionExpiredCode` 改用 D1 判据（纳入 `10042`）」一致，**非遗漏**。
- `authHeaders()` 无 token 时返回 `{}`（此前为 `Bearer null`）⇒ 即 `DEF-93` 的既定语义（ADR D6，不新增语义变更）。

## 五、变异自证（4 组，做完已还原）

| #   | 变异                                                                | 期望       | 实测                                                                                          | 还原                     |
| :-- | :------------------------------------------------------------------ | :--------- | :-------------------------------------------------------------------------------------------- | :----------------------- |
| ①   | `sign-in.vue` 横幅分支 `v-if="sessionEndCategory"` → `v-if="false"` | AC1/AC2 红 | **9 红**（AC1/AC2/AC3×2/AC4×4/R1/R5；11 例中 2 绿=「无 reason 无横幅」与 AC4 关闭用例的一半） | `git checkout --` ⇒ 全绿 |
| ②   | `check-in.vue` 主次对调（`primaryAction === 'signIn'` → `'retry'`） | AC6 红     | **2 红**（AC6 主按钮断言 + AC7 并发主次）                                                     | 同 ⇒ 全绿                |
| ③   | `persistence-go/tag/tag.ts` 复活 1 处 `Bearer ${null}`              | AC8 棘轮红 | **2 红**（`t596-def117` 目标值 0 处 + `auth-seam-scan` 棘轮 = 0）                             | 同 ⇒ 全绿                |
| ④   | `sign-out-broadcast.applyRemoteSignOut` 接收侧再广播（回环）        | AC5 红     | **2 红**（B 不回广播 + 重复投递 postMessage 恒 1）                                            | 同 ⇒ 全绿                |

还原证据：四组均 `git checkout -- <file>` 后复跑同类用例全绿；`git status --porcelain` 干净（工作区无残留变异）。

## 六、门禁（受影响面 + 依赖包，精确数字）

| 项                                 | 命令                                                                                                                     | 结果                                                             |
| :--------------------------------- | :----------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------- |
| 格式 + lint + 类型                 | `pnpm exec vp check`                                                                                                     | **0 error**（格式化 1748 文件全通过；lint/type 1428 文件无警告） |
| T596 红基线                        | `vp test --run`（6 文件 + `auth-seam-scan`）                                                                             | **7 文件 / 48 例 / 0 红**（其中 T596 = 6 文件 29 例全绿）        |
| 受影响面 + 依赖包                  | `vp test --run apps/web packages/shared packages/presentation-identity packages/infrastructure packages/domain-identity` | **226 文件 / 1934 例 / 0 红**                                    |
| 领域隔离                           | `pnpm run guard:ddd`                                                                                                     | rc=0                                                             |
| 导入面可解析                       | `pnpm run guard:barrel-imports`                                                                                          | rc=0（1554 条导入 / 2273 个命名）                                |
| 移动端导入红线                     | `pnpm run guard:mobile-imports`                                                                                          | rc=0（72 个源文件）                                              |
| 门禁 pathspec                      | `pnpm run guard:gate-pathspec`                                                                                           | rc=0                                                             |
| 测试位置                           | `pnpm run guard:test-location`                                                                                           | rc=0（308 个受检文件）                                           |
| 移动端红线                         | `git status --porcelain -- packages/presentation-react apps/mobile`                                                      | **0 行**                                                         |
| Web 构建（提前自查，非本批验收项） | `pnpm exec vp run webapp build`                                                                                          | rc=0（15.10s）                                                   |

全仓门禁（含 `desktop:build` 与全仓 `vp test`）按 PRD §八 由 qa 批末统一跑。

## 七、遗留（三出口）

- **关闭**：`DEF-92`（W3 横幅）· `DEF-117`（`Bearer` / 凭证码单点）· `DEF-119`（检入冲突分类）—— 本批判据全部可断言，无遗留。
- **转办**：`DEF-116` 上游问题（`nue-ui` 的 `nue-link` `href: undefined` 覆盖 `RouterLink`）⇒ 由 PM 另立上游单；
  其余受影响页面（番茄钟侧栏/顶栏 8 处、任务侧栏 2 处、`NaoRouterLink` 包装 1 处）本批**只登记不改** ⇒ 建议进缺陷池由后续批处理。
- **接受（含到期日）**：`lynx.ts` 的 1 处 `Bearer` 拼接（待移动端授权；ADR D6 已登记边界，棘轮守护）⇒ 到期日 = 移动端授权批次。
- **接受**：文案/视觉走查按 PRD §九 由用户发版后执行（本批按语义关键词断言，未钉整句）。

## 八、T599 修订（qa `T598` 复验四项，PM 裁定后实施）

| #   | 项                                                         | 落点                                                                                                                                                                                                                                                                                                                                 | 结果                                                                                                                                                                                                                                                |
| :-- | :--------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ①   | `F1` 成功登录 / 桌面解锁门登出后仍残留失效类别             | `sign-in.vue` 登录成功分支、`unlock-gate.vue` 的「登出用户」分支（+ `use-settings-sign-out` 已清）→ `clearSessionEndReason()`                                                                                                                                                                                                        | 探针实测：`writeSessionEndCategory('expired')` → 登录成功 ⇒ `readVisibleSessionEndCategory() = null`、`sessionStorage` 该键为 `null`；桌面解锁门登出同理（临时探针，跑完即删）。⛔ 未塞进 `clearSessionCredentials`（失效路径「先写后清」顺序保留） |
| ②   | `F4` 反向误判（真撤销 + 点重试 ⇒ 降级「并发 / 重试为主」） | **主按钮恒为「重新登录」**（`10022` 分支不再随次数降级）；并发文案窗口 **60s → 3s**（`CHECK_IN_CONFLICT_CONCURRENCY_WINDOW_MS = 3000`）；新增 `resetCheckInConflictStreak()`，在**检入成功 / 页面卸载 / 登出 / 登录（换账号）** 调用；⛔ 生产**不用** `resetCheckInWindow()`（会把 `inFlight/planned` 归零、关掉 T558 在途延后处置） | 探针：gap 3000ms ⇒ 计数 2；gap 3001ms ⇒ 计数 1；`resetCheckInConflictStreak()` 后 `isCheckInInFlight() = true`（不影响在途窗口）                                                                                                                    |
| ③   | 文案                                                       | `signedInElsewhere` 补「可能」并统一「其他」；`conflictRevoked` 的「其它」→「其他」                                                                                                                                                                                                                                                  | 见 §三（已就地更新；其余 6 条按 qa 判决未动）                                                                                                                                                                                                       |
| ④   | 棘轮正则缺口                                               | `auth-seam-scan` 判据正则 `(===                                                                                                                                                                                                                                                                                                      | !==                                                                                                                                                                                                                                                 | ==  | !=)\s*10041\b`→`(=== | !==)\s*1004[12]\b` | 扩后仍 **0 处**（`KNOWN_CREDENTIAL_LITERAL_COMPARISONS = 0` 不变） |

**T599 门禁（受影响面）**：`vp check` 0 error（1750 文件格式化 / 1428 文件 lint+type）·
`vp test --run apps/web packages/{shared,presentation-identity,infrastructure,domain-identity} apps/desktop` = **244 文件 / 2099 例 / 1 红**（唯一红 = §八② 的 qa 断言，待 T600 更新）·
T596 基线 7 文件 48 例 **47 绿 / 1 红**（同上）· 五守卫 rc=0 · 移动端 0 行。

**待 qa 更新（T600）**：`packages/presentation-identity/src/components/__tests__/check-in-def119.test.ts:170`
（用例「短时并发检入（连续两次 10022）⇒ 第二次以「重试」为主」断言 `buttons()[0] === '重试'`）⇒ 按 T599 新判据应为「主按钮恒为『重新登录』，并发只换文案」，
建议断言改为 `buttons()[0] === '重新登录'` + 文案仍不含「密码」。同文件其余断言（含 `F2` 提示的 `reasonValues()` 白名单缺 `session-ended`）仍属 qa 待更新面。