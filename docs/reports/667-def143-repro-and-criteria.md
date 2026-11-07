# T667 · `DEF-143` 本地复现 + 修复验收判据（+ AC9 时长补跑结论）

- 状态：**复现成立（与生产事故现象逐项一致）· 验收判据已出（13 条，可勾选）· AC9 60 分钟补跑 = 不做（理由见 §五）**
- 日期：2026-11-07 · Owner：qa（`T667`）
- 分支：`nao/667-def143-repro`（从 `origin/main` = `c445c62d` 拉出）
- 被测环境：**仅本机栈**（`naotodo-server` / `naotodo-mysql` / `naotodo-redis`，`http://localhost:3302`）——**生产环境未做任何读写**，本报告不含生产请求
- 被测服务端：容器 `naotodo-server`（镜像 `nao-todo-server-app`，启动于 2026-11-04T04:41:52Z；镜像内已含 `sessionRepoImpl` 的 Warn 版本 —— 实测日志确有该 Warn 行）
- 被测账号：本机临时注册 `qa-def143-20261107@naotodo.test`（userId `488210200034021376`，**口令与 token 均未落盘到仓库/报告**，临时文件已删；实验后**已注销** —— `DELETE /api/user/` ⇒ 软删、7 天后自动清理，无长期残留）
- 被测端点：`POST /api/sync/pull`（带有效 Bearer token，body `{}`）

## 一、结论（先给答案）

1. **根因复现成立，且比生产更快命中。** 停 MySQL 后**第 1 次**请求（+4s）即返回 **HTTP 200 + `{"code":10041,"message":"用户凭证验证失败"}`**，与生产事故窗口（2026-11-06 05:15:43Z–05:20:22Z，60 次全 10041）现象一致。
2. **服务端只有一行 `level=warning`，且不含 5xx。** 访问日志里该请求与成功请求**不可区分**（`status:200`、`response_length:51`、无 `user_id`）⇒ 监控按 5xx/error 级别**必然漏报**。
3. **客户端后果已用真实代码链 + 探针证实：等同于「真实凭证失效」⇒ 清认证 + 回登录页。** 服务端响应体与真实失效**逐字节相同**，客户端在 `packages/shared/requester/axios.ts` 的响应拦截器里只能按 `code == 10041` 判定 ⇒ 触发 `fireAuthExpiry('credential-invalid')` ⇒ `apps/web/src/session-end.ts` 的 `handleSessionEnd` ⇒ `clearSessionCredentials()` + `safeReplace('/auth/signin')`。
4. **恢复无粘滞**：MySQL 恢复后 **+9s** 同一 token（未重新登录）即回到 `90020`。
5. 修复判据已落 §四（13 条）；`③ AC9 60 分钟补跑` = **不做**（§五）。

## 二、实验方法（可复跑）

```bash
# 前置：本机栈 healthy，已注册本地临时账号并取得 token（token 不落盘）
# 全程只对本机 3302 端口发请求
1) 基线      curl -X POST localhost:3302/api/sync/pull -H "Authorization: Bearer $TOK" -d '{}'
2) docker stop naotodo-mysql        # 停 60s 级
3) 期间每 12s 打 6 发同样的请求      # 记录 HTTP 码 + 响应体
4) docker start naotodo-mysql        # 等 healthy，再连续打请求测自愈
5) docker logs --since <T0> naotodo-server | grep -E 'err=|会话查询失败'
```

- 窗口：`2026-11-07 13:00:40` 起停，`13:01:38` 起启（**MySQL 停 58s**，容器 `healthy` 于 `13:01:44`）。

## 三、复现证据（①）

### 3.1 请求与响应（HTTP 码 + 响应体）

| 时刻（+08:00） | 相对停机               | HTTP | 响应体                                                                                    |
| -------------- | ---------------------- | ---- | ----------------------------------------------------------------------------------------- |
| 13:00:40       | 基线（DB 正常）        | 200  | `{"code":90020,"message":"批量拉取成功","data":{"data":{},"serverTime":"1794027640445"}}` |
| 13:00:44       | +4s                    | 200  | `{"code":10041,"message":"用户凭证验证失败"}`                                             |
| 13:00:52       | +12s                   | 200  | `{"code":10041,"message":"用户凭证验证失败"}`                                             |
| 13:01:04       | +24s                   | 200  | `{"code":10041,"message":"用户凭证验证失败"}`                                             |
| 13:01:16       | +36s                   | 200  | `{"code":10041,"message":"用户凭证验证失败"}`                                             |
| 13:01:28       | +48s                   | 200  | `{"code":10041,"message":"用户凭证验证失败"}`                                             |
| 13:01:38       | +58s（重启前最后一发） | 200  | `{"code":10041,"message":"用户凭证验证失败"}`                                             |

