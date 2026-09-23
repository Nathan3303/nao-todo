# WEB-OFFLINE 阶段一 · 终局验收报告（T111 / QA 独立验证）

- **任务**：T111（qa 全新会话，按 qa 卡 v9 执行）
- **验收对象**：WEB-OFFLINE 阶段一（PRD `docs/prds/2026-09-23-web-offline-stage1.md`，AC1–AC18 共 24 行）
- **验收基线**：HEAD `a29e3e68`（= PM 基线 `631cba41` + 1 个 **docs-only** 提交 `docs/tasks-state.md`；`git diff 631cba41..a29e3e68` 仅 1 文件）｜工作区 **0 改动**
- **方法**：**独立复跑**全范围门禁 + **读断言**（不采信 worker 自述）+ **契约变异验证 M1–M6** + **定向探针**（新缺陷确证）+ 人眼项清单
- **纪律**：**未修改任何实现代码**（全部变异均 **已还原**，工作区最终 0）；唯一仓内产物 = 本报告
- **结论（摘要）**：**门禁全绿（与 PM 基线逐项一致）· 变异 M1–M6 全部如期转红 · AC 存在 1 项数据面未过（新缺陷 NEW-1，P1）+ 2 项口径/产品缺口（NEW-2/NEW-3）** ⇒ **建议：条件发布 —— NEW-1 修复或用户显式接受「离线仅可见状态文案、列表读仍报网络错误」后再单独发版；NEW-2 需 PM/用户拍板是否延后。**

---

## 一、全范围门禁独立复跑（本项目 AGENTS.md「全范围门禁」口径）

| #   | 门禁                                                                              | 独立复跑结果                                                                                                  | 与 PM 基线                       |
| :-- | :-------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ | :------------------------------- |
| ①   | `pnpm exec vp check`                                                              | **rc=0**；`All 1381 files are correctly formatted` + `no warnings, lint errors, or type errors in 1183 files` | ✅ 一致（1381 格式 / 1183 文件） |
| ②   | `pnpm exec vp test --run`（**全仓**）                                             | **rc=0**；**148 文件 passed / 1236 例 passed / 红 0**（Duration 80.76s）                                      | ✅ 一致（148 / 1236 / 0）        |
| ③   | `pnpm run guard:ddd`                                                              | **rc=0**（`[guard:ddd] OK`）                                                                                  | ✅ 一致                          |
| ④   | `pnpm --filter @nao-todo/webapp build`                                            | **rc=0**（✓ built in 14.42s）                                                                                 | ✅ 一致                          |
| ⑤   | `pnpm run desktop:build`                                                          | **rc=0**                                                                                                      | ✅ 一致                          |
| ⑥   | 移动端红线 `git status --porcelain -- packages/presentation-react apps/mobileapp` | **0**                                                                                                         | ✅ 一致                          |

> **复跑口径说明**：`vp test --run` 为**全仓**（非子目录），已报文件数/例数/红数；`vp check` 同时覆盖格式 + lint + 类型。构建仅报 rc（无异常即 0）。全部输出留档 `/tmp/qa-t111/{check,test,ddd,webbuild,desktopbuild}.log`。

---

## 二、逐条 AC 结论（AC1–AC18）

图例：✅ 通过｜⚠️ 部分（断言范围通过，存在缺口）｜❌ 未过｜👁 人眼（jsdom 不可断言）

