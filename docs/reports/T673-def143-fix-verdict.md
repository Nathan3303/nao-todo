# T673 · `DEF-143` 修法形态定稿（只读评估）

- 状态：**定稿（D1/D2/D6 待 PM 拍板）** · ⛔ 本任务未改任何代码 / 未建分支 / 未 commit / 未 push
- 日期：2026-11-10 · Owner：arch-designer（`T673`）
- 输入：`docs/reports/667-def143-repro-and-criteria.md`（AC-1…AC-13）· `docs/reports/defect-pool.md`（`DEF-143` / `DEF-152`）
- 跨仓只读：`nao-todo-server@730455d`（仅读；工作区另有一处非本面的 `docker-compose.yml` 在制改动，未触碰）
- 产物：本报告 + ADR `docs/adr/2026-11-10-db-failure-not-credential-failure.md`（+ 索引一行）

## 一、结论先行（7 问 7 答）

| #   | 问题                        | 结论                                                                                                                                                                                                                                                 |
| --- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **码型**                    | **HTTP 503 + 响应体 `{"code":50300,"message":"服务暂时不可用，请稍后重试"}`**（唯一推荐）。**否决** `200 + 9002x`，理由见 §三 D1                                                                                                                     |
| 2   | **客户端二次确认（AC-11）** | **不加**。结构性修复在服务端「默认不登出」；客户端计数只是代理指标，且与 AC-10「既有用例不许改」直接冲突                                                                                                                                             |
| 3   | **告警口径**                | 3 条结构化事件（`auth.session_lookup_failed`=error / `auth.credential_rejected`=warn / 访问日志 `status>=500` 自动 error）+ 3 条告警规则（含「5 分钟 distinct(user_id)」）。日志无 token 明文；`DEF-152` 同批用 gorm `ParameterizedQueries: true` 修 |
| 4   | **改动面**                  | 服务端 **10 处文件**（含 2 处测试夹具对齐、1 处孤儿 import 清理），**无 DB 迁移**；客户端 **0 必需**；对外契约变更 **1 处且仅在失败态**                                                                                                              |
| 5   | **回归面**                  | 真失效 4 子场景仍 `10041`（映射按显式哨兵，不按「未知即凭证」）；AC-10 点名的 4 组既有用例 **零改动**；红基线 H1（黑盒）在修复前必红                                                                                                                 |
| 6   | **与 `DEF-152` 批次**       | **同批**（同触发场景 + AC-6 明文要求 + 改动 1 处 + 复用同一实验验收）                                                                                                                                                                                |
| 7   | **工期**                    | **1.5–2 人天**（服务端核心 1.0 / 复跑与门禁 0.4 / 文档与台账 0.2）；可选客户端硬化 +0.5（P3，另议）                                                                                                                                                  |

## 二、证据锚点（结论不是推断）