- **6/6 命中**，无一条 5xx、无一条超时；响应耗时 4–11ms（DNS 快速失败，不是超时挂死）。
- 结论：**DB 不可用 ⇒ 全部折叠成「凭证失效」**，与 `DEF-143` 生产现象（0×5xx、全 10041）逐项一致。

### 3.2 服务端日志原文（`err=` 未哈希）

每次请求都留一条，等级 **warning**（不是 error）：

```text
{"level":"warning","msg":"会话查询失败（按 user_id + token）: user_id=488210200034021376 token_len=267 err=dial tcp: lookup mysql on 127.0.0.11:53: server misbehaving","time":"2026-11-07 13:00:44"}
{"level":"warning","msg":"会话查询失败（按 user_id + token）: user_id=488210200034021376 token_len=267 err=dial tcp: lookup mysql on 127.0.0.11:53: server misbehaving","time":"2026-11-07 13:00:52"}
{"level":"warning","msg":"会话查询失败（按 user_id + token）: user_id=488210200034021376 token_len=267 err=dial tcp: lookup mysql on 127.0.0.11:53: server misbehaving","time":"2026-11-07 13:01:04"}
{"level":"warning","msg":"会话查询失败（按 user_id + token）: user_id=488210200034021376 token_len=267 err=dial tcp: lookup mysql on 127.0.0.11:53: server misbehaving","time":"2026-11-07 13:01:16"}
{"level":"warning","msg":"会话查询失败（按 user_id + token）: user_id=488210200034021376 token_len=267 err=dial tcp: lookup mysql on 127.0.0.11:53: server misbehaving","time":"2026-11-07 13:01:28"}
{"level":"warning","msg":"会话查询失败（按 user_id + token）: user_id=488210200034021376 token_len=267 err=dial tcp: lookup mysql on 127.0.0.11:53: server misbehaving","time":"2026-11-07 13:01:38"}
```

- 本机错误串是 docker 内置 DNS 的方言（容器被移除 ⇒ 名字解析失败）：`err=dial tcp: lookup mysql on 127.0.0.11:53: server misbehaving`。
  **生产对应形态**为 `dial tcp <ip>:3306: connect: connection refused` / `i/o timeout`（用户 2026-11-07 提供的手工重启 MySQL 日志即 `err=dial ...`）—— **同一 `dial` 族、同一折叠路径**，故本机复现足以代表生产。
- 附带一行 gorm/sql-driver 自述：`[mysql] ... closing bad idle connection: EOF`（连接池感知到断连，但**不参与**错误映射）。

### 3.3 访问日志：与成功请求不可区分（可观测性缺陷的实证）

```text
{"content_length":2,"level":"info","method":"POST","msg":"API 请求完成","path":"/api/sync/pull","response_length":51,"status":200,"time":"2026-11-07 13:00:44", ...}
[GIN] 2026/11/07 - 13:00:44 | 200 | 3.5ms | 172.18.0.1 | POST "/api/sync/pull"
```

- `status=200`、`level=info`、**无 `user_id` 字段**（鉴权中间件在写入上下文的 user 之前就 abort 了）⇒ 事后想统计「有多少用户在这段时间被踢」只能靠 `会话查询失败` 那条 Warn 的关键字，**无法从访问日志反推影响面**。

### 3.4 客户端后果（真实代码链 + 探针实测）

代码链（三处全部为**线上既有实现**，非推断）：

| 环节           | 位置                                                                                              | 行为                                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ① 请求器拦截   | `packages/shared/requester/axios.ts:139-175`                                                      | 成功分支按 `isCredentialCode(response.data.code)` 判定；`AUTH_CREDENTIAL_CODES = [10041, 10042]`（`credential-codes.ts:13`）⇒ 命中即 `handleCredentialExpired` → `notifyAuthExpired()` |
| ② 事件单例     | `packages/shared/requester/auth-expiry.ts` + `apps/web/src/app.ts:23` `installSessionEnd(router)` | `onAuthExpiry(handler)` 单槽单闩                                                                                                                                                       |
| ③ 会话结束单点 | `apps/web/src/session-end.ts:97-113`                                                              | `clearSessionCredentials()`（`userStore.clearAuthData()` + `localSession.clear()` + 锁 DEK + 撤离线授权）→ 广播 → `safeReplace(router, '/auth/signin')`                                |