| AC    | 结论 | 独立核验依据（测试/实现）                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| :---- | :--- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1   | ✅   | `unlock-gate.test.ts`「有 JWT 但无密钥包 ⇒ 直接放行」；`hasBundle=false ⇒ emit('unlocked')`，不渲染密码表单（`unlock-gate.vue:80-87`）。**无密码进入**成立                                                                                                                                                                                                                                                                                                                           |
| AC1b  | ✅   | `unlock-gate.test.ts`「已有密钥包 + 已完成明文迁移 ⇒ 无密码直接进入」：`hasBundle && migrated ⇒ emit('unlocked')`，`unlock()` 零调用；bundle **未删**                                                                                                                                                                                                                                                                                                                                |
| AC2   | ✅   | 登录路径静默迁移：`binding.ts:70-77`（desktop `signIn` 成功 ⇒ `runPlaintextMigration`）；启动门侧 `unlock-gate.test.ts`「未迁移 + 密码点解锁 ⇒ 先迁移再放行」；`plaintext-migration.test.ts` AC2 全库解包 + 完成标记 + `syncQueue.count()===0` + `key-bundle` 未删（C-48/C-51）                                                                                                                                                                                                      |
| AC3a  | ✅   | `plaintext-migration.test.ts` AC3a/3b：混合库续跑完成；第二次运行短路（`ran=false`）⇒ 幂等                                                                                                                                                                                                                                                                                                                                                                                           |
| AC3b  | ✅   | 同文件：`plain:` 直返不抛（`crypto-service.decrypt` 前缀直返）+ 历史密文真解密；同记录**部分字段明文**亦可读（不得整库失败）                                                                                                                                                                                                                                                                                                                                                         |
| AC4   | ✅   | `unlock-gate.test.ts`「未迁移 ⇒ UI 标「待升级」」(`.unlock-gate__pending` 含「待升级」+「跳过迁移」按钮) + 跳过后 `runPlaintextMigration` 零调用；`plaintext-migration.test.ts`「跳过 ⇒ 完成标记未写、`key-bundle` 保留」⇒ 下次冷启动仍显示                                                                                                                                                                                                                                          |
| AC5   | ✅   | `deletion-wipe.test.ts`：清 11 业务表 + `meta`（key-bundle/迁移标记）+ `syncQueue` + `syncCursor`；`nao.deviceId` **保留**；`resumePendingWipe` 崩溃补清（C-53）；localStorage 按键删（未登记键亦清）                                                                                                                                                                                                                                                                                |
| AC5b  | ✅   | 同文件「A→B」：A 的 11 表零残留 + **A 的 `deletionSchedules` 保留** + B 记录不动 + B `key-bundle` 不动；`userId-hard-fail.test.ts` 跨账号不串数据。**注**：「B 从远端重建」属数据面，未单测断言（见 §六 遗留）                                                                                                                                                                                                                                                                       |
| AC6   | ✅   | `sign-out-wipe.test.ts`：`countDirty>0` ⇒ 阻塞确认（N + 先同步）；先同步后仍 `>0` ⇒ 二次确认（不可恢复）；取消 ⇒ 不清库；`countDirty` 为权威源（**未读** `pendingCount`，DEF-13）。**注**：`countDirty` 由 mock 构造（不触真实 UI confirm）                                                                                                                                                                                                                                          |
| AC7   | ✅   | `checkin-failure-split.test.ts`（网络/超时/限流 ⇒ **不清**） + `checkin-network-auth-retention.test.ts`（真实 store + JWT/deviceId 保留 + 重试成功；凭证类 10041 ⇒ 仍清）⇒ DEF-5 回归线闭合                                                                                                                                                                                                                                                                                          |
| AC8   | ⚠️   | **文案三态 + 冷启动落盘通过**：`freshness.test.ts`（互斥穷尽；截断 ⇒ incomplete）· `offline-status.test.ts`（「离线模式 · 数据截至 X」+「可能不是最新」+ 负向无 `null`/`Invalid Date`/`1970`；无镜像 ⇒ 引导联网）· `mirror-status-persistence.test.ts`（冷启动读 `meta`，`restoreMirrorStatus` 早于宽限期早退）· `routes.test.ts`（门放行前 await restore）。**❌ 数据面未过**：真实「归一化网络错误」下**不**回退镜像 ⇒ 离线列表报「网络错误」而非显示镜像数据（**NEW-1**，见 §四） |
| AC9   | ✅   | `mirror-fallback.test.ts` AC9（无镜像 ⇒ 空集、不抛、`mirrorPulledAt===null` 区分） + `offline-status.test.ts`（引导联网、不含「数据截至」/「数据丢失」）。**⚠️ 同 NEW-1 影响**：真实链路下无镜像时列表区仍可能先报网络错误（状态条文案正确）                                                                                                                                                                                                                                         |
| AC10  | ✅   | `write-gate.test.ts`（离线 ⇒ 写方法拦截、**原方法零调用** ⇒ 仓储零写入、返回形态一致、可见提示节流）· `write-methods.test.ts`（`signOut`/`signIn`/`checkIn`/迁移不在清单）· `write-gate-wiring.test.ts`（**web-only** 注入 + desktop 负向断言 + desktop 形态透传）· `read-only-banner.test.ts`。清单以探针 §3.3 为唯一真源（不引硬计数）                                                                                                                                             |
| AC11  | ✅   | `userId-hard-fail.test.ts`：`requireCurrentUserId` 三态；**19 项库操作**无会话一律被拒；写操作不落 `userId=''`；跨账号不串且 A 记录未被误改。`MissingUserIdError` 单源 + 11 仓储委托                                                                                                                                                                                                                                                                                                 |
| AC12  | ✅   | **desktop（本仓可断言）**：`csp-meta.test.ts` 逐字断言源 `index.html` 与 `csp-policy.ts` 一致 + `script-src 'self'` 无 inline/eval + `connect-src` 命中 `.env.production`；**独立加验构建产物** `apps/desktop/out/renderer/index.html` 的 `<meta>` = 生产策略且 `ws://localhost` 计数 **0**。**web（不在本仓）**：仅核对部署侧检查单完备性（见 §五）                                                                                                                                 |
| AC13a | ✅   | `def6-mirror-completeness.test.ts` 首组（`pullTimeBudgetMs: 60_000` = 注入充足预算，符合 AC13a 环境限定）：250 行无墓碑 ⇒ `tasks.count()===250` 且 **含最新 id**；时间上界 = fixture 最大 `updatedAt`；`start()` 路径同样补齐。另 `apps/desktop/.../def6-mirror-e2e.test.ts` 走真实 `InitialSyncGate`                                                                                                                                                                                |
| AC13b | ✅   | 同文件「250 活 + 250 墓碑 ⇒ 上界内拉完并推进」+「轮数/时间预算截断 ⇒ **`mirrorPulledAt` 不推进** + `mirrorTruncated=true`」+「门后补齐：`pullIncomplete→resumeBackfill` 最终拉满并推进」（同次会话）⇒ 不谎报                                                                                                                                                                                                                                                                         |
| AC13c | ✅   | 同文件「**服务端 `Total` 非剩余总数 ⇒ 不以 `Total` 判终止**（只用 `items.length < limit`）」；满页续拉 / keyset 不前进立即终止（无死循环）                                                                                                                                                                                                                                                                                                                                           |
| AC14  | ✅   | `def10-bootstrap-order.test.ts`：门已退役替身下 `checkAndCleanExpired('u-1')` 仍被调，且 `invocationCallOrder` **早于** `syncService.start()`；`bootstrap-local-data.test.ts` 顺序 `resumePendingWipe → setCurrentUserId → checkAndCleanExpired`；web `routes.test.ts` 同序断言（DEF-10）                                                                                                                                                                                            |
| AC15  | ✅   | `offline-entry-positive.test.ts`（纯函数正向 ok；原 `locked` 已删）+ `offline-prerequisites.test.ts` + `routes.test.ts` **守卫级正向**（授权 + JWT + 会话一致 + 镜像存在 ⇒ 放行 index）⇒ 非仅拒绝路径（DEF-16）                                                                                                                                                                                                                                                                      |
| AC16a | ✅   | `single-instance.test.ts`（取锁/未取锁/二次启动聚焦）+ **接线实证** `apps/desktop/src/main/index.ts:52-63`（`enforceSingleInstance` 在 `createWindow` 前）⇒ DEF-7 闭合                                                                                                                                                                                                                                                                                                               |
| AC16b | ✅   | `sign-out-broadcast.test.ts`：发起标签投递 `{type,userId,at}`（无 PII）；接收标签清离线授权 + `clearAuthData` + `localSession.clear` + `cryptoService.lock` + `safeReplace('/auth/signin')`，且**不清库**（替身无 `deletionService` ⇒ 若清库即抛）；`profile-updater.test.ts` 发起侧接线；web `main.ts:16` 安装监听                                                                                                                                                                  |
| AC18  | ✅   | `structured-log.test.ts`（字段化信封 + 敏感键替换 + 特征脱敏 + 有界缓冲 200）· `ac18-key-paths.test.ts`（迁移/清库 started/completed + 序列化无任务正文/email）· `bootstrap-local-data.test.ts`（started/completed/failed + 异常上抛 + 无 userId/token）· `def10-bootstrap-order.test.ts`（**desktop 启动路径**经共享收敛点落事件，两端覆盖）· `pull-single-master.test.ts`⑦（sync 路径无 PII）                                                                                      |
| AC17  | 👁    | jsdom 不可断言 → 见 §六 人眼清单（含「设置页明文声明」**疑似缺口 NEW-2**）                                                                                                                                                                                                                                                                                                                                                                                                           |

