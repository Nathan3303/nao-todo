# 2026-10-22 服务端 CORS 放行「预览域 / 局域网地址」（DEF-80）PRD

> **状态**：**已开工（用户 2026-10-22「允许开工」）** —— 已派 `rd-be`。**Issue**：[nao-todo-server#52](https://github.com/Nathan3303/nao-todo-server/issues/52) · **缺陷**：`DEF-80` · **跨仓**：改动只在 `nao-todo-server`（本文档留在 `nao-todo` 仓作单一来源）。
> **依据**：`T519` 真机验证受阻（`DEF-79` 交付后无法在手机/预览环境验 login 态）⇒ 实测 `OPTIONS https://todobe.nathanao.space/api/ping`：`*.vercel.app` 与 `http://192.168.2.211:<port>` 的 Origin **均无 `access-control-allow-origin`**；`localhost:5173` 与 `todo.nathanao.space` 正常回显。源码：`nao-todo-server/interfaces/routers/routers.go:53-72`（写死 4 条 `AllowOrigins`，`AllowOriginFunc` 整段注释，`AllowCredentials: true`）。
> **硬约束**：不改鉴权/业务逻辑 · 不改 `apps/web`、`apps/desktop` · **不动** `nao-todo-server/docker-compose.yml` 的用户本地改动 · 生产域名放行能力**不得减少**。

## TL;DR

- **做什么**：把服务端 CORS 白名单从「写死 4 条」改为「精确白名单 + 预览域名后缀 + 局域网网段（仅 `APP_DEBUG` 生效）」，让 **Vercel 预览**与**手机局域网直连 dev server** 能正常调 API。
- **给谁**：做验收的开发/测试者（含用户本人真机走查），非终端用户。
- **成功标准**：三个目标 Origin 预检回显精确 ACAO；任何非白名单来源**一律无 ACAO**；线上（`todo`/`todobe`）行为零变化。
- **不做什么**：不放行任意 `*.vercel.app`（只认本项目 team 后缀）；不在生产放开局域网；不引入反向代理/网关方案。
- **为什么做**：预览环境**对登录态功能长期不可用**（预览域永不在白名单），手机真机只能靠临时同源反代（`/tmp` 工具，不入仓、不可复用）。

## 一、问题证据

- **实测矩阵**（2026-10-22，对 `https://todobe.nathanao.space/api/ping` 发预检）：

    - `Origin: https://naotodo-git-feat-217-…-nathan3303s-projects.vercel.app` → **无 `access-control-allow-origin`**
    - `Origin: http://192.168.2.211:5180` → **无 ACAO**
    - `Origin: http://localhost:5173` → `access-control-allow-origin: http://localhost:5173`
    - `Origin: https://todo.nathanao.space` → 回显自身

- **源码**：`interfaces/routers/routers.go:53-72` —— `AllowOrigins` 仅 4 条；`AllowCredentials: true`；`AllowOriginFunc` 被注释（原本可实现前缀/正则判定）；全仓无第二处 CORS 配置。
- **连带事实**：`vercel.app` 在用户网络与本机**均不可达**（curl 超时）⇒ 预览路径目前**双重失效**（网络 + CORS）；本次只解决 CORS 这一层，网络层不在范围内。
- **5 Whys**：① 预览登不上 ← 请求被 CORS 拒；② 为何拒 ← Origin 不在写死白名单；③ 为何写死 ← 上线时只考虑了正式域名；④ 为何没暴露 ← 预览环境此前未被纳入验收（`T519` 首次真机验收才撞上）；⑤ 为何未被纳入 ← 项目验证分工把视觉走查交用户，而用户侧唯一入口就是预览/真机。

## 二、目标指标

- **可核指标 1**：三个目标 Origin（预览域 / 局域网 / 既有正式域）预检**回显精确 ACAO**，逐个实测命中。
- **可核指标 2**：**非白名单来源 100% 无 ACAO**（含「后缀伪装」如 `https://naotodo-x-nathan3303s-projects.vercel.app.evil.com`）。
- **可核指标 3**：线上正式域行为**零回归**（`todo`/`todobe` 回显与改动前一致）。
- **口径缺口（如实记录）**：无 RUM/埋点，指标靠**单测矩阵 + 预检实测**，无线上统计。

## 三、范围 / 非范围

- **范围**
    1. CORS 判定收敛为**单一来源**（一个纯函数 + 常量，可单测），替换现有写死数组。
    2. 放行规则三组：精确白名单（现有 4 条，一条不少）· 本项目预览域后缀 · 局域网网段（**仅 `conf.Conf.Server.Debug` 为真时**生效）。
    3. 表驱动 Go 单测：正例 / 伪装负例 / debug 开关两态 / 端口白名单。
    4. 部署与验证说明（本地 docker 重建 → 预检实测；生产部署由用户执行）。
- **非范围**
    - **任意 `*.vercel.app` 放行** —— 理由：任何 Vercel 用户都能拿到该域名，等于对全世界开放（`AllowCredentials: true` 下尤危险）。
    - **生产环境开放局域网来源** —— 理由：生产无此需求，且扩大暴露面；一律由 `APP_DEBUG` 把关。
    - **`vercel.app` 网络不可达问题** —— 理由：属于网络链路，不是服务端配置；本次无法解决。
    - **改用同源网关/自建反向代理（方案 C）** —— 理由：用户 2026-10-22 明确裁定「不要反代、以后只用 Vercel 测试链」⇒ 临时反代已删除，不再作为备选。
    - **`nao-todo-server/docker-compose.yml` 的用户本地改动（`network: host`）** —— 理由：用户在工作区未提交的私有改动，任何提交不得携带/覆盖。

## 四、用户场景

- **画像**：开发者/用户本人，用一个**非正式域名**（PR 预览域、局域网 IP）打开 Web 端，需要登录并操作真实数据以完成验收。
- **关键路径**：打开预览/局域网地址 → 登录 → 列表加载 → 完成 AC 走查。
- **页面状态清单**
    - 加载：请求发出后不再被浏览器的 CORS 拦截（控制台无 CORS 报错）。
    - 空：空态依赖 API 正常返回（现为 401/CORS 失败）。
    - 错误：CORS 失败时浏览器**不暴露**状态码，仅 "Failed to fetch" ⇒ 这是当前用户看到的现象。
    - 成功：登录 200、列表 200、SSE（`/api/sse/...`）连通。

## 五、业务规则

- **不变量 1（精确回显）**：`AllowCredentials: true` 下**必须回显请求的精确 origin**，禁止 `*`；`AllowOriginFunc` 只能返回布尔，回显由中间件完成。
- **不变量 2（锚定匹配）**：域名匹配必须**锚定整串**（`^…$`）或按主机名逐段比较，禁止 `strings.Contains` / `HasSuffix` 裸判（防 `…vercel.app.evil.com`）。
- **不变量 3（环境隔离）**：局域网网段放行**仅** `APP_DEBUG=true` 时生效；生产（`APP_DEBUG` 非 true）即使配置存在也不放行。
- **不变量 4（白名单只增不减）**：现有 4 条精确来源必须继续放行，且**不得**因新逻辑而依赖 debug 开关。
- **不变量 5（单一来源）**：CORS 判定只允许一处实现；禁止在其他中间件/控制器里再写一份。

## 六、NFRs

- **安全**：放行面必须可枚举（3 组规则）；伪装域名、越权端口、非本项目前缀一律拒绝；不得因本次改动放宽 `AllowHeaders` / `AllowMethods`。
- **性能**：判定为「常量比较 + 少量正则」，每请求开销可忽略；不得为此引入缓存层或外部依赖。
- **兼容性**：Go 1.25 + 现有 `gin-contrib/cors` 版本；不得升级依赖（避免连带回归）。
- **可维护性**：规则以常量/正则集中声明并附注释（为何是这个后缀），便于后续换 team/改名时单点修改。

## 七、AC

- **验证接缝**：`interfaces/routers` 内 CORS 中间件构造 + `httptest` 断言响应头（**不依赖 MySQL/Redis**）—— 由 RD 自测；qa 未参与（D3=A 口径延续）。
- **AC1（主路径）**：Given 既有正式来源（`https://todo.nathanao.space`、`https://todobe.nathanao.space`、`http://localhost:5173`、`http://localhost:5174`），When 发预检，Then 逐个**回显自身精确 origin**，且与改动前一致。
- **AC2（异常 · 伪装）**：Given 伪装来源（`https://naotodo-x-nathan3303s-projects.vercel.app.evil.com`、`https://evil-vercel.app`、`http://192.168.2.211:9999`），When 发预检，Then **均无 `access-control-allow-origin`**。
- **AC3（边界 · 环境）**：Given 局域网来源 `http://192.168.2.211:5173`，When `APP_DEBUG=true`，Then 放行；When `APP_DEBUG` 为 false/未设，Then **拒绝**。预览域来源在两种状态下均放行（与 debug 无关）。
- **AC4（负向闭环 · 预检语义）**：Given 任意被放行来源，When 发 `OPTIONS` 带 `Access-Control-Request-Method`，Then 返回成功状态且 `access-control-allow-origin` = 精确 origin（**非 `*`**）、`allow-credentials: true`；Given 被拒来源，Then 响应**不带** ACAO 头（不得出现 `null`/空串）。
- **AC5（设计一致性）**：CORS 判定收敛为单一函数/常量，全仓无第二处 CORS 配置；规则表附注释说明；`go vet` 与既有风格一致（不引入新依赖、不改 `AllowHeaders`/`AllowMethods` 集合）。
- **AC6（可自动核 · 单测）**：新增表驱动单测覆盖 AC1–AC4 全部矩阵（正例 + 伪装负例 + debug 两态 + 端口白名单），`go test ./...` 全绿；测试用 `httptest`，**不依赖** MySQL/Redis。

## 八、上线闭环

- **本地验证**：`docker compose up -d --build` 重建 → 对 `localhost:3302` 发三组预检 → 手机经局域网/同源反代登录成功。
- **生产发布**：由用户部署（本仓无生产发布流水线）；**部署前必须本地实测通过**，因为生产白名单能力不能降级。
- **回滚**：`git revert` 单个 squash 提交 + 重新部署；CORS 为纯配置，无数据迁移。
- **监控**：沿用现有 `RequestLogger`；`APP_DEBUG` 下可打印被拒 origin（**生产不打**），便于后续排障。
- **降级路径：无**（用户 2026-10-22 裁定「以后只用 Vercel 预览链」⇒ 局域网同源反代**已停用并删除**，不列为长期兜底）⇒ 本单未部署前，真机验收**阻塞等待**，不得以反代替代。

## 九、变更治理

- **流程**：`nao-todo-server` 仓 Issue **#52** → 分支 `fix/52-cors-origins` → PR（squash，**由 RD 执行**，PM 只验收授权）→ 用户部署。
- **版本**：服务端无对外版本号机制（Go 服务），以提交号为准；不涉及 `apps/web` / `apps/desktop` 版本。
- **跨仓留痕**：本 PRD 与 `DEF-80` 记在 `nao-todo` 仓（PM 文档单一来源），代码与 Issue 在 `nao-todo-server` 仓。
- **用户裁定（2026-10-22）**：方案 **A**（`AllowOriginFunc` + 预览后缀 + 局域网网段），非 B（单条 IP）/ 非 C（不改）；并追加：**验证通路唯一化为 Vercel 预览链**（局域网反代停用并删除），故本单是 `T519` 真机验收的**前置**。
- **纪律**：任何提交不得携带 `docker-compose.yml` 的用户本地 `network: host` 改动（路径级暂存）。

## 附录：方案对照（结论）

- **A（采纳）**：可枚举、可单测、一次解决预览 + 真机；代价 = 需维护 2 条正则。
- **B（不采纳）**：单条固定 IP —— 换网/换机即失效，仍需再改。
- **C（不采纳为终态）**：不改服务端 —— 验证永远依赖 `/tmp` 临时反代，不可复用、不可审计。
- **修订**：2026-10-22 初稿（实测矩阵 + 源码定位 + 用户选定 A）。