| 事实                                                                       | 位置                                                                                                                            | 对本决策的作用                                                    |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| DB 错只打 `warning`、返回零值实体                                          | 服务端 `infrastructure/persistence/identity/sessionRepoImpl.go:345-370`                                                         | 折叠起点                                                          |
| 域层把「无效会话」统一成 `ErrSessionNotFound`                              | `domain/identity/service/serviceImpl.go:52-60`                                                                                  | 折叠中段                                                          |
| `Validate` 把任意 error 原样上抛                                           | `application/auth/appImpl.go:222-245`                                                                                           | 折叠末段                                                          |
| 中间件把**任何** error 一律 `10041`（HTTP 200）                            | `interfaces/middlewares/jwtValidator.go:62-83`                                                                                  | **唯一的映射点** ⇒ 改动面极小                                     |
| `Validate` 只被 `JWTValidator` 调用                                        | 全仓 grep 仅 `interfaces/middlewares/jwtValidator.go:66` 一处调用                                                               | 映射改动**不影响任何 controller**                                 |
| 访问日志对 `status>=500` 本就记 `level=error` + `status` + `user_id`       | `interfaces/middlewares/requestLogger.go:55-64`                                                                                 | 5xx 方案**零新增设施**即满足 AC-5/AC-7；业务码方案 status 仍 200  |
| 客户端推送失败三分类把 `httpStatus>=500` 判为 `network`                    | `packages/infrastructure/src/persistence-sync/sync-retry.ts:103-110`                                                            | 5xx ⇒ **服务级暂停**（不消耗队列项 `attempts`、不丢 pending）     |
| 业务类失败走**逐项** `attempts++` 退避（5s→120s）                          | `sync-service.ts:1420-1440` + `sync-retry.ts:13-24`                                                                             | 9002x ⇒ 一次抖动把整条队列推入退避                                |
| 认证分类器对**未知/新增业务码** fail-closed（按凭证类清认证）              | `packages/domain-identity/.../auth-service/error-classification.ts:15-31`（`NETWORK_ERROR_CODES` 白名单）+ `usecase.ts:141-150` | 9002x 在**检入（active）**路径会清认证；`50300` 在白名单内 ⇒ 不会 |
| 拉取成功码白名单 `[90020]`；限流码 `[10051]`                               | `sync-service.ts:361-364`、`1030-1045`                                                                                          | 新码永不进成功白名单 ⇒ AC-3 结构性满足                            |
| `/sync` 限流桶挂在鉴权**之前**（IP 维度 24/min）                           | 服务端 `interfaces/routers/syncRouter.go:18-21`                                                                                 | 故障窗口内 503 也计桶 ⇒ 见 §五 风险 R1                            |
| 移动端 `lynx` 请求器**不看 HTTP 状态**，一律解析 body 并只对凭证码触发登出 | `packages/shared/requester/lynx.ts:76-117`                                                                                      | 503 + JSON 体对移动端等价于业务失败 ⇒ **红线零改动**              |
| axios 对 503 走 reject（不进业务码分类器）                                 | `packages/shared/requester/axios.ts:162-227`                                                                                    | 5xx 不走 fail-closed 认证分类                                     |
| gorm 生产未配置 Logger ⇒ 默认 `Warn` + `ParameterizedQueries=false`        | 服务端 `infrastructure/persistence/dbs/mysql.go:31-33`；gorm `logger.Default`（`logger.go:75-80`）                              | `DEF-152` 成因                                                    |

> 一个必须写清楚的事实：`withMirrorFallback`（读路径 fail-soft 回退镜像）**当前无装配点**（全仓仅定义/导出/注释 3 处命中）⇒ 不能拿「会回退镜像」当 5xx 的安全垫。真正保护我们的是 `sync-retry.ts` 的三分类与 `RequestLogger`。

## 三、逐条结论

### D1 码型：HTTP 503（+ 体 `code=50300`），否决 `200 + 9002x`

**推荐形态**

```text
HTTP/1.1 503
{"code":50300,"message":"服务暂时不可用，请稍后重试"}
```

- `503` 语义 = 「服务当前无法处理该请求（依赖不可用），稍后可重试」（RFC 9110 §15.6.4）。不用 `502`（那是**网关**拿到上游无效响应的语义，§15.6.3）；不用 `500`（会与「代码 bug」混同，告警阈值也不宜混）。
- 体保留项目既有信封（`{code,message}`），`code` 取 **`50300`**：该码在客户端**已是**「网络类」白名单成员（`NETWORK_ERROR_CODES`），且 `isCredentialCode(50300) === false`。
- `message` 用既有 `publicMsgInternal` 原文，**不要**复用 `NETWORK_ERROR_MESSAGE`（「网络错误，请检查您的网络连接」会把服务端故障甩给用户网络，且客户端对归一化网络错误用**文案全等**判定，复用会造成误分类）。
- **不发 `Retry-After`**：三端都不消费，且我们无法承诺恢复时间（宁可不发）。

**为什么不是 `200 + 9002x`（逐条对照）**