- 说明：web 端**没有**注册 `syncService.setSessionExpiredListener`（只有桌面端 `AppRoot.vue:81` 注册）⇒ web 上的「被踢」由 ①（axios 拦截器）这一路完成；同步层 10041 分支（`sync-service.ts:1016-1029`）另有 `syncStatus.markCredentialFailure()`，用于面板显示「会话失效」。

**探针实测**（临时探针，不入库；用**本机抓到的真实响应体逐字**驱动真实拦截器）：

```text
$ pnpm exec vp test --run packages/shared/requester/__tests__/probe-def143.test.ts
 Test Files  1 passed (1)
      Tests  2 passed (2)
   Duration  1.07s
```

| 用例                      | 输入（HTTP 层）                                                                    | 断言                      | 实测                                 |
| ------------------------- | ---------------------------------------------------------------------------------- | ------------------------- | ------------------------------------ |
| A（= 现状）               | `200` + `{code:10041,message:"用户凭证验证失败"}`，且请求 token 快照 == 当前 token | 清认证回调被调用 **1** 次 | ✅ **调用了**（⇒ 清认证 + 跳登录页） |
| B（= 修复后应有形态对照） | `{code:50300,message:"数据库暂时不可用"}`                                          | 清认证回调 **不**被调用   | ✅ 未被调用                          |

- ⇒ **现状**：一次基础设施抖动 = 一次真实失效，客户端**无从区分**（响应体完全相同），**必然**清认证并回登录页。**这就是「全员被踢」的实质证据。**
- ⇒ **修复方向有效**：只要服务端不再回 `10041`（改 5xx 或非凭证业务码），客户端**天然不会**踢人 —— 无需客户端改动即可消除「被踢」；是否需要客户端兜底（连续两次确认）由 arch 定。

### 3.5 自愈（未重新登录）

| 事件                                       | 时刻                | 说明                              |
| ------------------------------------------ | ------------------- | --------------------------------- |
| `docker start naotodo-mysql`               | 13:01:38            | —                                 |
| 容器 `healthy`                             | 13:01:44（+6s）     | docker healthcheck                |
| 首次 `90020`（同一 token，**未重新登录**） | 13:01:47（**+9s**） | `{"code":90020,...}` ⇒ **无粘滞** |

- 期间 `user_sessions` 中该会话未被删除（DB 只是不可达），故恢复后立即有效 ⇒ 与生产事故「05:20:52 起未重登自动恢复」一致。

### 3.6 实验后环境终态

```text
naotodo-server  Up 3 days
naotodo-redis   Up 3 days (healthy)
naotodo-mysql   Up (healthy)          # 本实验停止后已恢复
ping=200
```

## 四、`DEF-143` 验收判据（② · 修复后复验用，可勾选）

> 复验方式：**重跑 §二 的同一实验**（本机栈停 MySQL 60s）＋ 全范围门禁。以下每条给「怎么测 / 期望值」。
> 修法形态（5xx 还是专用业务码、是否加客户端二次确认）**以 arch 定稿为准**；下面凡涉及「新码」处，两种形态任选其一即算通过，但必须与定稿一致。

### A. 服务端映射（核心）

- [ ] **AC-1 不折叠**：`sessionRepoImpl.FindByUserIdAndToken` 不再把 DB/连接类错误吞成「零值实体」—— 错误必须向上返回（或显式区分「查不到」与「查失败」两种结果），零值实体**只能**代表「会话不存在」。
    - 怎么测：停 MySQL 打 1 发 `/api/sync/pull`；**期望**：响应**不是** `{"code":10041}`。
- [ ] **AC-2 码型**：DB 故障 ⇒ **HTTP 5xx**（推荐 503）**或** 专用业务码（`9002x` / 非 `10041`、`10042` 的任何码，以 arch 定稿为准）。
    - 怎么测：同 AC-1；**期望**：`status=503`（或 `200 + code=<定稿码>`），且响应体**不含**「用户凭证验证失败」。
- [ ] **AC-3 失败语义不漂移**：新码**不得**被客户端当成成功（`PULL_SUCCESS_CODES = [90020]`，新码 ∉ 该表）⇒ 不得推进镜像新鲜度、不得删 `pending`、不得 `markMirrorPulled`。
    - 怎么测：停 MySQL 期间观察同步面板 `lastError` 与 `mirrorPulledAt`；**期望**：`lastError` 变为网络/数据类错误、`mirrorPulledAt` **不前进**。
