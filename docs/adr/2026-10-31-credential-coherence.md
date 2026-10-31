# ADR：凭证失效口径收口（DEF-90…96）

- 状态：提议（D2 / D3 / D5 待用户裁定）
- 更新：2026-10-31
- Owner：arch-designer
- 指针：PRD `docs/prds/2026-10-31-credential-coherence.md` · 审计 `docs/reports/T551-auth-credential-audit.md` · Issue #291 · 明细 `docs/reports/T588-arch-review.md` · 判据 `docs/reports/T588-credential-coherence-cases.md`

## 背景

- 判定/提示/清理/恢复四动作无单一所有者：客户端 5 处判据（`error-classification.ts:62/106/141`、`axios.ts:133`、`sync-service.ts:483`）、3 套清理，且方向相反（认证投影 fail-closed / 读路径 fail-soft）；服务端把五种原因压成 `10041`（`jwtValidator.go:70`），`10042`（`:78`）客户端未识别。
- **F-1（`DEF-90` 真因）**：桌面 `@` 别名指向 `apps/web/src`（`electron.vite.config.ts:49`）⇒ `App.vue:6` 再跑 `useApp()` ⇒ `initRequester` 二次（`app.ts:18` / `main.ts:14`）⇒ **后注册的 web 弱清理胜出**；桌面完整清理（`AppRoot.vue:78`）只剩「App 挂载前 + sync 路径」⇒ 同一次失效按「谁先发现」分裂。
- **F-2（`DEF-91` 真因）**：明文姿态下 `encrypt` 恒出 `plain:`（`crypto-service.ts:197`）、`decrypt` 对明文直返 ⇒ **DEK 对已迁移库非必需**，冷启动解锁门已据此免密（`unlock-gate.vue:86`）；唯独 signIn 仍把解锁失败当登录失败（`binding.ts:126`）。

## 决策

- **D1 单一判据**：`error-classification.ts` 增 `AUTH_CREDENTIAL_CODES=[10041,10042]` + `classifyAuthFailure()` + `decideSessionEnd({source,code|err})`（`active` 沿用 C-67 fail-closed；`passive` 仅显式凭证码判登出）；事件上提模块级单例 `shared/requester/auth-expiry.ts`；执行单点 `apps/web/src/session-end.ts`（axios / sync / 续期 / 跨标签四路共用）。归类：`10041`/`10042` ⇒ `credential`；`NETWORK_ERROR_CODES`（6 个）⇒ `network`；其余（含 `10022`/5xx/未知）⇒ `business`（被动投影不登出）。`isCredentialError`、`hasCredentialFailureSignal` 语义**逐字不变**（C-67 / r12），仅共享证据常量。代价：+2 文件、4 处改指、零服务端变更；移动端只新增导出（零引用）。
- **D2 清理矩阵**：见下表；**失效即锁内存 DEK、保留 `key-bundle`**。理由 = 明文姿态下锁不增保密收益，但保证失效与登出姿态一致（C-25/C-51/AC3），重登时密码在手自动重解锁；代价 ≈ 一次 PBKDF2 600k（RD 实测）。**硬前提 = D3 同批**，否则「锁 + 解锁失败」叠成死锁；回退 = 删一行 `lock()`。与 C-59/C-61 无冲突（清理发生在 `bootstrapLocalData` 之后，不新增业务写路径）；新增 `sessionStorage` 键按 `local-storage-policy.ts` 的 `USER_SCOPED_STORAGE_KEYS` 同口径登记。
- **D3 恢复出口（`DEF-91`）**：选定 **E 按需分流（默认不阻断）+ B 旧密码无损解锁 + D 重建兜底**（≈2.5 人天）；**A 与 D 合并**（明文姿态下等价）；**C 一次性恢复码不做**（3–4 人天、存量零收益）。判据落**两处**：`binding.ts:126` 与 `unlock-gate.vue` 的 `doUnlock`（PRD 未列后者）。
- **D4 双初始化（`DEF-94`）**：`initRequester` 改**幂等**（同名同 `baseURL` 复用实例）+ 回调改「注册到 `auth-expiry` 单例」+ 两端注册**同一函数** ⇒ 后注册无害；AC7 由「只有 1 次调用」放宽为「1 个有效处理者 + 1 个闩」，二者皆可断言。（否决「删 web 侧初始化」：web 独立运行必须自初始化。）
- **D5 提示（`DEF-92`）**：类别**本地推断**——解析 JWT `exp`，已过 ⇒ `expired`，未过 ⇒ `signed-in-elsewhere`（不猜服务端原因、不改契约）；reason 落 `sessionStorage`（刷新仍在、登出即清）；**登录页顶部横幅**为准，Toast 次选，模态否决。
- **D6 后台静默（`DEF-93`）**：`authHeaders()` 无 token 返回 `{}`（**永不** `Bearer null`）+ 会话结束后 sync 各网络相位早退（复用既有 `!userId` 早退 + 新增 `sessionEnded` 门）；`isSessionExpiredCode` 改用 D1 判据（纳入 `10042`）。
- **D7 小项（`DEF-95`/`DEF-96`）**：`sign-up.vue:36` 保留 `query.redirect` + `sign-in.vue:72`/`sign-up.vue:107` 互链携带 redirect；`device-id.ts:17/25` 读写双 `try/catch` + 进程内缓存降级，`theme-store.ts:58` 加 `matchMedia` 守卫。