**AC 汇总**：✅ 21 条｜⚠️ 1 条（AC8）｜👁 1 条（AC17）

---

## 三、契约变异验证 M1–M6（**转红后均已还原**，工作区最终 0）

| #   | 变异（落点）                                                                       | 期望 | 实测（定向 `vp test --run <file>`）                                                                     | 结论  |
| :-- | :--------------------------------------------------------------------------------- | :--- | :------------------------------------------------------------------------------------------------------ | :---- |
| M1  | `sync-status.ts::endRun`：`pullExecuted` 改为由 `lastError === null`（≈ `ok`）反推 | 应红 | `sync.test.ts`：**1 文件 failed / 2 例 failed**（T107c 注销宽限期 + `!userId` 早退两条反向断言）        | ✅ 红 |
| M2  | `desktop/.../binding.ts`：注入 `decorateUseCase: withReadOnlyGuard(...)`           | 应红 | `write-gate-wiring.test.ts`：**1 例 failed**（负向断言 `desktopBinding.decorateUseCase === undefined`） | ✅ 红 |
| M3  | `use-mirror-loaded-count.ts::countMirrorRows`：返回固定 `2000`                     | 应红 | `use-mirror-loaded-count.test.ts`：**2 例 failed**（实际行数 250/200 被固定值替换）                     | ✅ 红 |
| M4  | `local-session.ts::requireCurrentUserId`：`return userId ?? ''`                    | 应红 | `userId-hard-fail.test.ts`：**4 例 failed**（硬失败三态 + 19 项拒绝 + 写不落空用户 + 跨账号）           | ✅ 红 |
| M5  | `sync-service.ts::persistMirrorStatus`：置为空实现（不落盘）                       | 应红 | `mirror-status-persistence.test.ts`：**2 例 failed**（完整拉取落盘 + 截断落盘）                         | ✅ 红 |
| M6  | `deletion-service.ts::wipeUserData`：把 `deletionSchedules` 纳入清库事务并删自身   | 应红 | `deletion-wipe.test.ts`：**1 例 failed**（AC5b「A 的 `deletionSchedules` 保留」）                       | ✅ 红 |