| 维度                | `503`                                                                                      | `200 + 9002x`                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 客户端既有分类      | 推送 `classifyPushFailure(≥500) = network` ⇒ **服务级暂停**、`attempts` 不涨、pending 不丢 | `business` ⇒ **逐项** `attempts++`（5s→120s），一次 4.5 分钟抖动把整队列推入退避      |
| 检入（active 投影） | axios 抛错（不进分类器）/ 移动端得 `50300`∈网络白名单 ⇒ **不清认证**                       | 未知业务码 fail-closed ⇒ `clearAuthData()` ⇒ **正是要消灭的后果**                     |
| 监控可辨识          | 访问日志自动 `level=error` + `status=503` + nginx/LB 5xx 面板                              | `status=200`，与成功请求不可区分（`DEF-143` 静默的根因）⇒ **必须新建**日志/计数器     |
| 语义                | 全端点横切条件（鉴权依赖不可用），HTTP 状态就是它的正确通道                                | `9002x` 已被 `/sync` 业务码占用（`90021` 参数、`90022` 拉取失败、`90023`…）⇒ 语义撞车 |
| 码表成本            | 零：客户端无需学习新码                                                                     | 需新增并教三端「这不是凭证、也不是成功」，且移动端不可改                              |
| 向后兼容            | 老客户端：axios 系抛错（不登出）；lynx 系解析 body（`50300` 非凭证，不登出）               | 老客户端：`res.code !== 成功码` ⇒ `[null,message]`，也是不登出（此点两者打平）        |

结论：**唯一推荐 503**。`9002x` 唯一优势是「不抛错、走既有元组约定」，但代价是把故障语义塞进 `/sync` 命名空间、并在检入路径保留「清认证」风险，得不偿失。

### D2 客户端二次确认（AC-11）：**不加**

判断：**服务端单点足够**，前提是服务端改成「**只有显式凭证证据才回 10041**，其余一律不登出」（见 D4 的映射规则）。

1. **可辨识性为零**：T667 §3.4 已实测「DB 故障响应体与真实失效**逐字节相同**」⇒ 客户端任何本地计数都是**代理指标**，不是证据。用代理指标保护破坏性动作（清认证），只能在「误登出」与「永不登出」之间摆动。
2. **与 AC-10 硬冲突**：AC-11 的落地必然改写「单次 10041 ⇒ 清认证」这一既有语义 ⇒ 必须动 `AppRoot.test.ts` 的 C-25、`credential-classification.test.ts`、`t596-*`，而 AC-10 明令这些用例**不许改**。
3. **窗口与节奏打架**：拉取节奏 30s，`≤30s 内连续 2 次`要求恰好两次落在窗口内；真失效时用户可能长时间无请求 ⇒ 凑不齐就变成「**真失效永不登出**」（AC-11 自己要求「必须有上限」，等于再造一套超时状态机）。
4. **红线成本**：闸门只能落在 `packages/shared/requester/**`（三端共用）⇒ 触碰移动端验证面，与「移动端不随之改动」姿态冲突。
5. **已有三道同类防线**（陈旧 token 快照 / 检入在途延后 / 轮换宽限，`axios.ts:139-175`）：再叠一层「计数确认」，状态空间过大，回归成本高于收益。

**若未来仍要加（本批不做，形态先记下）**：不做本地计数，改为「被动 10041 ⇒ **主动校验一次**（DB-aware 健康检查或 `/api/user/profile`）⇒ 仍失败才清认证」。这是「服务端语义的二次取证」，不是本地阈值。

### D3 告警口径（AC-5 / AC-6 / AC-7）

**三条结构化事件（logrus JSON，稳定 `event` 键）**

| 事件                               | 级别      | 触发点                           | 字段                                                                                 | 回答什么                                                                             |
| ---------------------------------- | --------- | -------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `auth.session_lookup_failed`       | **error** | 鉴权映射点（D4-6）               | `request_id` `user_id` `path` `reason=infrastructure                                 | unknown` `err`（**原文，含 `dial tcp <host>:3306: ...`，不哈希**）                   | 有多少**次**认证因基础设施失败；`reason` 区分「已知 DB 类」与「未知」 |
| `auth.credential_rejected`         | **warn**  | 10041 分支（新增一行）           | `request_id` `user_id` `path`                                                        | 「过去 5 分钟有多少用户被折叠成凭证失败」——**这句问句直接可数**（正常期量级个位/天） |
| `API 服务器错误`（既有，无需新增） | error     | `RequestLogger`（`status>=500`） | `status=503` `request_id` `path` `user_id`（需把 user_id 在 abort 前写入 ctx，1 行） | 请求级计数 + 归属用户；与 nginx 5xx 面板同源                                         |

**告警规则（纯日志即可，不依赖 Prometheus）**

