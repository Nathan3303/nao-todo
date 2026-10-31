# T588 架构评审报告（凭证失效口径收口批）

- 状态：待 PM / 用户裁定（D2 / D3 / D5）· 更新：2026-10-31 · Owner：arch-designer
- 指针：PRD `docs/prds/2026-10-31-credential-coherence.md` · 决策 `docs/adr/2026-10-31-credential-coherence.md`（D1–D7 / 矩阵） · 判据 `docs/reports/T588-credential-coherence-cases.md`
- 口径：**只读**评审（未改源码 / 测试 / 构建配置）；证据 = 静态读码（`codegraph_explore` 原生入口 + `grep -rn` + 行段）；跨仓 `nao-todo-server` 只读；未跑门禁（无代码改动）。

## 一、可行性结论

**有条件可行**：三条硬前提 —— ① W1（口径收口）先行，W2/W3 是其宿主之上的接续；② D2（失效锁库）与 D3（恢复出口）**必须同批**；③ 用户先裁定三项口径（§六）。技术面**不需要服务端改动**，PRD 全部 AC 可达成。

## 二、现状证据（审计 §一/§三 之外的两条新事实）

- **F-1 弱清理胜出的机制**：`apps/desktop/electron.vite.config.ts:49` 把 `@` 指向 `apps/web/src` ⇒ 桌面挂载 `<App/>`（`AppRoot.vue:192` 的 `v-else` 分支）时执行 `apps/web/src/App.vue:6` 的 `useApp()` ⇒ `initRequester` 第二次（`apps/web/src/app.ts:18`）；axios 闭包内的 `onAuthExpired` 与模块级 `latestLatchReset`（`shared/requester/axios.ts:75-84`）**均被后一次覆盖** ⇒ 之后一切请求落到 web 版弱回调（仅 `clearAuthData` + `router.replace`）。桌面完整清理（`AppRoot.vue:78-85`：`revokeOfflineEntry` + `localSession.clear` + `cryptoService.lock` + `safeReplace`）**只剩两条路径**：App 挂载前的请求、以及 `syncService` 的失效监听（`:87`）。⇒ 审计所述「axios 只清 store / sync 清全套」**不是两处手写分叉，而是双初始化的结果**。
- **F-2 `DEF-91` 的阻断点有两处（PRD 只记了一处）**：登录路径 `apps/desktop/.../binding.ts:126`（`ensureUnlocked` 抛 ⇒ 返回「本地数据解锁失败，请检查密码」，`:129`）；冷启动解锁门 `unlock-gate.vue` 的 `doUnlock`（失败文案「密码错误，无法解锁本地数据」，且终态出口只有「重试 / 登出」，而登出会走 `wipeLocalDataOnSignOut` 清库 ⇒ 用户所谓「只能手工清数据」）。两处都必须给出口，只修登录路径会漏。
- **明文姿态证据**：`crypto-service.ts:197` 的 `encrypt` 恒返回 `plain:`，`:207` 的 `decrypt` 对 `plain:` 直返 ⇒ `DEK` 只服务「历史密文」与迁移；`unlock-gate.vue:86` 已按 `isPlaintextMigrationDone` 免密放行 ⇒ F-2 的阻断是**口径没对齐**，不是安全必需。
- **操作日志是独立库**：`shared/requester/operation-log.ts:14` 独立 IndexedDB `nao-todo-operation-log`，不在 `wipeUserData` 的表集（`deletion-service.ts:74`）内 ⇒ 清理矩阵必须单列一行（ADR D2 已列）。

## 三、五候选对比（`DEF-91`；详见 ADR D3 选定）

- **A 账号密码重包**：步骤 = 登录失败页给「用当前账号密码重建本机保险库」+ 二次确认 → 重建；存储/接口 = 无新增（复用 `meta` 的 `${userId}:key-bundle`）、无需服务端；**丢失范围** = 仅未迁移的旧密文（明文姿态下 ≈0，且服务端为镜像权威可重拉）；安全 = 密码已经服务端验证、无新面，但触发 C-51 唯一不可逆开关 ⇒ 必须显式二次确认 + 结构化日志；量级 **1 人天**。
- **B 旧密码无损解锁**：步骤 = 「我曾改过密码」→ 输入旧密码 → 解锁成功后按新密码重包（`changePassword`）；存储/接口 = 无；丢失 **0**；安全 = 需本地尝试计数上限（3 次）+ 退避，避免把 PBKDF2 变成离线爆破助手；量级 **0.5–1 人天**。
- **C 一次性恢复码**：步骤 = 首次 setup 生成 24 位码让用户留存，失效时输入解 DEK 再重包；存储/接口 = `meta` 增 `recoveryWrappedDek` + 设置页可重置；丢失 = 0（前提 = 用户保存了码，**存量用户无码**）；安全 = 等于第二把钥匙，需重生成即旧码失效；量级 **3–4 人天**，**存量零收益 ⇒ 不做**。
- **D 放弃本地保险库并重建**：步骤 = 说明「本机保存的登录密码已过期，将以云端数据重建本机副本」→ 重建 → 进入；存储/接口 = 复用 C-68 一次性自愈（丢弃不可读密文 + 全量重拉），**前置 = C-54 脏队列护栏**；丢失 = 同 A（未迁移密文 + 离线未同步且密文的行）；安全 = 同 A；量级 **1.5 人天**（含护栏）。
- **E 按 DEK 必要性分流（新增，推荐为默认）**：步骤 = **用户零操作** —— `isPlaintextMigrationDone` 为真时解锁失败只降级（结构化日志 + 用新密码重建包），不再阻断登录；未迁移库仍阻断并给 B/D 入口；存储/接口 = 无新增（复用既有标记）；丢失 **0**；安全 = 明文数据本就不需 DEK ⇒ 不降低安全性，只失去历史密文可读性（可重拉）；量级 **0.5 人天**。
- **建议组合 = E（默认）+ B（无损首选）+ D（兜底）≈2.5 人天**；A 与 D 在明文姿态下等价 ⇒ 合并实现。⚠️ 一旦未来恢复密文姿态，E/D 的「丢失≈0」结论失效 ⇒ 写入 ADR 限制项。

