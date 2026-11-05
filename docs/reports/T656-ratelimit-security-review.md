# T656 同步限流维度切换 —— 安全评审（只读）

- 状态：**有条件通过** · 更新：2026-11-05 · Owner：arch-designer
- 范围：`M20261105-sync-ratelimit`（`/sync` 限流 key 由 IP → 已鉴权 `userId`；`pull`/`push` 拆桶）。PRD §九 触发点 3 要求的安全面评审。
- 基线：`nao-todo-server` 工作区（`M docker-compose.yml` 为用户未提交改动，未计入）。**未改代码、未建分支**。
- 口径：只给结论与可验条件，不出实现方案细化。

## 结论

**有条件通过**（C1–C7）。核心判断：方向正确且**代码已有现成件**（`middlewares.UserRateLimiter` 已存在，头像路由已是「JWT → 用户桶」先例）；风险不在维度本身，而在**「限流从鉴权前挪到鉴权后」**这一步会拆掉今天的**未鉴权请求前置闸门**。

## 1. 换维度会不会开新口子

- **未鉴权请求**：`UserRateLimiter` 拿不到 userId 时必须排在 `JWTValidator` 之后（其注释即写明），于是未鉴权请求**不再被计数**，每个都会走到 `auth.Validate` = JWT 验签 + `FindByUserIdAndToken`（**直查 MySQL，无缓存**，`sessionRepoImpl.go:345-370`）。
    - 缓解事实：验签（HS256）在 DB 之前失败 ⇒ 伪造/垃圾 token **不触 DB**；只有「签名有效但会话已失效/被吊销」的 token 才打到 DB。故不是「任意人可打」，但仍是**一个持有旧 token 的人可以把 DB 打满**（今天被 24/min/IP 挡住）。
- **换 token 绕过**：不成立。token → userId，同账号多端**共桶**；多账号受 `signin/signup 8/min/IP`（`authRouter.go:19-22`）约束。
- **一条 IP 打多个 userId**：Redis key 数 = 账号数 × 桶数 / 60s 窗口。`redis` 侧 `maxmemory 200mb + allkeys-lru`（`docker-compose.yml`）⇒ 极端情况下 rate-limit key 会挤掉 `cache:session:*`（把压力转回 MySQL）与**其他用户的计数器**（清零 = 变相放开）。这不是新类别（IP 维度也可被多 IP 打），但 key 空间从「IP 数」变成「账号数」，需监控。
- **结论**：必须**双桶**——保留前置 IP 粗桶（作为未鉴权/单 IP 的滥用地板）+ 后置 user 桶（作为账号公平性）。

## 2. 拆桶是否有语义副作用

- 拆桶**必要**：共享 24/min 下，pull 会吃掉 push 配额；push 在 2s 防抖下理论峰值 30/min，合法编辑会撞顶。
- 「只打 pull 变便宜」成立但**被单请求成本约束**：空转 pull = 7 次 `(user_id, updated_at, id)` 索引范围扫描（`dbs/mysql.go:96-131`，无 filesort），单请求成本有界；push 侧由 body 2MB + `maxSyncPushBatch` 兜。
- **建议配额（可验）**：**pull 12 / push 24**（合计 36 = 今日 24 的 1.5×）。依据：A′ 30s = 2/min/端 × 3 端（web + desktop + mobile）= 6/min ⇒ 2× 余量；若改 15s 则 12/min 正好打满 ⇒ **再次支持 30s 起步**。push 24 覆盖防抖峰值（若要求「合法编辑永不节流」可取 30，代价 = 突发写量上限 +25%）。
- **反指标**：拆桶**不得**同时放宽 `limit`/`batch`/`body` 上限；否则等于借拆桶变相放开。

## 3. 中间件顺序

- 现状：`RateLimiter`（IP）在 `JWTValidator` **之前**（`syncRouter.go:16-17`）⇒ 限流处拿不到 userId，**必须调序**。
- 先例：头像路由已是 `JWTValidator → UserRateLimiter`（`routers.go:118-123`），照抄即可，无需新中间件。
- **响应码语义变化**：超限**且**凭证无效 ⇒ 今天 10051，调序后 **10041**。对老客户端：`/sync` 客户端**无 10051 特判**（10051 落通用失败/退避），10041 走「清认证回登录」⇒ 语义更正确；不触 `R-D`（R-D 管 push/delete 载荷语义，不是错误码）。须用用例锁死三态。

## 4. 多实例与 Redis 降级

