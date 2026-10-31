# T591 凭证口径收口批 —— 独立复验报告（qa）

> 任务：`T591`（批次 `B20261031-credential-coherence`）· 需求分支 `feat/291-credential-coherence`
> 依据：PRD `docs/prds/2026-10-31-credential-coherence.md`（AC1–AC10 · §九 裁定）· ADR `docs/adr/2026-10-31-credential-coherence.md`（D1–D7 + 清理矩阵）
> 被测提交：红基线 `089ba015`（qa）· 实现 `1bf1dab5`（W1）/ `d0f3e3e5`（W4）/ `61804bc6`（W2）/ `82caf9fc`（测试侧）
> 结论：**通过（附 7 项遗留，其中 1 项需 PM 裁定）**；全范围门禁 9 项全绿，无人为放行。
> 检索口径：本批判据大量为**字面量/文本扫描**（`Bearer ${`、`localSession.clear(`、`10041`），且核验对象含本批 4 个新增文件（索引 debounce 滞后）⇒ 走阶梯第三级（`grep -rn` + 行段读取），未走 `codegraph_explore`/CLI。

## 一、A 两项判定（PM 裁定过的两处）

### A-1 AC4-B 的 `vi.waitFor` 是否等价（非放松）

变更（`82caf9fc`，行级）：

```text
-        expect(gate.emitted('unlocked'), '解锁成功后应放行进入').toBeTruthy()
+        // T590：真 crypto（PBKDF2 600k ≈ 300ms）异步完成，`flushPromises` 只等一个宏任务
+        // ⇒ 等够再断言（断言本身零改动；否则等于要求实现在解锁完成前提前放行）
+        await vi.waitFor(() => expect(gate.emitted('unlocked')).toBeTruthy(), { timeout: 5000 })
```

**判定：等价（不放宽语义），且反证成立。** 依据：

1. **被断言谓词一字未改**：仍是 `emitted('unlocked')` 真值，只把「点完立刻取快照」换成「最多轮询 5s」。
2. **失败不被吞**（实测反证，见 §三 M6a/M6b）：
    - 删掉 `onRecover` 的 `emit('unlocked')` ⇒ 该用例 **红**（`5312ms`，`vi.waitFor` 超时抛错 ⇒ 用例 fail，不是 pass + 静默）；
    - 把 `emit` 延后 6s ⇒ 该用例 **红**（`5338ms`）。
3. **注释的时序事实成立**：`crypto-service.ts:7` `PBKDF2_ITERATIONS = 600_000`；本机实测 3 次派生 `309 / 312 / 301 ms`（Node webcrypto，同参数）⇒「≈300ms」准确；`flushPromises` 只推进一个宏任务，确实等不到真实派生完成。5s 上限 = 实测量级的 **≈16×**，对慢机有余量。
4. **强度实际更强处**：该用例后半段仍是硬证据（`cryptoService.lock()` 后新密码 `resolves`、旧密码 `rejects`）——M7b（跳过重包）红，证明「重包到新密码」由真实 crypto 断言锁住，而非靠时序。
5. 唯一放宽项：允许「解锁完成后最多 ~5s 才 emit」这种无用户可见后果的延迟通过 ⇒ 可接受。

### A-2 AC6 七处夹具补 token（只动夹具、未动断言）

`git diff 089ba015..HEAD` 逐文件行级结论（全部为 **+1 import +2 行**，位于 `setup()`/`resetLocalState()`/`beforeEach` 夹具内，**0 处断言改动、0 处被测行为改动**）：

| 文件                                                           | 变更                                                                                                                         |
| :------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| `persistence-sync/__tests__/conflict-journal.test.ts`          | `+import USER_JWT_LOCALSTORAGE_KEY`；`setup()` 内 `setItem(…, 'jwt-sync-fixture')` + 注释                                    |
| `persistence-sync/__tests__/dropped-fields-push.test.ts`       | 同上（`resetLocalState()`，紧接既有 `localStorage.clear()`）                                                                 |
| `persistence-sync/__tests__/occ-base-and-outcome.test.ts`      | 同上（`resetLocalState()`）                                                                                                  |
| `persistence-sync/__tests__/push-single-master.test.ts`        | 同上（`resetLocalState()`）                                                                                                  |
| `persistence-sync/__tests__/server-time-calibration.test.ts`   | 同上（`setup()`，紧接既有 `localStorage.clear()`）                                                                           |
| `persistence-sync/__tests__/t326-sync-conflict-client.test.ts` | 同上（`resetLocalState()`）                                                                                                  |
| `desktop/.../__tests__/def6-mirror-e2e.test.ts`                | `+2 行`：注释 + `localStorage.setItem('USER_JWT', 'jwt-e2e')`（**字面量**而非常量，与同文件风格一致但仍是弱化点，见遗留 L4） |