- **A（P1）**：5 分钟内 `"status":503` 计数 > 0 且期间存在正常流量 ⇒ 依赖不可用（`DEF-143` 场景一等公民）。
- **B（P1）**：5 分钟内 `auth.credential_rejected` 的 **distinct(user_id) ≥ 3** ⇒ 凭证语义疑似被折叠（正常期不该出现批量）。
- **C（P2）**：`auth.session_lookup_failed` 5 分钟计数与 distinct(user_id) ⇒ 直接给「受影响用户数」与「受影响请求数」。

**AC-6 无凭证泄漏**

- 新日志只留 `token_len`（沿用现状），不写 token / 口令 / 完整 Authorization。
- 响应体固定公共文案（`publicMsgInternal`），不回显 SQL/表名/错误串（沿用 SEC-12 口径）。
- **`DEF-152` 同批修**：`dbs/mysql.go` 显式构造 gorm logger，`ParameterizedQueries: true`（参数落成 `?`）+ `IgnoreRecordNotFoundError: true`；保留 `SlowThreshold` 与 `Warn`。验收 = 复跑 T667 实验后 `docker logs | grep -c "eyJ"` = **0**，且 `err=` 原因仍可读。
- 代价明示：慢查询日志从此**没有绑定值**（排障需通过 `request_id` + 业务字段关联）。

### D4 改动面清单（文件级；⛔ 本任务只给规格，不落代码）

**服务端 `nao-todo-server`（10 处，按依赖顺序）**

| #   | 文件                                                                                      | 改动                                                                                                                                                                                                                                   | 契约标记                          |
| --- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1   | `domain/errors/errors.go`                                                                 | 新增哨兵 `ErrStoreUnavailable = errors.New("数据存储暂时不可用")`；**不得**加入 `publicErrSentinels` / `notFoundSentinels`                                                                                                             | 内部                              |
| 2   | `domain/identity/repositories/session.go:12-20`                                           | `FindByUserIdAndToken(...) (*entities.UserSession, error)`（**双返回**）                                                                                                                                                               | **内部接口变更**（domain↔infra）  |
| 3   | `infrastructure/persistence/identity/sessionRepoImpl.go:345-370`                          | `ErrRecordNotFound` ⇒ `(nil, nil)`（「查不到」）；其余错误 ⇒ `(nil, fmt.Errorf("sessionRepo.FindByUserIdAndToken: %w", err))`；**删掉** 363-366 的 Warn（日志上移，避免 AC-7 计数翻倍），连带删 `logging` import（该文件仅此一处使用） | 内部                              |
| 4   | `domain/identity/service/serviceImpl.go:52-60`                                            | `if err != nil { return nil, err }`；`session == nil \|\| !session.IsValid()` ⇒ `ErrSessionNotFound`（**nil 必须前置判**：`IsValid()` 解引用 receiver，nil 会 panic）                                                                  | 内部                              |
| 5   | `application/auth/appImpl.go:222-245`                                                     | `ParseJWT` 失败 ⇒ `fmt.Errorf("%w: %w", domerr.ErrTokenExpired, err)`（**保住 AC-4①，且原因可记日志**，Go 1.25 支持多 `%w`）；会话错误 ⇒ `fmt.Errorf("%w: %w", domerr.ErrStoreUnavailable, err)`；其余不变                             | 内部                              |
| 6   | `interfaces/middlewares/jwtValidator.go:62-83`                                            | 分类映射（见下）；10041 分支加 `auth.credential_rejected` warn；503 分支先 `SetUserId` 再 `FailureByHttpStatus(503, {Code:50300, Message:publicMsgInternal})`                                                                          | **对外契约（失败态）**            |
| 7   | `interfaces/middlewares/jwtValidator_test.go:19-32`                                       | 夹具 `Validate` 返回 `domerr.ErrTokenExpired` 而非 `errors.New("invalid token")`                                                                                                                                                       | 测试夹具（**断言值 10041 不变**） |
| 8   | `interfaces/controllers/userAvatar_http_test.go:32-39`                                    | 同上（`fakeAvatarAuth.Validate`）                                                                                                                                                                                                      | 测试夹具（断言不变）              |
| 9   | `infrastructure/persistence/identity/sessionRepoImpl_integration_test.go:468,496,586,628` | 4 处调用改双返回                                                                                                                                                                                                                       | 测试                              |
| 10  | `infrastructure/persistence/dbs/mysql.go:31-33`                                           | gorm logger：`logger.New(<既有 writer>, logger.Config{SlowThreshold: 200ms, LogLevel: logger.Warn, ParameterizedQueries: true, IgnoreRecordNotFoundError: true})`（`DEF-152`）                                                         | 内部（日志面）                    |