> 变异全部为**临时**改动，逐项 `git checkout`/备份还原；`git status --porcelain` 结束时 = 0。**无变异残留。**

---

## 四、缺陷发现（QA 独立探针确证）

> 按纪律**上报不擅动**：以下均未修改实现代码。NEW-1 建议由 PM 登记入缺陷池后派单。

### NEW-1（P1）web 读路径在「归一化网络错误」下**不回退本地镜像** ⇒ AC8 数据面实质不成立

| 项                 | 内容                                                                                                                                                                                                                                                                                                                                                                                       |
| :----------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **现象**           | web 离线（远端网络类失败）打开后，**列表/详情读路径返回「网络错误，请检查您的网络连接」**，**不显示本地镜像数据**；状态条文案（「离线模式 · 数据截至 X」）正常。⇒ 用户看到「有镜像却读不到数据」                                                                                                                                                                                           |
| **根因**           | `withMirrorFallback` 仅在远端调用**抛出（throw）**时回退；但 `packages/shared/requester/axios.ts` 对 `ERR_NETWORK`/`ECONNABORTED`/`TOO_MANY_REQUESTS` **一律 `Promise.resolve(...)`（归一化为业务码 50300/40800/42900，不 reject）** ⇒ Go 仓储 `res.code !== <成功码>` 时**返回错误元组 `[null, message]`**（非抛出）⇒ 装饰器不进入 catch ⇒ **回退永不触发**                               |
| **影响面**         | `apps/web/src/hooks/usecases/binding.ts` 装饰的 **9 个仓储 × 读方法**（task `get/list`、check-item、comment、project、projectPreference、tag、tagPreference、pomodoro、pomodoroRecord）全部受影响 ⇒ **web 断网刷新「仍可进入」成立，但「显示数据」不成立**（PRD 目标指标 1 / 阶段一⑤「远端优先 + 失败回退」/ C-66）                                                                        |
| **证据**           | 定向探针（真实 `TaskRepoImpl` + 真实本地镜像 + 归一化 `{code:'ERR_NETWORK', data:{code:50300,...}}`，jsdom + 真实 JWT 键）：输出 `PROBE list result = null err = 网络错误，请检查您的网络连接`，断言 `listErr===null` **失败**。探针脚本存 `/tmp/qa-t111/qa-probe-fallback.test.ts`（**未入仓**，运行后已删）                                                                              |
| **测试真实性缺口** | `mirror-fallback.test.ts` 的远端替身用 `throw new Error('Network Error')`（**throw 型**），未复刻生产「resolve 归一化错误」形态 ⇒ 该测试**绿而无效**（未覆盖真实离线形态）                                                                                                                                                                                                                 |
| **建议处置**       | 方案 A（推荐）：`withMirrorFallback` 回退判据扩展为识别「远端返回的归一化网络错误元组」（如 `[null, err]` 且 `err` 属网络类 / 响应顶层 `code` 为 `ERR_NETWORK`/`ECONNABORTED`/`42900`），凭证类（10041/401/403）仍上抛；同时补「resolve 型网络错误」测试。方案 B：改 requester 让 transport 错误 reject（**影响面大，须回架构评审**）。**无论哪种，须补 `mirror-fallback` 的真实形态测试** |