**「无 token ⇒ 零请求」的正例未被夹具掩盖**（`sync-session-ended.test.ts` 未被 `82caf9fc` 触碰，`git diff` 对该文件为空）：

- `beforeEach` 只有 `localStorage.clear()`，**不置 token**；「JWT 已清 ⇒ `pullAll` 零请求」用例在无夹具注入下运行；
- 该文件同时保留**正向对照**（置 `jwt-589` ⇒ 请求数 `> 0` 且头为 `Bearer jwt-589`）⇒「零请求」不是恒零造成的假绿；
- 同文件「无 token ⇒ `authHeaders()` 为 `{}`」独立断言，与早退门**解耦**（M2 证明：仅删早退门时头已是 `{}`、用例仍红 ⇒ 两条判据各自有效）。

**另核（防「夹具掩盖真不变量」的连带风险）**：全仓 10 个使用 `SyncService/pullAll/pushAll` 但**未**置 token 的测试文件逐个核对——9 个为 node 环境（`localStorage` 未定义 ⇒ `hasEndedSession()` 走 catch 返回 `false`，闸不生效，覆盖原样保留），第 10 个 `t331-conflict-count-refresh.test.ts`（jsdom）只经 `SyncService.restoreConflictCount()` 读日志，不调用 pull/push ⇒ **无「因早退而静默变空转」的用例**。

## 二、B 独立复跑（精确数字）

| #   | 项                              | 命令/范围                                                                                                                                                                                          | 结果                                                               |
| :-- | :------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------- |
| B1  | 11 个红基线文件                 | `pnpm exec vp test --run <11 files>`                                                                                                                                                               | **11 文件 / 63 例 / 0 红**（7.33s）                                |
| B2  | 受影响面 + 依赖包               | `… --run packages/shared packages/domain-identity packages/presentation-identity packages/infrastructure/src/persistence-sync packages/infrastructure/src/persistence-local apps/web apps/desktop` | **230 文件 / 2015 例 / 0 红**（134.42s）                           |
| B3  | `pnpm exec vp check`            | 全仓                                                                                                                                                                                               | **rc=0**：格式 1736 文件全对；lint/类型 1421 文件 0 error（16.5s） |
| B4  | 全仓 `pnpm exec vp test --run`  | 全仓                                                                                                                                                                                               | **310 文件 / 2659 例 / 0 红**（170.77s）                           |
| B5  | `guard:ddd`                     | —                                                                                                                                                                                                  | **rc=0**（domain 未引 shared 根桶/展示层）                         |
| B6  | `guard:mobile-imports`          | —                                                                                                                                                                                                  | **rc=0**（72 源文件，未引 persistence-local/sync/dexie）           |
| B7  | `guard:barrel-imports`          | —                                                                                                                                                                                                  | **rc=0**（1421 文件 / 1538 导入 / 2246 命名均可解析）              |
| B8  | `guard:gate-pathspec`           | —                                                                                                                                                                                                  | **rc=0**                                                           |
| B9  | `guard:test-location`           | —                                                                                                                                                                                                  | **rc=0**（302 测试文件均在 `__tests__/`；8 移动端白名单）          |
| B10 | `pnpm exec vp run webapp build` | —                                                                                                                                                                                                  | **rc=0**（✓ built in 14.06s）                                      |
| B11 | `pnpm run desktop:build`        | —                                                                                                                                                                                                  | **rc=0**（✓ built in 17.33s）                                      |
| B12 | 移动端红线                      | `git status --porcelain -- packages/presentation-react apps/mobile \| wc -l`                                                                                                                       | **0 行**                                                           |