- [ ] **AC-4 真实凭证失效零回归**：真失效仍为 `10041`，至少覆盖四种子场景各 1 发 —— ① JWT 签名/格式非法 ② JWT 过期 ③ 会话行被软删 ④ token 已被轮换（被顶号）。
    - **期望**：4/4 返回 `200 + {"code":10041,"message":"用户凭证验证失败"}`（与今天一致）。

### B. 可观测性

- [ ] **AC-5 等级与字段**：DB 故障每次至少一条 **level ≥ error** 的日志（或专用事件名 + 稳定关键字），带 `err` **原文**（含错误类型与目标，如 `dial tcp <host>:3306: connect: connection refused`），**不得**哈希/吞掉原因。
- [ ] **AC-6 无凭证泄漏**：新日志**不得**包含 token/JWT 明文或口令（现状 `token_len` 的做法可保留；`§六` 记载的 GORM SQL 明文 token 问题须一并修或被显式接受）。
- [ ] **AC-7 可统计可告警**：存在一条**可配置告警**的固定信号（错误级别 + 稳定关键字，或计数器指标），能回答「过去 5 分钟有多少用户被折叠成凭证失败」。
    - 怎么测：本机停 MySQL 造 6 次故障，按该信号做一次计数；**期望**：计数 = 6（±0，不被日志截断/采样吃掉）。

### C. 客户端（不踢人 / 不丢会话）

- [ ] **AC-8 新码不踢人**：在 AC-2 的新码下，**web 与桌面**都不得：清认证、跳登录页、写离线授权撤销、发 `Bearer null`。
    - 怎么测：用 §3.4 的探针形态（真实拦截器 + 真实响应体）断言「清认证回调 0 次」；**期望**：0 次。
- [ ] **AC-9 抖动窗口内会话可活**：DB 不可用 ≤60s 期间，后台同步只是失败（可见提示），**会话仍有效**；恢复后**无需重登**继续同步，积压的 `pending` 不丢。
    - 怎么测：停 MySQL 60s → 恢复；**期望**：`user_sessions` 行数前后一致、JWT 未变、恢复后第 1 次 pull = `90020`，且改动数据最终上送成功。
- [ ] **AC-10 真失效零回归**：真 `10041` 仍然清认证 + 跳登录（既有用例全绿：`apps/desktop/.../AppRoot.test.ts` 的 C-25、`packages/domain-identity/.../credential-classification.test.ts`、`apps/web/.../t596-*`）。
- [ ] **AC-11（仅当 arch 选「客户端二次确认」）**：只有「连续 2 次 `10041`（间隔 ≤30s）」或「健康探测通过后仍 `10041`」才清认证；且必须有上限（连续 `10041` 超过 N 次或超过 T 秒仍要生效），**不得**出现「真失效后永不登出」。

### D. 恢复与无副作用

- [ ] **AC-12 无粘滞**：MySQL 恢复后 **≤30s** 内（基线实测 9s）同 token 自动回到 `90020`，连续 3 发全 `90020`；不得要求重启服务端 / 重登。
- [ ] **AC-13 门禁与复跑**：全范围门禁 9 项（`vp check` / 全仓 `vp test --run` / `guard:ddd` / `webapp build` / `desktop:build` / 移动端红线 0 / `guard:gate-pathspec` / `guard:barrel-imports` / `guard:mobile-imports` / `guard:test-location`）**分别** exit 0 并回执精确数字；并**复跑 §二 实验**得到 `§3.1` 期望值（修复后：非 10041）。

## 五、③ `T661` AC9 时长补跑：**不做**

理由（三条，按权重）：

1. **口令不可得且不得落盘。** `qa-ac9-20261106@naotodo.test` 的随机口令只在 `T661` 那次会话内存活（报告 `661-ac9-ratelimit-verification.md` §二① 明确「未写入任何文件」），**本会话无该口令**；该账号也不在本机库（本机 `naotodo.users` / `nao_todo_test.users` 均无，属生产账号）⇒ 要么生产重置口令（**生产写操作，本次明确允许范围之外**），要么新注册账号（就变成新实验，不是「补上次缩水」）。
2. **边际价值低。** `T661` 的 AC9 服务端半条结论由三条**边界证据**支撑 —— 托桶（12×`90020` → 第 13 发 `10051`）、拆桶（pull 打满时 push `90010`）、隔离（user 桶满时未授权仍 `10041`）；19.88 分钟的 3 端节奏只用于证明「6 次/分 ≪ 12 次/分 ⇒ 长跑不撞限」，**该结论与时长线性无关**（要撞限需 ≥2 倍速率，不是等更久）。
3. **成本不划算。** 60 分钟占机 + 生产请求 1080 发（3 端 × 6 次/分 × 60），换来的只是「第 20–60 分钟仍 `0×10051`」这一几乎确定的重复观测，且期间若再撞 `DEF-143` 类故障会污染记录（上次即如此）。