### NEW-2（P2）ADR §4.5 / U-1「用户可见声明」疑未落地（设置页明文声明 / 首次进入告知）

| 项       | 内容                                                                                                                                                                                                                                                                          |
| :------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **要求** | ADR §4.5：**「RS-3 / RS-4 的用户可见声明（设置页 + 首次迁移提示）」**；U-1 签核「全字段明文 + **首次进入明确告知**」；AC17 人眼项含「**设置页明文声明**」                                                                                                                     |
| **现状** | 全仓检索（`apps/web`/`apps/desktop`/`presentation-identity`/locales）**未见**任何明文落盘 / 浏览器驱逐（RS-4）/ `file://` 共享（RS-3）的**用户可见声明**。现有可见文案仅 `unlock-gate.vue` 的「本地数据待升级：需输入密码完成明文迁移」（仅存量密文用户，非「首次进入告知」） |
| **影响** | 不可逆姿态（D-5）下的用户知情面缺失；AC17「设置页明文声明」无法人眼核验                                                                                                                                                                                                       |
| **建议** | PM/用户确认：是否已授权延后（属遗留项）；若否，补设置页声明（三处 locales）+ 新用户首次进入告知                                                                                                                                                                               |

### NEW-3（P3）ADR §5.3 步骤 3「删除 `unlock-gate.vue`」字面未执行

| 项       | 内容                                                                                                                                                                                                                                                     |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **事实** | 解锁门**组件仍存在并仍在 `AppRoot.vue:159` 挂载**（`v-else-if="!unlocked"`）；T105/T105b 将其改造为「无 bundle / 已迁移 ⇒ 自动放行，仅存量未迁移才要密码」。**行为上密码门语义已退役**（AC1/AC1b/AC4/AC15 通过），但「门退役」是**语义退役**而非文件删除 |
| **风险** | ADR 条款字面（步骤 3）与实现不一致 ⇒ 后人按旧条款误判「门未退役 / DEF-10 未迁」。**PM 经 T105b 事实上认可其存续**（要求该组件接 `wipeLocalDataOnSignOut`），但 ADR 未同步该口径                                                                          |
| **建议** | ADR 补一行修订：「门退役 = 密码语义退役（组件保留，供存量未迁移用户一次性迁移入口）」                                                                                                                                                                    |

### 观察项（非缺陷，P3 测试卫生）

- `apps/web/src/views/auth/__tests__/offline-entry-positive.test.ts:31-38` 仍保留 `as unknown as` 桥接 cast，注释称「T104 替换签名后必须删除本 cast」——**签名已替换**，cast 与注释均已过时（不影响断言有效性）。
- AC10「零 `markDirty`」为**间接**断言（写闸门 ⇒ 原方法零调用 ⇒ 仓储零写），无直接「web 写尝试后 `syncQueue.count()===0`」的端到端断言；由零调用 + web 远端写路径推断成立。