B1 分布：`auth-seam-scan` 15 · `credential-classification` 9 · `binding` 7 · `auth-expiry` 6 · `unlock-gate-recovery` 5 · `sign-up-redirect` 4 · `sync-session-ended` 4 · `device-id-degraded` 4 · `session-end` 3 · `theme-store` 3 · `requester-init-idempotent` 3 = 63。

## 三、C 变异独立重做（8 处，全部还原）

还原证明：每次删除/回滚后 `git status --porcelain` **输出为空**（逐条已核；M5 的新增探针文件已 `rm`）。变异一律不落库。

| #   | 变异                                                                       | 目标用例 | 结果（红/绿）   | 证据                                                                                                                              |
| :-- | :------------------------------------------------------------------------- | :------- | :-------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| M1  | 删 `session-end.ts` 的 `cryptoService.lock()`                              | AC3      | **红**          | `session-end.test.ts`：`"vi.fn()" to be called 1 times, but got 0`；连带 `auth-seam-scan` R1「缺矩阵原语 `cryptoService.lock`」红 |
| M2  | 删 `sync-service.ts` 两处 `if (this.hasEndedSession()) return`             | AC6      | **红**          | `pullAll` 用例：`expected [ { headers: {} } ] to deeply equal []` ⇒ 仅靠头修复不够，**早退门是独立判据**                          |
| M3  | 去掉 `binding.ts` 的 E 分流（恢复「解锁失败即阻断」）                      | AC4-E    | **红**          | `已迁移库 + 解锁失败 ⇒ 登录成功(null)` 用例失败（`expected 'local unlock failed' to be null`）；未迁移库文案用例同红              |
| M4a | 在 `persistence-sync/epoch.ts` 手写 `Bearer ${token}`                      | AC6/R4   | **红**          | `DEF-93 源头：packages/infrastructure/src/persistence-sync/epoch.ts`                                                              |
| M4b | 在 `shared/requester/retry.ts` 手写 `Bearer ${token}`（探边界）            | AC6/R4   | **绿（15/15）** | R4 只扫 `persistence-sync` ⇒ **扫描盲区**（见遗留 L5）                                                                            |
| M5  | 新增 `apps/web/src/__probe-r2-mutation.ts`，内含 `localSession.clear()`    | AC1/R2   | **红**          | `越界文件：apps/web/src/__probe-r2-mutation.ts`                                                                                   |
| M6a | 删 `onRecover` 的 `emit('unlocked')`                                       | AC4-B    | **红**          | 用时 `5312ms` ⇒ 超时**抛出**致用例 fail（waitFor 不吞错）                                                                         |
| M6b | `emit('unlocked')` 延后 6000ms                                             | AC4-B    | **红**          | `5338ms`，同上                                                                                                                    |
| M7  | 重包目标 `pendingNewPassword.value` → `password.value`（回退「暂存」修复） | AC4-B    | **绿（2/2）**   | 见 §四 重点①                                                                                                                      |
| M7b | 跳过重包（`if (false && pendingNewPassword.value)`）                       | AC4-B    | **红**          | 新密码 `rejects`（`DOMException`）⇒ **契约已锁**                                                                                  |
| M8  | B/D 入口改为「失败后才出现」（`v-if="unlockFailed"`）                      | AC4-B/D  | **红（5/5）**   | 断言时失败态尚未落地（PBKDF2 ≈300ms）⇒ 用例锁定的是**常显**设计，不是「失败后出现」                                               |

## 四、D 逐条 AC

### AC1 单一判据 + 唯一执行点 —— **成立（行为层）；判据字面量有 5 处残留**