- 降级行为**不变**：`limit/4`、下限 5（`rateLimitRepoImpl.go:37-63`）⇒ 拆分后 pull 5 / push 6；进程内桶按 key 60s 过期 + 周期 sweep（`localFallback.go:39-86`），不新增泄漏。
- 与今天一致的两点：① 降级配额是**每实例**的（多实例 = N 倍；当前单实例无变化）；② 返回类型异常仍 `return true`（fail-open）。
- **无新增问题类**。唯一注意：降级日志沿用 `key_tag`（SHA-256 前 8 位），**不要**改成打印明文 key / userId。

## 5. 条件清单（RD 必须遵守，每条可验）

- **C1** 双桶：前置 IP 粗桶（建议 120/min/IP，tag 独立如 `sync-ip`）+ 后置 user 桶（`user:<id>:<tag>`）。用例：未鉴权洪水在**未触 DB** 前被拦（stub `auth.Validate` 计数断言）。
- **C2** pull/push 分桶且配额显式可配（默认 12/24）；用例：打满 pull 不影响 push（反之亦然）。
- **C3** 三态响应码：有效+未超限 = 原样；有效+超限 = 10051；无效（无论是否超限）= 10041。
- **C4** 老客户端回归：`outcome` / `serverCurrent` / `deletionOCCSupported` 语义不变；不带 `baseUpdatedAt` 的 push/delete 逐字一致（`R-D` 既有用例）。
- **C5** Redis 降级：user key 走同一 fallback，配额 = `max(limit/4, 5)`；Redis 恢复后自动回 Redis 桶（无粘滞）；日志只留 hash。
- **C6** key 形态 `user:<id>:<tag>`，**不含** token / 邮箱；不打印明文 key。
- **C7** 监控：`ratelimit.degraded` 计数、Redis `evicted_keys` / `used_memory`、10051 响应计数（灰度期看是否仍在打满）。

## 6. 附带发现（既有缺陷，非本单引入，但与本单直接相关）

`/sync/pull` 收到 **10051 / 90022**（HTTP 200 + 业务码、无 `data`）时，客户端判定为「**空拉取成功**」：

- 判据链：`sync-service.ts:930-960` 只识别 10041 与「归一化网络错误」（`data?.data === null` 或 `raw.code` 为字符串），业务码 10051 两者都不命中 ⇒ `inner = data?.data?.data ?? {}` ⇒ 每表 `pending.delete` ⇒ `pullIncomplete = false` + `markMirrorPulled()`；`runFull` 返回 `ok: true`。
- 后果：① 同步状态显示「已是最新」但实际没拉到；② 首次登录撞限流/服务端错误 ⇒ 首拉门通过、用户看到空数据且无报错；③ 用户与 PM 都**看不到限流发生过**。
- 对照：push 侧安全（无 `results` ⇒ 每条 `unconfirmed` + 业务退避，**不出队**，`sync-service.ts:1400-1430`）。
- 建议：**本单同批修**（客户端加「业务码非 0 且无 data ⇒ 失败」判定 + 用例），或 PM 立 DEF 单独立项。否则改完限流维度也**观察不到成效**（无法区分「没打满」与「打满了但被吞」）。

## 7. 参考来源

- 服务端 `interfaces/middlewares/rateLimit.go:14-45`（`UserRateLimiter`，注释即要求挂 `JWTValidator` 之后）· `:47-65`（IP 版）· `interfaces/routers/syncRouter.go:16-17`（现链序）· `interfaces/routers/routers.go:118-123`（头像先例，`avatarRateLimit=120`）。
- 服务端 `infrastructure/persistence/identity/rateLimitRepoImpl.go:37-63`（Lua 原子窗口 + 降级 `limit/4`、下限 5）· `infrastructure/persistence/identity/localFallback.go:39-86`（进程内桶 + sweep）· `infrastructure/persistence/identity/fallback.go`（`keyTag` 哈希日志）。
- 服务端 `application/auth/appImpl.go:222-245`（`Validate` = 验签 + 过期 + `FindByUserIdAndToken`）· `infrastructure/auth/jwt.go:99-120`（HS256 + `jwt.WithValidMethods`）· `infrastructure/persistence/identity/sessionRepoImpl.go:345-370`（**直查 MySQL，无缓存**）。
- 服务端 `interfaces/routers/authRouter.go:19-22`（signin/signup/checkin 各 8/min/IP）· `interfaces/controllers/responser.go:28-30`（`Failure` = HTTP 200 + 业务码）。
- 客户端 `packages/infrastructure/src/persistence-sync/sync-service.ts:930-960`（pull 只识别 10041/网络错误）· `:1000-1010`（`markMirrorPulled`）· `:1400-1430`（push 的 unconfirmed 退避）。
- 部署 `docker-compose.yml`（`redis --maxmemory 200mb --maxmemory-policy allkeys-lru`）。
- 未检索外部来源（内部机制评审，无业界选型需求）。