---

## 五、AC12 web 部署侧检查单完备性评估（`docs/qa/2026-09-23-web-offline-csp-deploy-checklist.md`）

| 维度             | 评估                                                                                                                                              |
| :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| 响应头策略文本   | ✅ 完整可粘贴；`script-src 'self'`（无 inline/eval）；`style-src` 仅 `'unsafe-inline'`；含 `frame-ancestors 'none'`（仅响应头有效，已在文档标注） |
| 逐项必要性       | ✅ 11 条指令逐项给出必要性（含 `img-src https:` 外链头像 / `blob:` 裁剪；`connect-src` API + SSE）                                                |
| 配置位置         | ✅ Nginx `add_header ... always` + CDN/对象存储（含 SPA fallback 亦须带头）                                                                       |
| 人工核验勾选     | ✅ 8 项（响应头、fallback、控制台零违规、静态资源、登录链路、SSE、外链头像/裁剪、无 `unsafe-eval`）                                               |
| 与真实生产源一致 | ✅ 检查单 `connect-src` 的 `https://todobe.nathanao.space` 与 `apps/web/.env.production` 的 `VITE_BASE_URL` **逐字一致**（已独立比对）            |
| 结论             | **完备**（属部署侧 ops/人眼核验，本仓不可断言；文档已显式声明并给出降级方案）                                                                     |

---

## 六、AC17 人眼清单 + jsdom 不可断言项（**交 PM/用户**）

| #   | 人眼项                                                       | 备注 / 现状                                                                                |
| :-- | :----------------------------------------------------------- | :----------------------------------------------------------------------------------------- |
| 1   | **冷启动无密码进入观感**（加载停顿、是否有密码框闪现）       | 行为已单测（emit unlocked）；「观感/时长」需人眼                                           |
| 2   | **迁移提示文案可读性**（存量用户「本地数据待升级…」）        | `.unlock-gate__pending` 存在；位置/颜色/措辞需人眼                                         |
| 3   | **离线标识可读性**（「离线模式 · 数据截至 X」状态条）        | 文案/负向断言已测；颜色、位置、是否遮挡需人眼                                              |
| 4   | **设置页明文声明（RS-3/RS-4）**                              | **疑似缺口 NEW-2**：全仓未见该声明 ⇒ 需 PM/用户确认是否延后                                |
| 5   | web CSP 实站生效（部署侧）                                   | 不在本仓；按 §五 检查单由 ops/人眼核验（`curl -sI` / 控制台零违规）                        |
| 6   | 真实 Electron/浏览器 IndexedDB 冷启动耗时（Z20，AC13a 基准） | 本报告以「注入充足预算」满足 AC13a 的测试环境限定；真实设备耗时分解（Z20）**未做**，属挂账 |
| 7   | 真实多标签登出观感（AC16b 视觉跳转）                         | 行为/清 store/跳登录已单测；跨标签真实浏览器观感需人眼                                     |

---

## 七、回归线确认（均**不得复发**）

| 缺陷   | 结论      | 依据                                                                                     |
| :----- | :-------- | :--------------------------------------------------------------------------------------- |
| DEF-5  | ✅ 不复发 | `checkin-failure-split` + `checkin-network-auth-retention`（网络类不清 / 凭证类仍清）    |
| DEF-6  | ✅ 不复发 | `def6-mirror-completeness`（>200 行拉满含最新；截断不谎报；门后补齐）+ `def6-mirror-e2e` |
| DEF-10 | ✅ 不复发 | `def10-bootstrap-order`（顺序断言）+ `bootstrap-local-data`                              |
| DEF-16 | ✅ 不复发 | `offline-entry-positive` + `routes.test` 守卫级正向                                      |
| DEF-17 | ✅ 不复发 | 5 项静默写入口补可见反馈（T25，`f650dd39`）；`notifyTaskError` 统一提示                  |
| DEF-19 | ✅ 不复发 | `kanban-view-adapter.vue:20-21` `@restore-task → restore`（非 `delete`）                 |
| DEF-20 | ✅ 已修   | sync 推送日志改计数/枚举（`ac18-key-paths` + `pull-single-master`⑦ 禁 PII 断言）         |