- 判据单点：`shared/requester/credential-codes.ts`（`AUTH_CREDENTIAL_CODES=[10041,10042]`）+ `domain-identity` 的 `classifyAuthFailure` / `decideSessionEnd`（passive 仅凭证码；active 沿用 C-67 fail-closed）。
- 事件单点：`shared/requester/auth-expiry.ts`（单槽 + 单闩）。
- 执行单点：`apps/web/src/session-end.ts`（矩阵 5 原语；R1/R2/R3/R5 用例 + M1/M5 变异双向验证）。
- 请求器：`axios.ts` 成功/错误分支均改 `isCredentialCode(code)`（**10042 纳入**）。
- **残留（不影响本批行为，因登出仍由 axios 拦截器统一裁决）**：`shared/requester/lynx.ts:109`、`persistence-sync/preference-sync.ts:387/419/452/539` 仍写死 `=== 10041`（10042 不在内）；`error-classification.ts:187` 的 `CREDENTIAL_FAILURE_CODES=[10041,10021,10022]` 是 r12 读路径的**另一集合**（ADR 明确「语义逐字不变」，不计入违规）。⇒ 「判定 1 处」在**执行/事件**层成立，**字面量层仍分叉**，且当前无扫描规则覆盖此类残留（见遗留 L2）。

### AC2 网络类 / 业务类不登出 —— **成立**

`credential-classification.test.ts`：6 个 `NETWORK_ERROR_CODES`（字符串/数字）⇒ `network`；`10022`/5xx/未知/空信号 ⇒ `business`；`passive` 下 network/business **均不结束**；`active` 仍 fail-closed（未知⇒结束、网络⇒保持）；`isCredentialError` 方向未变。

### AC3 清理矩阵（与 ADR D2 表逐项一致）—— **成立**

| ADR D2 项                                         | 实现                                                                                                                     | 核验                                                                                                                                           |
| :------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| 会话凭证（JWT + store + 离线授权 + 轮换窗）**清** | `revokeOfflineEntry()` / `clearAuthData()` / `localSession.clear()` / `resetTokenRotation()` 各 1                        | 用例断言各 1 次；M1/M5                                                                                                                         |
| 本地业务数据（11 表）**留**                       | 不调 `wipeUserData` / `wipeLocalDataOnSignOut`                                                                           | 用例断言 0 次                                                                                                                                  |
| 保险库：**锁 DEK · 留 `key-bundle`**              | `cryptoService.lock()`；不触 `meta.delete`                                                                               | 用例断言 `meta.delete` 0 次；`key-bundle` 唯一写入者为 `crypto-service`，删除仅经 `deletionService.wipeUserData`（本路径未调用）⇒ **包未被删** |
| `syncQueue`/`syncCursor`/操作日志 **留·停发停写** | 同步层不清理；`hasEndedSession()` 早退（停发）                                                                           | M2；R3「请求/同步层零清理」                                                                                                                    |
| 附带核实                                          | `clearAuthData()` 仅 `removeItem(USER_JWT)`（`user-store.ts:67`，注释明确禁 `localStorage.clear()`）⇒ 无意清设备 ID/主题 | 用例另有 `nao.deviceId` 哨兵未被删                                                                                                             |

### AC4 恢复出口 E + B + D —— **成立；3 项重点判断见下**

- **E**（`binding.ts`）：已明文迁移库解锁失败 ⇒ 只 `console.warn` + `cryptoService.setup(新密码)` 重建包裹，**返回 null 放行**；未迁移库仍阻断。用例 2 条 + M3 变异（删 E ⇒ 红）。
- **B**（`unlock-gate.vue`）：旧密码解锁 + `changePassword(旧, 新)` 重包（3 次上限 + 30s 退避）；用例用**真 crypto + fake-indexeddb**断言「新密码可解 / 旧密码不可解」。
- **D**：`NueConfirm` 二次确认 → `wipeLocalDataOnSignOut`（C-54 脏队列护栏）→ `selfHealLegacyCipherMirror` + `pullAll`；取消 ⇒ 断言「不清会话/不锁/不重建/不进入」全 0 副作用。

**重点①：`pendingNewPassword` 修复是否被断言锁住？—— 行为契约已锁，实现细节未锁。**

- M7（改回直接读 `password.value`）**绿**：当前模板是两个独立 `<nue-input v-if/v-else>`，`enterRecovery` 后 `password` 未被清空 ⇒ 直接读与暂存等价，故**该 stash 本身没有被任何用例区分**。
- M7b（跳过重包）**红**，证明「重包到新密码」这一**可观察契约**已锁。
- 结论：回归安全性由 M7b 保证；若未来把两个输入合并为一个（`v-model` 动态）并把 stash 一起删掉，M7b 规格仍会红（旧密码可解、新密码不可解）⇒ **不需要额外加断言**；stash 是防御性写法，保留即可。