## 四、连带同步清单（含 Owner）

- `docs/reports/defect-pool.md`：`DEF-90` 行补「真因 = 双初始化致弱清理胜出，见 ADR F-1」；`DEF-91` 行补「阻断点两处（`binding.ts:126` + `unlock-gate.vue`）」；`DEF-92…96` 处置列随 PR 更新 → **PM**。
- `docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md`：C-51 补「失效路径保留 `key-bundle`，仅 D3 重建出口可删（二次确认）」；C-52 补「会话失效为第四种语境：只清身份键、不清库」；C-62 补注「离线进入判据不含 `isUnlocked`」 → **PM**（该篇 Owner 非 arch，本单不改）。
- `docs/prds/2026-10-25-desktop-tray-autostart.md` AC8：口径改「各类失效（含被动 `10041`）均可见，且区分类别」 → **PM**。
- `docs/adr/README.md`：本单已追加索引行 + 篇间关系注（↔ WEB-OFFLINE） → 已完成。
- 文案与视觉：登录页横幅 3 类文案（`expired` / `signed-in-elsewhere` / 通用）须走「说人话」红线（禁 `10041`/`stale`） → **PM + rd-fe**。
- `docs/tasks-state.md` 台账与发布说明 → **PM**。
- 移动端验证：`error-classification.ts` 新增导出**零引用**（`presentation-react` 仍只用 `isCredentialError`）⇒ W1 需跑移动端构建确认未破 → **rd-fe**。

## 五、实施顺序与拆分建议

- **W1 口径收口（P1，≈2.5 人天，无依赖，先做）**：D1 + D2 + D4 + D6 ⇒ 关闭 `DEF-90/93/94`；产出 `shared/requester/auth-expiry.ts`、`apps/web/src/session-end.ts`、分类器扩展、`initRequester` 幂等、`authHeaders` 修复。**W1 是 W2/W3 的宿主**（reason 事件与单点清理）。
- **W2 恢复出口（P1，≈2.5 人天，依赖 W1 + 用户裁定）**：D3（E+B+D），覆盖 `binding.ts` 与 `unlock-gate.vue` 两处。
- **W3 提示形态（P2，≈1 人天，依赖 W1 + 用户裁定）**：D5 横幅 + `sessionStorage` reason。
- **W4 小项（P3，≈0.5 人天，可与 W2/W3 并行）**：D7（`DEF-95`/`DEF-96`）。
- 顺序理由：W1 不改 UI 也不改数据面语义，风险最低却解锁其余三项断言；W2 与 D2 存在「锁库 × 解锁失败」耦合，必须紧随 W1；W4 与其它无耦合，可同批 PR 内并行。
- qa 用例先行挂 W1（AC1/2/3/6/7 全部可先写红利探针）；全仓门禁按批末一次跑（项目纪律）。

## 六、待拍板

- **用户**：① `DEF-91` 出口选型（推荐 **E+B+D 组合**；C 不做）；② 失效是否锁保险库（推荐 **锁**，前提 D3 同批）；③ 提示形态（推荐 **登录页顶部横幅**；Toast 次选；模态否决）。
- **PM**：④ AC9「功能降级可见」的可见口径（推荐 = 结构化日志 + 主题回退，不弹 UI，避免用技术噪音干扰 C 端）；⑤ 是否要求服务端细分 `10041` 原因码（**推荐不做**：D5 本地 `exp` 推断已够；若做，代价 ≈3–5 人天含跨仓联调与双端兼容窗）；⑥ 失效是否跨标签广播（`applyRemoteSignOut` 已具备等价形态，≈0.2 人天）；⑦ 是否新增静态守卫 `guard:auth-seam`（需改 `package.json`/构建配置 ⇒ 本单未做，建议用「测试内源码扫描」替代，成本 0.1s）。

## 七、未做与限制

- 未跑全仓门禁 / 未做真机（只读评审）；未审计 `DEF-85/87/88/89`（#260 已修）；移动端只做影响面标注（红线）；服务端未开跨仓改动（若 ⑤ 采纳另立单）。