**映射规格（第 6 步，等价伪码）**

```go
if err != nil {
    switch {
    case errors.Is(err, domerr.ErrTokenExpired),
        errors.Is(err, domerr.ErrSessionNotFound):
        logging.Warnf(...)                      // event=auth.credential_rejected（含 user_id/request_id/path）
        controllers.Failure(ctx, types.ResponseData{Code: 10041, Message: "用户凭证验证失败"})
    default:                                    // 含 ErrStoreUnavailable 与「未知」
        reason := "unknown"
        if errors.Is(err, domerr.ErrStoreUnavailable) { reason = "infrastructure" }
        logging.ErrorWithFields(map[string]any{
            "event": "auth.session_lookup_failed", "request_id": ..., "user_id": userId,
            "path": ctx.Request.URL.Path, "reason": reason, "error": err.Error(),
        }, "鉴权依赖失败（不折叠为凭证失效）")
        ctx.Request = ctx.Request.WithContext(iCtx.SetUserId(ctx.Request.Context(), int64(userId)))
        controllers.FailureByHttpStatus(ctx, http.StatusServiceUnavailable, types.ResponseData{
            Code: 50300, Message: "服务暂时不可用，请稍后重试",
        })
    }
    ctx.Abort()
    return
}
```

> **方向性选择（需 PM 知情）**：`default → 503`（**未知也按基础设施失败，不登出**）与今天的「未知 ⇒ 10041」相反。理由：`10041` 是**破坏性指令**（清凭证 + 跳登录 + 撤离线授权），只应由**显式证据**触发；未知错误继续登出等于把本缺陷的类型留在系统里。代价 = 上述两处夹具需改（断言值不变）。

**客户端 `nao-todo`：本批 0 处必需**

- 移动端（红线）**零改动**：lynx 不看状态码、只对 `10041/10042` 触发登出，`50300` 不进凭证集合（`lynx.ts:111`）。
- web / 桌面：`503` 在 axios 走 reject ⇒ 不进业务码分类器、不清认证、不导航、不撤离线授权（AC-8 全满足）。
- 可选硬化（**P3，另卡**）：`persistence-go/identity/{user,auth}-repo-impl` 对**抛出型**传输错误兜底成 `[null, "服务暂时不可用，请稍后重试"]`（当前 profile/checkin/signout 会把 5xx 抛成未捕获 rejection；今天 panic/500 已是同类暴露面）。不属 AC 范围，不影响本批验收。

**迁移**：无（无 schema / Redis key / 协议字段变更）。**需要新依赖**：无（红基线用「死 DSN + `DisableAutomaticPing: true`」构造，不引 sqlmock）。

### D5 回归面与红基线设计

**必须保真的语义（AC-4 / AC-10 零回归）**

| 子场景                 | 判据           | 修复后            | 依据                              |
| ---------------------- | -------------- | ----------------- | --------------------------------- |
| ① JWT 签名/格式非法    | `ParseJWT` err | `200 + 10041`     | 第 5 步 wrap 成 `ErrTokenExpired` |
| ② JWT 过期             | `IsJWTExpired` | `200 + 10041`     | 不变                              |
| ③ 会话行软删           | 查不到         | `200 + 10041`     | 第 3/4 步 ⇒ `ErrSessionNotFound`  |
| ④ token 被轮换（顶号） | 查不到         | `200 + 10041`     | 同上                              |
| ⑤ **DB/连接类失败**    | `dial tcp…`    | **`503 + 50300`** | 第 3/5/6 步                       |

**AC-10 点名的既有用例（⛔ 不许改）**：`apps/desktop/.../AppRoot.test.ts`（C-25）、`packages/domain-identity/.../credential-classification.test.ts`、`apps/web/.../t596-*`；服务端另加 `application/user/update_password_integration_test.go`（改密 ⇒ 其它 token 10041）、`interfaces/middlewares/rateLimit_test.go`（无用户 ⇒ 10041）、`interfaces/controllers/userAvatar_http_test.go`（无效凭证 ⇒ 10041，**仅夹具对齐、断言不动**）。

