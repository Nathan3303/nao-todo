# T588 验收判据（AC1–AC10 可测化）

- 状态：待 qa 采纳为用例骨架 · 更新：2026-10-31 · Owner：arch-designer
- 指针：决策 `docs/adr/2026-10-31-credential-coherence.md` · 评审 `docs/reports/T588-arch-review.md` · PRD `docs/prds/2026-10-31-credential-coherence.md`
- 用法：每条给「判据 / 落点 / 变异」；变异一律**临时改再还原**，不并入提交。

- **AC1 单一判据 + 唯一调用点**
    - 判据：分类表驱动（`10041`/`10042` ⇒ credential；`ERR_NETWORK`/`ECONNABORTED`/`50300`/`40800`/`42900`/`10051` ⇒ network；`10022`/未知/5xx ⇒ business）；`decideSessionEnd({source:'passive'})` 仅对 `{10041,10042}` 返回 logout；有效处理者恰 1 个（重复 fire N 次回调仍 1 次）；源码扫描：非测试码中 `localSession.clear(` / `cryptoService.lock(` / `revokeOfflineEntry(` 的文件 ∈ 白名单 `{session-end.ts, use-settings-sign-out.ts, sign-out-broadcast.ts, unlock-gate.vue, binding.ts}`。
    - 落点：`error-classification.test.ts` + 新增 `session-end.test.ts` + `auth-seam-scan.test.ts`（`readFileSync` 遍历，≈0.1s）。
    - 变异：axios 拦截器改回直接 `clearAuthData()` ⇒ 后两条红。
- **AC2 网络/业务不登出、不清数据**
    - 判据：六个网络码 + 业务码 `10020` 下 `onAuthExpired` 0 次、`localSession.clear`/`lock` 0 次；`isCredentialError` 方向**未被改**（未知 ⇒ 凭证，供 checkIn 用，C-67 不回归）。
    - 落点：`error-classification.test.ts` + 既有 `checkin-failure-split.test.ts`（须保持绿）。
    - 变异：把网络码加入凭证集 ⇒ 红。
- **AC3 清理矩阵一致（`DEF-90`）**
    - 判据：单次 `fireAuthExpiry('expired')` 后 `clearAuthData`=1 / `localSession.clear`=1 / `cryptoService.lock`=1 / `revokeOfflineEntry`=1 / `resetTokenRotation`=1 / `safeReplace`=1；`wipeUserData`=**0**、删 `key-bundle`=**0**、业务表写入=0。
    - 落点：`session-end.test.ts`（spy 计数表驱动）。
    - 变异：删 `lock()` ⇒ 红；塞 `wipeUserData` ⇒ 红；去掉闩 ⇒ 计数 3 ⇒ 红。
- **AC4 恢复出口可自助（`DEF-91`）**
    - 判据：① 已迁移库 + 失效 bundle + 新密码登录 ⇒ `signIn` 返回 `null`（不阻断）且 bundle 已重建（`unlock(newPwd)` 成功）；② 未迁移库 ⇒ 仍阻断**但**有「用旧密码解锁」入口，旧密码正确 ⇒ 进入且 `changePassword` 已重包；③ **两处**入口都断言（`binding.ts` 与 `unlock-gate.vue`）；④ 文案不含「密码错误」误导。
    - 落点：`binding.test.ts` + `unlock-gate.test.ts`（`fake-indexeddb`）。
    - 变异：去掉 E 分流 ⇒ ①红；文案回退 ⇒ ④红。
- **AC5 失效可见且区分类别（`DEF-92`）**
    - 判据：`exp` 已过 ⇒ reason=`expired`；未过 ⇒ `signed-in-elsewhere`；登录页渲染对应 i18n key；`sessionStorage` 重载后仍在、重登成功清空；文案零技术键名（无 `10041`/`stale`）。
    - 落点：新增 `session-expiry-reason.test.ts` + `sign-in-page.test.ts`（真实挂载，不用 stub）。
    - 变异：写死单一 reason ⇒ 两分支之一红。
- **AC6 后台零请求、零 `Bearer null`（`DEF-93`）**
    - 判据：`authHeaders()` 无 token ⇒ `{}`；登出/失效后 `schedulePush()` + `handleOnline()` + 定时到期 ⇒ requester 网络方法 0 调用；任一请求头不含字符串 `null`；全仓 `Bearer ${` 只在单一实现处。
    - 落点：`sync-service` 既有测试 + `auth-rotation.test.ts`。
    - 变异：恢复模板拼接 ⇒ 红。
- **AC7 单初始化（`DEF-94`）**
    - 判据：连续两次 `initRequester(同 name+baseURL)` ⇒ `getRequesterImpl()` **同引用**、无第二套闩（fire 一次 ⇒ 回调 1 次）；两端注册同一函数（引用相等）；参数漂移（异 `baseURL`）⇒ 结构化日志可见、不静默换实例。
    - 落点：新增 `requester-init-idempotent.test.ts`。
    - 变异：闩搬回闭包 ⇒ 红。
- **AC8 深链注册（`DEF-95`）**
    - 判据：`/auth/signup?redirect=/calendar/day` 注册成功 ⇒ 落在 `/calendar/day`；登录页的注册链接 href 带 `redirect`；无 redirect 时行为不变。
    - 落点：`deep-link-resume.test.ts` 扩展。
    - 变异：删透传 ⇒ 红。
- **AC9 存储能力降级（`DEF-96`）**
    - 判据：令 `window.localStorage` 读写抛错 ⇒ `getDeviceId()` 不抛、非空、本次进程内稳定；`window.matchMedia` 缺失 ⇒ 主题初始化不抛并回退默认；降级有结构化日志标记；**登录不失败**。
    - 落点：新增 `device-id-degraded.test.ts` + `theme-store.test.ts`。
    - 变异：去掉 `try/catch` ⇒ 红。
- **AC10 移动端零改动**
    - 判据：`git status --porcelain -- packages/presentation-react apps/mobile` = 0 行；`presentation-react` 未引用新增导出。
    - 落点：门禁命令 + 静态扫描。
    - 变异：在移动端加一行 import ⇒ 红。

## 必须补的既有缺口（否则「绿而无效」）

- `auth-rotation.test.ts` 的「单次消费」断言已被 #260 改为窗口级 ⇒ W1 落地时确认无回退断言残留。
- 现状**无**「有效处理者唯一」「矩阵副作用计数」「`Bearer null` 零出现」「解锁失败不阻断」四类守护 ⇒ 本批必补。
- UI 断言须**真实组件挂载 + 打印实测值**（AGENTS.md 前端验证纪律）：横幅是否真渲染、`sessionStorage` 是否真留、文案是否真取自 i18n；stub 结果不算证据。