**D2 清理矩阵（一次失效事件的动作集合）**

| 项                                          | 结论              | 依据                       |
| :------------------------------------------ | :---------------- | :------------------------- |
| 会话凭证（JWT + store + 离线授权 + 轮换窗） | **清**            | DEF-5 / C-25 / C-52 / #260 |
| 本地业务数据（11 表）                       | **留**            | C-67 / K4：10041 不清库    |
| 本地保险库（内存 DEK / `key-bundle`）       | **锁 DEK · 留包** | C-51 唯一不可逆开关        |
| `syncQueue` / `syncCursor` / 操作日志       | **留 · 停发停写** | C-54 不丢未推送 · T560     |

## 理由

1. 业务匹配 + 技术成熟：PRD「判定 1 处 / 同事件一套动作 / 恢复 100% 可达」只能靠「单点事件 + 单点执行」达成；实现全复用仓内原语（分类器 / `safeReplace` / `sign-out-broadcast.ts:86` 的完整清理形态），零新依赖。
2. 团队能力 + 成本效益：改动集中 shared 两模块 + web/desktop 装配面（移动端只新增零引用导出）；W1 ≈2.5 人天闭合 `DEF-90/93/94` + F-1 因果，`DEF-91` 的 E 方案 0.5 人天覆盖多数用户，C 方案 4 人天近零收益故不做。

## 对照过的备选模式

1. **维持现状（逐处修补）** —— 适用单点小修；代价是 5 处判据继续分叉、弱清理继续胜出、AC1 不可断言；**不采纳**。
2. **双向统一 fail-soft / 双向统一 fail-closed** —— 前者仅适用被动响应（否则 checkIn 保留无效认证，破 C-67），后者仅适用主动校验（否则 5xx 即踢人，破 AC2）；**均不采纳**，定「一个分类器 + 两个投影」。
3. **要求服务端细分 `10041` 原因码** —— 适用需确定性区分到期/被顶号；代价 = 跨仓契约 + 双端兼容窗 + 发版顺序（≈3–5 人天）；**暂不采纳**（D5 的 `exp` 推断已够），登记待 PM 决定。
4. **`DEF-91` 五出口（A 重包 / B 旧密码 / C 恢复码 / D 重建 / E 按需分流）** —— 选定 **E+B+D**（丢失 0 / 0 / 仅未迁移密文且可重拉）；C 因存量零收益不采纳（对比见评审报告 §五）。

## 后果与风险

- 正面：AC1/AC3/AC7 可静态 + 变异断言；桌面与 web 清理一致；`10042` 不再漏判、`Bearer null` 归零。负面：重登多一次 PBKDF2；新增 `sessionStorage` 身份级键（登出即清）。风险：D2 与 D3 不同批 ⇒ 死锁；`initRequester` 幂等后「首参生效」，两入口参数漂移须显式结构化日志；D3 结论依赖明文姿态（C-46），恢复密文须重评。

## 限制与已知边界

- 移动端（`presentation-react` / `apps/mobile`）仅影响面标注、零改动（R6/AC10）；服务端只读 ⇒ `10041` 不区分原因，「到期 vs 被顶号」为本地推断，**不承诺精确**；`DEF-85/87/88/89` 已由 #260 修复，本轮不复核。

## 相关指针

- 评审明细（矩阵详表 / 五候选对比 / 连带清单 Owner / 实施拆分 / 待拍板）`docs/reports/T588-arch-review.md` · AC 判据与变异 `docs/reports/T588-credential-coherence-cases.md` · 服务端只读证据 `nao-todo-server/interfaces/middlewares/jwtValidator.go`

## 参考来源

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) · 访问 2026-10-31 · PBKDF2-SHA256 ≥600k 仍是可接受下限（与 `crypto-service.ts` 现值一致 ⇒ D2「多一次派生」代价可量化）。
- [MDN: SubtleCrypto.deriveKey](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey) · 访问 2026-10-31 · 派生不可逆且无重包旁路 ⇒ 旧密码不可得时只能重建（支撑 D3 的 A/D 等价）；[Vue Router: Navigation Failures](https://router.vuejs.org/guide/advanced/navigation-failures.html) · 访问 2026-10-31 · 守卫中止 resolve 而非 reject ⇒ 单点导航须检查返回值（`DEF-88` 同口径）。