⇒ **若 PM 仍要补跑**，前置条件应为：生产可重置该账号口令（或授权新注册 + 登记），且明确「测试窗口允许生产写入」，届时按 `T661` §二⑤ 同口径跑 60 分钟、只报响应码分布。

## 六、附：本次新观察（不在 `DEF-143` 范围，建议 PM 另行登记）

**服务端日志泄漏会话 token 明文。** 停 MySQL 期间，gorm/sql-driver 的**慢/错 SQL 日志**把完整查询语句打出来，其中包含 `user_sessions.token` 的**完整 JWT 明文**（本次实测存在，报告不复述该行内容）。触发条件 = 任何让 SQL 变慢或出错的场景（恰好是本缺陷的高频场景）。危害 = 日志/日志外发即等同于**有效会话凭证泄漏**（48h 有效期）。

- 建议定级：**P2（安全）**；修法方向 = 关掉/降级 gorm 的语句日志，或对 `token` 类列做脱敏（与 `SEC-12`「错误响应不回显内部细节」同族）。

## 七、遗留

| #   | 项                                                                                                                                                                                                                                                            | 出口                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1   | 本机临时账号 `qa-def143-20261107@naotodo.test`（userId `488210200034021376`）实验后**已注销**（`DELETE /api/user/` ⇒ 软删，7 天后自动清理；本地 dev 库，无生产影响）。复跑本实验只需重新注册一个本地账号（`POST /api/auth/signup` + `POST /api/auth/signin`） | 关闭（已清理）           |
| 2   | `§六` 的 token 明文日志问题**未登记到 `docs/reports/defect-pool.md`**（该文件由 PM 维护，qa 不碰）                                                                                                                                                            | 转办 PM（登记 + 定级）   |
| 3   | 本报告不含任何修复代码；`DEF-143` 的修法形态（5xx / 专用码 / 客户端二次确认）待 arch 定稿，判据 §四 的 AC-2 / AC-11 需随定稿收敛                                                                                                                              | 转办 arch（`T668` 口径） |

## 八、附录：探针源码（临时，已从工作区移除，未入库）

```ts
// @vitest-environment jsdom
// 目的：证明「DB 故障折叠成 10041」在客户端等价于真实凭证失效
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

const captured = vi.hoisted(() => ({ successHandlers: [] as Array<(r: unknown) => unknown> }))
vi.mock('axios', () => {
    const instance = {
        interceptors: {
            request: { use: () => undefined },
            response: {
                use: (onSuccess: (r: unknown) => unknown) => {
                    captured.successHandlers.push(onSuccess)
                }
            }
        }
    }
    return { default: { create: () => instance }, AxiosError: class extends Error {} }
})

const TOKEN = 'probe-token-def143'

const createHandler = async (onAuthExpired: () => void) => {
    const { default: useAxiosRequester } = await import('../axios')
    useAxiosRequester('http://localhost:3302', false, onAuthExpired, () => TOKEN)
    const handler = captured.successHandlers.at(-1)
    if (!handler) throw new Error('请求器未注册响应拦截器')
    return handler
}

afterEach(async () => {
    const rotation = await import('../auth-rotation')
    rotation.resetTokenRotation()
    const win = await import('../checkin-window')
    win.resetCheckInWindow()
})

describe('DEF-143 客户端后果：DB 故障折叠成 10041', () => {
    it('实测服务端响应体（200 + code 10041 + 当前 token）⇒ 触发清认证回调', async () => {
        const onAuthExpired = vi.fn()
        const handler = await createHandler(onAuthExpired)
        await handler({
            data: { code: 10041, message: '用户凭证验证失败' },
            config: { headers: { Authorization: `Bearer ${TOKEN}` } }
        })
        expect(onAuthExpired).toHaveBeenCalledTimes(1)
    })

    it('对照：若修成 5xx + 非凭证业务码（如 50300）⇒ 不触发清认证回调', async () => {
        const onAuthExpired = vi.fn()
        const handler = await createHandler(onAuthExpired)
        await handler({
            data: { code: 50300, message: '数据库暂时不可用' },
            config: { headers: { Authorization: `Bearer ${TOKEN}` } }
        })
        expect(onAuthExpired).not.toHaveBeenCalled()
    })
})
```