**重点②：B/D 入口「常显」是否可接受？—— 可接受（不误导），但建议降噪。**

- 事实：`ready` 态恒显示提示句（条件句式「在其他设备改过密码？…」）+ 次按钮「用旧密码解锁」「重建本地数据」；主按钮仍为「解锁」。M8 证明现用例锁定的就是「常显」。
- 为什么可接受：① **可达性优先**——DEF-91 的死路正是「失败态渲染环节出问题 ⇒ 用户无路可走」，常显把出口从「状态机下游」提到「无条件存在」，与本批「恢复出口 100% 可达」同向；② **不构成误导**——文案是问句条件（不是断言「你密码错了」），主/次按钮层级分明，用户当前密码正确时不会被引导去点次按钮；③ 不可逆风险已有两层兜底（`NueConfirm` 二次确认 + 脏队列护栏），误点代价被吸收。
- 若 PM 认为噪音仍高（可选、低成本、与现有用例兼容）：**改驱动 = 只降「重建」**——把「重建本地数据」改为 `v-if="unlockFailed || recoveryMode"`（失败后才升为按钮；未失败时以 `nue-text` 小字「忘记/改过密码？」承载入口），「用旧密码解锁」保持常显（保住 100% 可达）。不建议把两者都改为失败后出现（会退回 M8 的不可达风险，且现用例 5/5 会红）。

**重点③（新发现）：未迁移库的 sign-in 失败文案与出口。**

`binding.ts` 未迁移分支文案 = `'本地数据解锁失败，请检查密码'`，且该屏（登录页）**没有** B/D 直达入口（B/D 在解锁门；用户需重启应用才能到达）。ADR D3 写的是「未迁移库保持阻断、文案不说「密码错」」，现状仍把用户导向「检查密码」（而 DEF-91 的典型场景恰恰是密码正确、本地包过期）⇒ **P3 偏离**，需 PM 裁定改法（见遗留 L3）。

### AC6/AC7/AC8/AC9 —— 按红基线逐条

- **AC6 成立**：`authHeaders()` 无 token ⇒ `{}`（拼接只在 `auth-headers.ts`）；`pullAllInner`/`pushAllInner` 双早退；`isSessionExpiredCode` 改用 `decideSessionEnd({source:'passive'})`（纳入 10042）；M2 证明早退门独立有效；正向对照与「零请求」正例均未被夹具掩盖（§一 A-2）。**残留**：`persistence-go/**` 61 处 + `lynx.ts` 1 处仍手写 `Bearer ${getJWTFromLocalStorage()}` ⇒ `auth-headers.ts`「**唯一**拼接实现处」表述不实（不在 AC6「后台同步」口径内，`Bearer null` 在这些路径仍可能出现）。
- **AC7 成立（口径 = 1 个有效处理者 + 1 个闩）**：`auth-expiry` 单槽（`getAuthExpiryHandlerCount()` ≤ 1）+ 单闩；两端重复 `installSessionEnd` 无害；`resetAuthExpiredLatch` 已一并复位单闩（登录/检入后）；参数漂移有结构化告警且不静默换实例。用例 3 条绿。
- **AC8 部分成立**：注册成功 `router.push(deepLinkTarget() ?? '/auth/signin')`，目标只认站内绝对路径（拒 `//`/非字符串）⇒ 防开放重定向；登录↔注册互链携带 `redirect`。**但** nue-ui 1.13.0 的 `nue-link route` 渲染 `<a class="nue-link">` **无 href**（DEF-116，`T589` 已登记）⇒ 入口链接的**用户可点性**无法在本仓验证，用例以「真实组件 props」为主证据并记录 href 缺失。属外部依赖遗留（遗留 L6）。
- **AC9 成立**：`getDeviceId` 读写双 `try/catch` + 进程内缓存 + 结构化日志（`phase: read|write`）；`theme-store` `matchMedia` 缺失 ⇒ 回退浅色 + 日志；均为**不弹 UI**（合 PM 裁定④）。
- **AC5（W3/`DEF-92`）不在本批**：横幅与跨标签未实现（`session-end.ts` 文档中「四路复用…跨标签广播」为**超前表述**，本批实际接 3 路：axios / 同步 / 桌面续期）。
- **AC10 成立**：移动端 `git status --porcelain -- packages/presentation-react apps/mobile` = **0 行**（B12）。