---

## 八、遗留风险

| #   | 风险                                                                                              | 等级 | 说明 / 建议                                                    |
| :-- | :------------------------------------------------------------------------------------------------ | :--- | :------------------------------------------------------------- |
| R-1 | **NEW-1 未修即发版** ⇒ web 离线「有镜像读不到数据」（用户可见错误）                               | P1   | **发布前必修**，或用户显式接受（不建议）                       |
| R-2 | **NEW-2 用户可见声明缺失** ⇒ 不可逆明文姿态下用户知情面缺失                                       | P2   | 需 PM/用户拍板是否延后                                         |
| R-3 | `mirror-fallback` 测试与现实形态不符（throw vs resolve）                                          | P1   | 与 NEW-1 同批修复；否则同类「绿而无效」测试仍有盲区            |
| R-4 | Z18：镜像不含偏好表（`projectPreferences`/`tagPreferences`）⇒ 回退=空而非报错                     | P3   | 已由 PM 接受挂账；两端一致（非端差异）                         |
| R-5 | 真实设备耗时（Z20）/ 真实 Electron IndexedDB 基准环境 未校准                                      | P3   | AC13a 已以「注入充足预算」满足；生产默认 5000ms 预算待实机校准 |
| R-6 | web 驱逐（不申请 `persist()`）+ `file://` 跨目录共享（RS-3/RS-4）为**已接受风险**，但用户声明缺位 | P2   | 同 NEW-2                                                       |
| R-7 | AC10「零 markDirty」为间接断言                                                                    | P3   | 建议后续补 web 写尝试后 `syncQueue.count()===0` 的端到端断言   |

---

## 九、发布建议

**条件发布（Conditional Go）**：

1. **必须**：修复 **NEW-1**（或对 `withMirrorFallback` 补「归一化网络错误元组」回退判据 + 补真实形态测试）；复跑全范围门禁。理由：它直接决定「web 离线可看数据」这一阶段一核心承诺是否成立（PRD 目标指标 1）。
2. **需拍板**：**NEW-2**（明文/驱逐用户声明）——若用户已授权延后，登记为遗留项并在发版说明中明示；否则补齐设置页声明 + 首次进入告知（三处 locales）。
3. **建议**：**NEW-3** 在 ADR 补「门退役 = 语义退役」一行，避免条款漂移。
4. 其余全部 AC（AC1–AC7、AC9–AC16b、AC18）与全部门禁/变异**独立通过**；阶段一实现质量总体达标。
5. 姿态不可逆（D-5）⇒ 阶段一**单独发版**、灰度后观察（沿用既有策略）。

---

## 十、证据索引

| 文件/命令                                                  | 内容                                                                        |
| :--------------------------------------------------------- | :-------------------------------------------------------------------------- |
| `/tmp/qa-t111/gate-summary.log`                            | 门禁六项 rc 汇总（check/test/ddd/webapp/desktop/mobile）                    |
| `/tmp/qa-t111/check.log`                                   | `vp check`：1381 格式 / 1183 文件 0 error                                   |
| `/tmp/qa-t111/test.log`                                    | `vp test`：148 文件 / 1236 例 / 0 红（Duration 80.76s）                     |
| `/tmp/qa-t111/ddd.log`、`webbuild.log`、`desktopbuild.log` | guard:ddd / 双端 build rc=0                                                 |
| `/tmp/qa-t111/qa-probe-fallback.test.ts`                   | **NEW-1 探针脚本**（未入仓；运行输出 `list result = null err = 网络错误…`） |
| 变异备份 `/tmp/qa-t111/*.bak`                              | M1–M6 变异前原件（已用于还原；工作区最终 0）                                |
| `apps/desktop/out/renderer/index.html`                     | 构建产物 `<meta>` CSP = 生产策略、`ws://localhost` 计数 0                   |

---

## 十一、变更记录

| 日期       | 变更                                                                                                                                                        |
| :--------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-23 | 首次成文（T111）：门禁独立复跑（全绿）+ AC1–AC18 逐条 + 变异 M1–M6（全红/已还原）+ **NEW-1/2/3** + AC17 人眼清单 + CSP 检查单评估 + 遗留风险 + 条件发布建议 |