**红基线（修复前必红，按可信度排序）**

- **H1（主红基线，黑盒）**：`gorm.Open(mysql.Open("root:x@tcp(127.0.0.1:1)/none"), &gorm.Config{DisableAutomaticPing: true})` 造 repo → 挂真实 `JWTValidator` → 合法 JWT 打 `/api/tasks` ⇒ **期望 `503`**。修复前实测形态为 `200 + 10041` ⇒ **行为级必红**（不依赖新哨兵，故能真红）。
- **H2（域/应用层）**：假 repo 返回 `errors.New("dial tcp …: connect: connection refused")` ⇒ `Validate` 期望 `errors.Is(err, ErrStoreUnavailable)`；修复前返回 `ErrTokenExpired` ⇒ 红（需先加哨兵，故列为 H1 的补充证据）。
- **H3（客户端探针，复用 T667 §八 形态）**：真实响应体 `{code:50300}`（HTTP 503）⇒ `onAuthExpired` 调用 **0** 次（今天 10041 探针已证 1 次）⇒ 修复前红。
- **H4（可观测/脱敏）**：复跑 T667 §二 实验 ⇒ `grep -c '"status":503'` = 请求数（±0）、`grep -c "eyJ"` = 0、`auth.session_lookup_failed` 计数 = 请求数。

**AC-3 假绿防护**（既有 T657 机制已覆盖，复验即可）：`503` 不进 `PULL_SUCCESS_CODES`；`mirrorPulledAt` 不前进、`pending` 不删、`markMirrorPulled` 不调用。

**AC-12 自愈**：不变（无粘滞逻辑改动）；复跑取「恢复后 ≤30s、连 3 发 `90020`」。

**AC-13 门禁（服务端 + 客户端各一套，分别报精确数字）**：服务端 `go build ./...` / `go vet ./...` / `go test ./... -count=1` / `gofmt -l` 空 / `golangci-lint v2.14.0`；集成 `go test -tags integration -p 1`；客户端沿用 AGENTS.md「全范围门禁 9 项」。

### D6 与 `DEF-152` 的批次关系：**同批**

1. **同一触发场景**：token 明文只在「DB 不可用 / SQL 出错」时被打出（T667 §六即本缺陷实验现场），拆批等于让修复期的实验再泄一次。
2. **AC-6 明文要求**：判据原文要求「`§六` 的问题须一并修或被显式接受」；同批最省解释成本。
3. **风险方向相反**：本批把该场景从 `warning` 抬到 `error` + 引入告警规则 ⇒ 日志会**被更多人读、更可能外发**，脱敏必须同时到位。
4. **改动极小**：`dbs/mysql.go` 1 处配置；验收与 `DEF-143` 复用同一个「停库 60s」实验。
5. **无实现依赖纠葛**：`DEF-152` 不依赖本缺陷的映射决策，不构成范围扩张（一行配置 + 一条验收断言）。

### D7 工期与拆分（人天）

| 步   | 内容                                                              | 估时    | 可验证判据                              |
| ---- | ----------------------------------------------------------------- | ------- | --------------------------------------- |
| S1   | 上抛链路（1–5 步）+ 中间件映射（第 6 步）+ 夹具对齐（7–9 步）     | **0.6** | H1 由红转绿；4 子场景仍 10041           |
| S2   | 日志三事件 + gorm 参数化（第 10 步）+ `DEF-152` 脱敏验收          | **0.3** | H4：`status:503` 计数一致、`eyJ` 计数 0 |
| S3   | 复跑 T667 实验 ×2（停库 58s + 恢复自愈）+ 全部门禁 + 四子场景实测 | **0.4** | AC-1…AC-13 逐条勾选 + 精确数字回执      |
| S4   | 缺陷池 `DEF-143`/`DEF-152` 收口 + 发版说明 + 文档                 | **0.2** | 台账无悬空项                            |
| 合计 | **1.5–2 人天**（单服务端 / 单会话可完成）                         |         |                                         |

客户端：**0 人天（本批必需）**；若采纳 P3 硬化 +0.5 人天（另卡，含受影响面测试）。

## 四、AC-1 … AC-13 逐条满足方式