## 五、遗留（三出口）

| #   | 遗留                                                                                                                                                                                                                                                                                                                                              | 措辞/证据                                                       | 出口                                                                                                                                                |
| :-- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | W3（`DEF-92` 到期/顶号横幅 + 跨标签广播）未实现；`session-end.ts` 与 `auth-expiry.ts` 文档称「四路复用含跨标签」为超前表述                                                                                                                                                                                                                        | PRD §九「下一批（W3）」；代码只见 3 路（axios/同步/续期）接线   | **转办** rd-fe（W3 批，随 `DEF-92`），届时同步修正文档表述                                                                                          |
| L2  | AC1「判据 1 处」在字面量层仍有分叉：`lynx.ts:109`、`preference-sync.ts:387/419/452/539` 写死 `=== 10041`（10042 未纳入）；无扫描规则覆盖                                                                                                                                                                                                          | 见 §四 AC1；行为无分叉（登出仍由 axios 统一裁决）               | **转办**（下个「R1 单一来源清理」批）：改指 D1 判据 + 增扫描规则（`=== 10041` 白名单），P3                                                          |
| L3  | 未迁移库 sign-in 失败文案「本地数据解锁失败，请检查密码」仍指向密码，且登录页无 B/D 直达入口（需重启进解锁门）                                                                                                                                                                                                                                    | `binding.ts:136`；ADR D3「文案不说『密码错』」                  | **需 PM 裁定**：改文案（如「本地数据未能用当前密码解锁，可能在其他设备改过密码」）+ 可选加「去解锁门」入口；P3                                      |
| L4  | 文档/命名精确性：`auth-headers.ts`「唯一 Bearer 拼接实现处」、`credential-codes.ts`「唯一集合」与实际不符（`persistence-go/**` 61 处 + `lynx.ts` 1 处拼接；另有 `CREDENTIAL_FAILURE_CODES` 集合）；`auth-headers.ts`/`credential-codes.ts`/`device-id.ts` 无文件末尾换行（`vp check` 容忍）；`def6-mirror-e2e` 夹具用字面量 `'USER_JWT'` 未用常量 | 本报告 §一 A-2、§四 AC1/AC6                                     | **接受**（不修代码，随 L2/L5 批一并处理；不影响判据）                                                                                               |
| L5  | R4 扫描盲区：`Bearer ${` 只扫 `persistence-sync`（M4b 在 `shared/requester/retry.ts` 注入 ⇒ **用例仍绿**）⇒ 「绕过 `auth-headers`」在 shared/persistence-go 中不会被拦                                                                                                                                                                            | M4b                                                             | **转办**（下批扩展 R4 扫描面到 `shared/requester` + `persistence-go`，或改为「除 `auth-headers.ts` 外 0 处」）                                      |
| L6  | AC8 入口链接用户可点性依赖 `DEF-116`（nue-ui `nue-link route` 不产出 href）                                                                                                                                                                                                                                                                       | `sign-up-redirect.test.ts` 头注（实测 props 正确、DOM 缺 href） | **接受**（已登记 `DEF-116`；本仓规避或等上游，到期日 = `DEF-116` 关闭时复验）                                                                       |
| L7  | E 路径只用 `isPlaintextMigrationDone` 标记做「无密文可丢」判据：同 origin 版本错峰下若有旧密文残留（仓内已有 `hasLegacyCipherResidue` 可判），`setup()` 生成新 DEK 会使残留不可解                                                                                                                                                                 | ADR §限制「D3 结论依赖明文姿态（C-46），恢复密文须重评」        | **接受**（当前明文姿态成立；建议 W3 或下次迁移批在 E 后补一次 `selfHealLegacyCipherMirror`（带脏队列护栏）或先判残留；到期日 = 下次密文相关变更前） |

**纪律确认**：未合并、未碰 `main`、未改产品代码（8 处变异全部还原，`git status --porcelain` 每次为空）、未动移动端。