| AC                  | 满足方式                                                                                                          | 验收                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| AC-1 不折叠         | 第 2/3/4 步：repo 双返回；「查不到」= `(nil,nil)`、「查失败」= error；零值实体不再代表任何语义（改为 nil 判）     | H1 绿；停库 1 发 `/api/sync/pull` ≠ 10041                              |
| AC-2 码型           | **D1 定稿**：`503 + {code:50300}`                                                                                 | `status=503`，体不含「用户凭证验证失败」                               |
| AC-3 失败语义不漂移 | `50300 ∉ PULL_SUCCESS_CODES`；503 在 axios 抛错、在 sync 走 `network` 分支（不删 pending、不推 `mirrorPulledAt`） | 停库期 `mirrorPulledAt` 不前进；恢复后 pending 完整上送                |
| AC-4 真失效零回归   | 第 5 步把 ①② 显式 wrap 成 `ErrTokenExpired`；③④ 走 `ErrSessionNotFound`；映射只认这两个哨兵                       | 4 子场景各 1 发 = `200 + 10041`                                        |
| AC-5 等级与字段     | 映射点 `error` + `err` 原文（不哈希、不吞原因）                                                                   | 每次故障 1 条 `auth.session_lookup_failed`，`err` 含 `dial tcp …`      |
| AC-6 无凭证泄漏     | 日志只留 `token_len`；gorm `ParameterizedQueries`（`DEF-152` 同批）                                               | `grep -c eyJ` = 0                                                      |
| AC-7 可统计可告警   | 三条事件 + 三规则（§D3）                                                                                          | 停库 6 发 ⇒ 计数 = 6，distinct(user_id) 正确                           |
| AC-8 新码不踢人     | 客户端侧：`50300` 非凭证码；axios reject 不进分类器；lynx 解析 body 不触发登出；不写离线授权撤销                  | H3：`onAuthExpired` 0 次（web + 桌面 + 移动三形态）                    |
| AC-9 窗口内会话可活 | 同上；同步层 503 ⇒ `network` 类 ⇒ 暂停不计数、pending 不删                                                        | 停库 60s：`user_sessions` 行数不变、JWT 不变、恢复首拉 `90020`         |
| AC-10 真失效零回归  | 认证分类器与既有用例**零改动**（D2 的核心理由）                                                                   | C-25 / credential-classification / t596-* / 改密集成 / 限流 / 头像全绿 |
| AC-11 二次确认      | **判定「不加」** ⇒ 该条按「不适用」勾掉（判据原文「仅当 arch 选」）                                               | 评审记录 + ADR §决策                                                   |
| AC-12 无粘滞        | 映射改动不触碰连接池/缓存；恢复即正常                                                                             | 恢复后 ≤30s 内 3 连 `90020`                                            |
| AC-13 门禁与复跑    | S3                                                                                                                | 各门禁 exit 0 + 精确数字 + T667 实验复跑结论                           |

## 五、风险与已知边界

- **R1（新增行为，需 PM 知情）**：修复后故障窗口内客户端会**持续重试**（push 5s→120s 服务级暂停；pull 5s tick）。`/sync` 限流桶按 **IP** 计 24/min 且挂在鉴权**之前** ⇒ 同 IP 三端并发重试（≈36/min）可能先撞 `10051`。这是**既有**限流口径被新重试行为暴露，不是新缺陷；但验收必须**区分 `503` 与 `10051`**（后者同样不清认证）。若 PM 认为不可接受，另卡评估「故障期退避下限拉长」。
- **R2**：未知错误改判 503 ⇒ 真实凭证类的新失败形态若未被列入哨兵，会表现为「抱着死 token 打转」。补偿 = 告警规则 B（10041 峰值）+ 规则 C（未知 reason 计数）。**这是有意选择的失效方向**（宁可少登出，不误登出）。
- **R3**：web/桌面身份域（`profile` / `checkin` / `signout`）仍会把 5xx 变成抛出型错误（今天 panic/500 同形）；不清认证，但可能出现未捕获 rejection 的观感问题 ⇒ P3 硬化另卡。
- **R4**：SSE 侧 `IsSessionValid`（`sessionRepoImpl.go:439-468`）同样吞 DB 错误（返回 `false`）⇒ SSE 会断开重连。当前 SSE **无客户端消费者**，故不在本批；记录为同族边界。
- **R5**：`DEF-152` 修后慢查询日志无绑定值，排障需靠 `request_id` 关联（已在 D3 明示代价）。
- **边界**：本评估只覆盖「鉴权依赖失败」这一路径；`CheckIn` 的 `10022` 语义（DB 失败时仍回「检入失败」= 10022）不在 AC 范围。若 PM 要求一致性，可在同批加「`ErrStoreUnavailable` ⇒ 503」2 行（本报告不纳入工期）。

## 六、对照过的备选模式（⓪ 必做，含不采纳理由）

1. **维持现状（10041 折叠）** —— 适用：无（仅作基线）；代价：全员强制重登 + 静默无告警（已实测 6/6 命中）；**不采纳**。
2. **HTTP 503 + `code=50300`（采纳）** —— 适用：跨端、多客户端族、依赖抖动频繁、监控只认状态码；代价：axios 侧抛错（身份域观感，P3）；**采纳**。
3. **HTTP 200 + 专用业务码 `9002x`（不采纳）** —— 适用：单客户端、无告警诉求、希望零抛错；代价：`9002x` 与 `/sync` 业务码撞车；未知新码在检入路径 fail-closed 清认证；监控仍静默；需教三端新码；**不采纳**。
4. **鉴权缓存 fail-open（DB 不可用时用 Redis 会话缓存放行）** —— 适用：可用性优先级高于撤销时效；代价：`FindByUserIdAndToken` 不走缓存（仅 `IsSessionValid` 缓存且只缓存 valid、TTL 5min）⇒ 需新增缓存读路径 ⇒ 被撤销/被顶号会话在窗口内继续可用（**安全姿态变更**），且 Redis 同故障时退化不可控；**不采纳（本批），另议**。
5. **客户端二次确认（AC-11）** —— 见 D2；**不采纳**。
6. **把 10041 从客户端凭证集合移除** —— 适用：无；代价：真失效后永不登出、`pending` 永久堆积；**不采纳**。

## 七、待 PM 拍板（本报告不自决）

1. **D1 码型**：采纳 `503 + 50300` ⇒ 即**对外契约变更**（仅失败态）。是否授权按此冻结？
2. **D2 二次确认**：确认「不加」（等价于把 AC-11 标为不适用）。
3. **D6 批次**：确认 `DEF-152` 同批（含「慢查询日志失去绑定值」这一可观测性代价）。
4. **D4 方向性**：确认「未知错误 ⇒ 不登出（503）」，即允许两处测试夹具改返回值（断言值不变）。
5. **R1**：故障期重试可能撞 `10051`（IP 桶）是否接受（建议接受，另卡再议退避下限）。

## 八、参考来源

- `docs/reports/667-def143-repro-and-criteria.md` · 访问 2026-11-10 · 复现 6/6、13 条判据、客户端「逐字节等价」结论、token 明文日志观察。
- `docs/reports/defect-pool.md`（`DEF-143` / `DEF-152` 两行）· 访问 2026-11-10 · 事故时间线、定级与验收方向。
- 服务端 `infrastructure/persistence/identity/sessionRepoImpl.go:345-370`、`domain/identity/service/serviceImpl.go:52-60`、`application/auth/appImpl.go:222-245`、`interfaces/middlewares/jwtValidator.go:62-83`、`interfaces/middlewares/requestLogger.go:55-64`、`interfaces/routers/syncRouter.go:18-21`、`infrastructure/persistence/dbs/mysql.go:31-33` · 访问 2026-11-10 · 折叠链路与「唯一映射点」。
- 客户端 `packages/shared/requester/{axios.ts:139-227,lynx.ts:76-117,credential-codes.ts:13}`、`packages/infrastructure/src/persistence-sync/{sync-service.ts:361-364,978-1045,1420-1440,sync-retry.ts:103-110}`、`packages/domain-identity/src/application/usecases/auth-service/{error-classification.ts:15-31,187-220,usecase.ts:141-150}` · 访问 2026-11-10 · 失败分类学（network/business/credential）、成功码白名单、移动端零改动依据。
- [RFC 9110 §15.6.4 503 Service Unavailable](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.4) · 访问 2026-11-10 · 「服务当前因临时过载/维护无法处理请求」⇒ 依赖不可用属该语义。
- [RFC 9110 §15.6.3 502 Bad Gateway](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.3) · 访问 2026-11-10 · 网关语义，本文不采用。