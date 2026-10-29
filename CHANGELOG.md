# Changelog

本仓库为私有 monorepo（root `private: true`，内部依赖 `workspace:*`）。版本策略：功能批次 → minor（root 协同版本 + 实际变更包各自语义化 bump）；发布以注解 tag 记录。历史 PRD 明细见 [docs/prds/](docs/prds/)。

## 机制变更（无版本号） - 2026-10-29

**nao 机制包升级 `@nathan33/nao-skill` `0.19.2 → 0.20.0`**（`M20261029-nao-skill-0200`）：仅机制包与版本标记，**无源码 / 测试 / 构建配置变化**。执行链路：`pi install -l --approve npm:@nathan33/nao-skill@0.20.0`（改 `.pi/settings.json` pin + 物化 `.pi/npm`，`found 0 vulnerabilities`）→ `nao-skill init .`（幂等，**`shim same`**，转发入口零变更）→ `.agents/.nao-version` 写为 `0.20.0`。**体检**：`check: OK · roles=6 · files=50` · 新增第二行摘要 `✓ codegraph 齐备`。**上游行为变化（本版主题 = CodeGraph 三段阶梯）**：① 代码定位口径统一为「**原生入口 `codegraph_explore` → CLI → `grep -rn` + 行段**」，`skills/codegraph.md` 重写（69 行）· ② `nao-fleet.sh` 新增 **`codegraph_state` 四态检测**（未声明 / CLI 缺失 / 无索引 / 齐备，**全部只提示、永不进退出码**；默认不 fork CLI，`-v` 与 `ensure` 才每仓一次 `codegraph status`）· ③ `ensure` 注入 **`CODEGRAPH_TELEMETRY=0`** · ④ tmux 主 pane 默认宽 **35% → 33%** · ⑤ 角色卡版本 bump：PM **v27 → v28** · arch **v12 → v13** · rd-fe **v11 → v12** · rd-be **v11 → v12** · qa **v14 → v15** · rd-infra **v3 → v4**（均只改 codegraph 指针）；`roles.yaml` **未变**、**无破坏性变更**。**本仓现状**：CodeGraph 已恢复可用（`codegraph init` 建索引 1387 文件 / 17,512 节点 / 46,265 边，`.codegraph/` 不入库），`AGENTS.md`「代码结构检索」条由「插件已卸载、只有 grep」改写为三段阶梯 + 索引维护 + daemon / `.pi/APPEND_SYSTEM.md` 边界。**生效注意**：角色卡**启动期注入、不热更** ⇒ 新卡在下次 `ensure` / 会话重开时生效（PM 常驻会话未重启，本条按新纪律实践）。

## 机制变更（无版本号） - 2026-10-28

**nao 机制包升级 `@nathan33/nao-skill` `0.18.4 → 0.19.2`**（`M20261028-nao-skill-0192`）：仅机制包与版本标记，**无源码 / 测试 / 构建配置变化**。执行链路：`pi install -l --approve npm:@nathan33/nao-skill@0.19.2`（改 `.pi/settings.json` pin + 物化 `.pi/npm`）→ `nao-skill init .`（幂等，判定 **`shim same`**）→ `.agents/.nao-version` 写为 `0.19.2`。**体检**：`check: OK · roles=6 · files=50`（0.18.4 为 48）· `pi install` 报 `found 0 vulnerabilities` · 5 个舰队 pi 插件 4 个在（`codegraph` 长期缺失，非本次引入）。**上游行为变化（跨 4 个 minor）**：① **`0.19.0` 破坏性** —— 舰队绑定 tmux + pi（`ensure`/`status`/`close` 仅 tmux 会话内且 `pi ≥ 1.4.0`，非 tmux ⇒ `exit 3`；终端窗口 / `--background` / screen 多宿主阶梯删除，`nao-fleet.sh` 净减约 350 行）· ② `0.18.5` 新增包内扩展 `nao-role-agents.mjs`（角色 → pi-subagents agent 运行时注册，命名 `nao-<role-id>`，逃生阀 `NAO_ROLE_AGENTS=off`）· ③ `0.18.6` 新增 `skills/task-completion.md`（DoD 四类 / **`exit 0` ≠ 完成** / 遗留项三出口 / 分级复盘），回执模板新增 `遗留：` 字段 · ④ `0.19.1` 修 `close` 自 pane 守卫跨 tmux server 撞号误拒 · ⑤ `0.19.2` NOTE 白名单 + PM 根因纪律（含「根因 + 修复方向」派发须附一条已执行实测）。角色卡：PM **v25 → v27**（红线 33 / 清单 41）· rd-infra **v2 → v3**。**本仓现状无行为回退**：已在 tmux 内运行、`pi 1.4.0`、`pi-subagents` 已装、无 screen / `--background` 遗留会话；新增能力需**重启 pi 会话**后加载（角色 agent 注册）。

## 机制变更（无版本号） - 2026-10-21

**nao 机制包升级 `@nathan33/nao-skill` `0.13.0 → 0.18.4`**（`T514`）：仅升级包与版本标记，**无源码 / 测试 / 构建行为变化**。执行链路（官方口径）：`pi install -l --approve npm:@nathan33/nao-skill@0.18.4`（改 `.pi/settings.json` pin + 物化 `.pi/npm`）→ `nao-skill init .`（幂等重写转发入口，本次判定 `shim same`）→ `.agents/.nao-version` 由 `init` 写为 `0.18.4`。**实测结论**：① **shim 生成文本 0.13.0 与 0.18.4 完全一致**（`init` 报 `shim same`，无需改动）；② `AGENTS.md` **未被自动改写**（按 PM 卡 §七 手动合并规则）；③ 机制包文件数 **43 → 48**（`check: OK · roles=6 · files=48`，新增 `common/release-notes.md`、`templates/user-acceptance.md.example`、`templates/pi-subagents` 等）；④ `check` 全绿（文本契约 / 角色卡 frontmatter / 交叉引用 / PR 模板 / tmux 布局）；⑤ 5 个舰队 pi 插件（intercom / ask-me / subagents / web-access / codegraph）均已装。**新能力（本仓暂未使用，供后续参考）**：`ensure --background`（无图形会话显式后台拉起）、`cleanup -S <socket>`（隔离实验场 tmux server，强制显式 socket）、`plugins list|install`、`exec`、`close` 新增「常驻缺席而其派生在场 ⇒ 目标歧义拒绝」闸门、宿主阶梯 BR1（`NAO_TERMINAL` 支持 `tmux|foot|ghostty|ptyxis|screen`）。**顺带清理**：`T511a` 遗留的 `.agents/.nao-version` 未提交改动（`0.12.0 → 0.13.0`）随本次升级正式落地为 `0.18.4`。

## 机制变更（无版本号） - 2026-10-08

**nao 舰队机制迁移到 `nao-skill@0.12.0`（pi 原生包形态）**（`T506` · Issue #188 · PRD `docs/prds/2026-10-08-nao-fleet-0.12.0-migration.md`）：机制不再铺进项目 —— 单一事实来源 = npm 包 `@nathan33/nao-skill` 内的 `.agents/`；项目内 `.agents/` 仅留转发入口 shim（`.agents/scripts/nao-fleet.sh`）+ 项目自有 skill `.agents/skills/nue-ui/`，**pin 版本记于 `.pi/settings.json`（入库，唯一版本权威）**。旧完整性判据（项目内 `.agents/**` 与上游逐字节 sha 一致）已失效，改为「以 pin 的包版本为准」。**无版本号变化**（不改运行行为 / 源码 / 测试 / 构建配置）。迁移前的机制副本备份在本地 `.agents/.nao-obsolete/`（不入库，回滚靠 git 历史 + 本地备份）。

## [v1.14.0] - 2026-10-29

番茄轮次语义批次：**`DEF-112` 修复（静止态圆点显示真实已完成轮次）+ 新增「重新开始本周期」**（`T580`/`T581` · Issue #279 · PR #280 · PRD `docs/prds/2026-10-29-pomodoro-rounds-semantics.md`）：

- **`DEF-112`**（P2，用户实测发现）：`resolveRoundIndicator()` 的 `idle` 分支无条件返回 `filled: 0`，而引擎 `resetToIdle()` 有意不清零 `completedRounds` ⇒ 用户第 3 轮「结束专注」后看到**四个空圈**（像被清零）、再点开始又回到 **第 4/4 轮**。根因 = **上一批 PM 的「验收补正 D11」口径判错**（非实现问题），已在本批 PRD 与缺陷池写明。修复：`filled = completed >= total ? 0 : completed` + `idle` 文案分两档（`pomodoro.rounds.idle` / `.idleProgress`）；`longBreak` 仍 0 实心 +「新周期」。
- **业界形态对齐**：把「中止本次」（`结束专注` / `跳过`，不计数）与「清空整组」（新增独立入口 + 二次确认）分离；依据 = 方法论原文（番茄不可分割 / 被打断则重来 / 4 个番茄后长休）。**不改已发布的 `v1.13.4` 三条行为变更**。
- **新增 `resetCycle()`**：仅一行 `completedRounds.value = 0`（不动阶段 / 任务与模板 / 笔记 / 记录）。入口 `canResetCycle = phase === 'idle' && completedRounds > 0`，`v-if` 不渲染（非 disabled）；`NueConfirm` 文案写明「今天的专注记录不受影响」；取消 / Esc 零副作用。
- **无障碍**：`role="img"` 只包「圆点 + 文案」，入口为兄弟节点原生 `button`（`aria-label` = `title` = 可见文案）。
- **不跳动**：`min-height: var(--nue-box-size-xs)` 与 `.nue-button--small` 的 `height` 同 token ⇒ 960/720 × M∈{4,10} 四组合行高 28px、`timerTop`/`noteTop` 一致（RD 实测）。
- **`confirm.css`**：新增 `.nue-confirm--destructive` → 库自带 error 语义色（仅换引用、不自造色值；类名由库 `theme → ${namespace}--${token}` 动态生成，已核非死代码）。
- **门禁**：`vp check` 0 error（1707 / 1401 文件）· 全仓 **294 文件 / 2580 例 / 0 红** · 五守卫 exit 0 · `webapp build` / `desktop:build` exit 0 · 移动端红线 0。
- **Tag `v1.14.0`** · root / `apps/web` / `apps/desktop` `1.13.4 → 1.14.0`（MINOR，含新能力）；`packages/*` 按近批惯例不单独 bump。**无服务端改动**。详见 `docs/releases/v1.14.0.md`。

## [v1.13.4] - 2026-10-29

番茄钟批次：**通知接入提醒设置 / 页签标题与托盘 tooltip 显示进度 / 轮次指示 / 长休时点修复**（`T573`–`T576` · Issue #274 · PR #275 · PRD `docs/prds/2026-10-29-pomodoro-notify-title-round.md` · ADR `docs/adr/2026-10-29-tray-tooltip-channel.md`）：

- **`#1` 通知接提醒设置**（AC1–AC4）：4 个通知点（专注完成 / 休息即将结束 / 休息结束 / 结束专注）统一走判定 ①②③④ —— ① 读设置失败 fail-open ② **免打扰命中 ⇒ 应用内 `NueMessage` 提示后结束**（**优先于通知开关**，该开关只管辖系统通知）③ `notify === false` ⇒ 全静默 ④ 其余发通知 `silent = !sound`。派发层双层 try/catch，永不抛。
- **`#2` 页签标题 + 托盘 tooltip**（AC5–AC8）：`formatPomodoroTitle` **单函数单源**（`24:59 · 专注` / `04:30 · 休息` / `⏸ 24:59 · 专注`）；按值去重（秒级 ⇒ ≤1 次/秒，**不新增定时器**）；复位值恒为 `NaoTodo`（非空）。桌面新增**单向通道** `ipcRenderer.send` / `ipcMain.on` + 独立常量 `DESKTOP_ONEWAY_CHANNELS`（未并入 `DESKTOP_IPC_CHANNELS`，其「4 个 invoke 通道」断言未动）；载荷 1..64、不受信/非串/超长回基线、六支降级全静默且无 `console.error`；`AppRoot` 走**相对路径**（避开 `@/hooks` 桶在测试环境解析到 webapp 的坑）。
- **`#3` 轮次指示**（AC9–AC12）：圆点组 + 文字（`第 N/M 轮` / `本轮结束后长休` / `休息中 · 已完成 N/M` / `长休息 · 新周期`），三态 = 实心/空心/文字（不只靠颜色），`role="img"` + `aria-label`；仅用既有 `nue-*` token，无新增 token/组件；新增文案中英 13 键齐备。
- **`DEF-111` 修复**：长休时点 off-by-one —— 计数点原在 break 完成、判定在 focus 完成 ⇒ `M=4` 实际第 5 轮才长休。现计数点迁至「**专注自然完成**」，跳过/结束/取消/跳过休息均不计数，长休后周期归零 ⇒ 第 4 轮结束即长休。**行为变更**：跳过与结束不再推进轮次。
- **观察项（登记未改）**：`idle` / `longBreak` 圆点实心虚心固定为 0 ⇒ idle 不显示本周期已完成轮数（进入 focus 恢复）；如需改变须同步用例契约，另批评估。
- **门禁**：`vp check` 0 error（1703 文件格式 / 1400 文件 0 lint·型错）· 全仓 **293 文件 / 2562 例 / 0 红** · 五守卫 exit 0 · `webapp build` / `desktop:build` exit 0 · 移动端红线 0。CI `check` 45s / `test` 2m54s pass。
- **Tag `v1.13.4`** · root / `apps/web` / `apps/desktop` `1.13.3 → 1.13.4`；`packages/*` 有源码改动（presentation / shared），按近批惯例不单独 bump。**无服务端改动**。详见 `docs/releases/v1.13.4.md`。

## [v1.13.3] - 2026-10-27

安全与契约批次：**客户端登出契约 / 凭据不入本地日志 / 检入冲突终态 / 检入在途窗口**（`T558` · Issue #260 · PR #265）：

- **P0-安全 · 凭据不入操作日志**：`packages/shared/requester/operation-log.ts` 原先以 `toClonableData` 原样落库请求体 ⇒ `POST /auth/signin` 的明文口令进 IndexedDB（失败/超时长期保留，实证 7 条历史残留；注册/改密同理）。现按「凭据字段（password/oldPassword/newPassword/confirmPassword/token/jwt/secret/authorization/accessToken/refreshToken，任意深度）+ `/auth/*` 路径」跳过落库，初始化执行 `purgeLegacyCredentialLogs()` 幂等清理历史残留，`replayFailedOperations` 取数面排除凭据记录。
- **P1 · 登出真撤销**：`auth-repo-impl/impl.ts` 原发 `{ token }`（服务端契约字段是 `jwt`）且把 `10031 参数错误` 当成功 ⇒ 服务端会话**从未撤销**。现发 `{ jwt }`、成功码 `10030`、`10031` 判失败；设置页对服务端业务失败给可见反馈（网络类仍静默，离线登出「本地必达」不变）。
- **P1 · 检入冲突终态**：`10022`（服务端 CAS 冲突）原会停在「正在验证用户凭据」永久 loading。现 `settleCheckInConflict`：`isAuthenticated && token` 成立 ⇒ 正常进入应用（深链生效）；不成立 ⇒ 回传 `10022` + 检入页显式终态（重试 / 重新登录）。两条分支均不清凭证、不导航。
- **P1 · 检入在途窗口**：冷启动数据面 `pull` 与检入并发时，旧 token 收到的 `10041` 会被判为真实失效 ⇒ 清凭证回登录页（实机 `remove,remove,set` 已复现）。现 `checkin-window`：检入在途期间其它请求的 `10041` 只记录（`auth.credential.deferred-checkin`），由检入结果裁决；窗口关闭后照旧登出（非永久免死）。
- **可观测**：检入冲突事件接入 `recordShellError('auth:checkin-conflict', …)`（code/phase/reason/outcome + token **仅 8 字符前缀**）。
- **门禁**：`vp check` 0 error · 全仓 **285 文件 / 2462 例 / 0 红** · 5 guard exit 0 · `webapp build` / `desktop:build` exit 0 · 移动端红线 0。
- **配套部署（强依赖）**：登出「真撤销」需要服务端 `nao-todo-server#60`（`c834404`）已部署；**只升级客户端而不部署 #60 ⇒ 点退出仍可能显示成功但会话未撤销**。
- **Tag `v1.13.3`** · root / `apps/web` / `apps/desktop` `1.13.2 → 1.13.3`；`packages/*` 有源码改动（shared / domain-identity / infrastructure / presentation-identity），按近批惯例不单独 bump。详见 `docs/releases/v1.13.3.md`。

## [v1.13.2] - 2026-10-26

发布批次：**番茄「专注记录」页手机适配**（`T548` · Issue #258 · PR #259 · PRD `docs/prds/2026-10-26-pomodoro-records-mobile.md`）：用户报障「手机浏览器打开专注记录页**整页无法下移**、首屏被统计卡占满、看不到记录表格」，读码定位为 `records/table-main.vue` 的 `min-width:760px` + `overflow:hidden` + `nowrap`（无任何 `@media`）与 `records/index.vue` 的 `overflow:hidden` 链（`DEF-31` 家族再现，本轮只修页面层）。**形态**：断点复用既有 720px，窄屏渲染**卡片列表**（同数据源、同筛选/分页状态），桌面表格分支零改动。**用户三轮真机走查裁定**：① 卡片改**单行**（卡高 ≈56px，一屏 6–8 条）② 分页改 `NueButton` small 视觉但**命中区仍 ≥40px**（`AC5` 判据由按钮高度改为命中区）③ 分页箭头**居中** ④ 详情抽屉 ≤480px **全宽**（走 props：`span/min-span=100%` + `allow-close-by-overlay`），并要求 **≥2 条关闭路径（`✕` + `Esc`）**（`R13`/`AC10`）。**红→绿**：qa 用例先行 → 48 例全绿（`+6` 为 AC10）。**门禁**：`vp check` 0 error · 全仓 **279 文件 / 2408 例 / 0 红**（qa `fe44aef5`）· 合并后 main CI `test` **281 文件 / 2421 例 / 0 红** · 5 个 guard exit 0 · 双端 build exit 0 · 移动端红线 0。**合流**：发版前与 `v1.13.1` 热修合流（`80ca75f6`，台账/缺陷池两边记录全保留）。**Tag `v1.13.2`** · root / `apps/web` / `apps/desktop` `1.13.1 → 1.13.2`。详见 `docs/releases/v1.13.2.md`。

## [v1.13.1] - 2026-10-26

热修批次：**桌面端登录后卡在登录页（`DEF-85` / Issue #260，P0）**（`T550` · PR #261 · 审计 `docs/reports/T551-auth-credential-audit.md`）：用户报障「`v1.13.0` AppImage 登录成功提示已出、界面停在登录页（同账号 Web 正常）」。**根因**：桌面 `useDesktopSessionRenewal` 见 token 即 `start()`，而 `signIn` 从未 `recordCheckInAttempt` ⇒ `lastCheckInAt=null` ⇒ **登录瞬间用旧 token 补发 checkin ⇒ 服务端轮换 token ⇒ 旧 token 作废** ⇒ 登录期请求风暴先后拿 `10041` ⇒ 轮换宽限为**单次消费** ⇒ 第 2 个 `10041` 触发 `onAuthExpired` ⇒ 清凭证 + `replace('/auth/signin')`。**五项修复**：① `AuthUseCase.signIn` 成功分支在 `setUserToken` **之前** `recordCheckInAttempt()`（域层单点）② 宽限改 **10s 窗口级**（窗外仍登出，含 `@+11s` 断言；Web 从不 mark ⇒ 零变化）③ 导出 `resetAuthExpiredLatch()` 并在登录/检入成功路径复位闩 ④ 续期 watch 改 `isAuthenticated && token`（冷启动「JWT 在而未检入」不启动，避免与检入页双发）⑤ `safeReplace` 检查 vue-router `NavigationFailure` 返回值 + 可见提示（新增 `common.navigationFailed` zh/en）+ 一次 250ms 重试（`duplicated` 仅记录）。**红→绿**：CI `test` 首推 2 红（`AppRoot.test` C-26：250ms 重试 × 真实定时器）⇒ 经 PM 裁定以「假定时器推进、断言零放宽」修正（`c4c6f536`）⇒ CI 双绿；qa 定向 **19 文件 / 161 例 / 0 红** + 三处变异探针（单次消费 / 记录点后移 / 忽略返回值）均按预期转红。**门禁**：`vp check` 0 error · CI `check` pass 1m0s + `test` pass 2m48s（run `40327785418`）· 5 个 guard exit 0 · 移动端红线 0。**Tag `v1.13.1`** · root / `apps/web` / `apps/desktop` `1.13.0 → 1.13.1`；`packages/*` 有源码改动（`shared` / `domain-identity` / desktop 渲染层），按近批惯例不单独 bump。详见 `docs/releases/v1.13.1.md`。

## [v1.13.0] - 2026-10-26

发布批次：**桌面端托盘常驻 + 开机自启 + 会话续期**（`T542` · Issue #254 · PR #255 · PRD `docs/prds/2026-10-25-desktop-tray-autostart.md` · ADR `docs/adr/2026-10-25-desktop-tray-autostart.md`）：① **关窗口 = 收进托盘**（单 `BrowserWindow` `hide()`、`backgroundThrottling:false` ⇒ 隐藏态 `visibilityState` 恒 `visible`，**提醒引擎零改动**；`close`/`second-instance`/`window-all-closed`/`before-quit`/`query-session-end`/`session-end` 全部接线，含 Windows 关机不被拦住）；托盘菜单**仅两项**「打开 NaoTodo / 退出」，首次关闭发**一次性**系统通知（标记落 `userData`）。② **开机自启**默认开、设置可关，Win/mac 走 Electron 登录项并**回读**判三态（`requires-approval` / 任务管理器禁用 ⇒ 显示「未生效」+ 重试，**不谎报**），Linux 自写 XDG `.desktop`（AppImage 走 `APPIMAGE` + `TryExec`）；托盘不可用/可能不可见时自启**显示窗口**（避免应用完全不可见）。③ **会话续期**（`DEF-15`）：客户端 12h ±10% checkin + 触发补集（启动/唤醒/联网/≥12h）、去抖 5min、退避 1/2/5/15/30min、启动后 60s 内 checkin **恰好 1 次**（不双发）、网络失败**不清凭证**、凭证失败停续期 + 隐藏态系统通知；token 轮换 10s 单次宽限（`TOKEN_ROTATION_GRACE_MS`）防在途 `10041` 自伤登出（**Web 端从不 mark ⇒ 行为零变化**）。④ **服务端会话清理**（`DEF-14`，跨仓 `nao-todo-server#57` → squash `504b917`）：每日 03:10 批量硬删「`expired_at` < now-7d 且未登出」与「`deleted_at` < now-24h」（**两谓词互斥**，500 行/批 ≤20 批共享预算，批间 50ms，**无 DDL**，`SESSION_CLEANUP_ENABLED=false` 可停；已由用户部署生产）。⑤ **设置 UI**：提醒分类下「桌面常驻」块（四态 `已开启 / 可能不显示托盘图标 / 需系统批准 / 不支持`，颜色+符号+文字三重可辨 + 「退出 NaoTodo」+ 说人话文案，新增 12 个 i18n 键）。**红→绿**：qa 红基线 **110 红 → 0**（`lifecycle` 23 · `tray` 14 · `autostart` 21 · `app-settings` 7 · `ipc` 6 · `web-preferences` 7 · `renewal` 19 · `auth-rotation` 11 · i18n 5）。**指标**：双开第二实例 308ms 退出且不建窗 · 托盘资产 1396 B · 运行时依赖 +0 · 主进程新增 ≈500 行。**门禁**：`vp check` 0 error · 全仓 **275 文件 / 2360 例 / 0 红** · 4 个 guard exit 0 · 双端 build exit 0 · 移动端红线 0 · 用户 2026-10-25 手工与视觉验收通过。**已知/未验**：`AC6`（≥48h 不掉登录）为观察项 · Windows/macOS 专属项未在本机验证 · `AC7` 生产侧执行对账待复核 · 休眠/关机期间不送达（唤醒后补弹）。**Tag `v1.13.0`** · root / `apps/web` / `apps/desktop` `1.12.18 → 1.13.0`；`packages/*` 有源码改动（shared / desktop 相关），按近批惯例不单独 bump。详见 `docs/releases/v1.13.0.md`。

## [v1.12.18] - 2026-10-25

发布批次：**正确性与体验小批（排序语义 / 深链优先 / a11y 收尾）**（`T538` · Issue #249 · PR #251）：① **`DEF-11` 优先级排序语义**：`persistence-local/repos/task-repo-impl.ts` 的 `priority` 分支由字符串比较改**语义序**（降序 高→中→低，升序反向），rank **单一来源** = `domain-task` 的 `prioritySNMap`（`low1/medium2/high3`），未知/空串/`urgent` 归 `low` 档（与 `converters.ts` 的 `DEFAULT_TASK_PRIORITY='low'` 同源 ⇒ 与界面显示一致），`null` 保持"恒末"、同档 `return 0` 依赖排序稳定性保序；同时 **`calendar/monthly/calendar-sort.ts` 删除本地 `PRIORITY_RANK` 字面量**改为 import 同一映射（相对序等价、无第二份口径）。② **`DEF-59` 深链优先**：认证守卫改为携带 `query.redirect = to.fullPath`（`/` 与空值不捕获），auth 页落点 **`query.redirect > LAST_VISITED_ROUTE > /tasks`**，非法值走既有回退且不抛错；**中转零 storage 写入**，`LAST_VISITED_ROUTE` 仍由 `router.ts` 的 `afterEach` 在**最终路由**写回（键名与 18 处引用不变；桌面侧不改）。③ **a11y 收尾**：改密表单三输入经 `innerInputRef` 设 `aria-label`（不动 `nue-input`，新增 i18n 键 `settings.passwordConfirm`）；设置 4 个 tab 补 `id` + `aria-controls`，新增 4 个 `role=tabpanel` 面板壳（`aria-labelledby` 回指、非当前 `hidden`、仅当前项渲染内容），`ArrowUp/ArrowDown`（循环）+ `Home/End` 切分类并同步 `aria-selected` 与焦点；窄屏分段分支零改动。**红→绿**：qa 红基线 6 文件 105 例 **10 红 → 0 红**（`routes` 2 · `deep-link-resume` 2 · `settings-ia` 3 · `password-updater` 1 · `local-task-repos` 1 · `calendar-sort` 1）。**已知残留**：窄屏无 tablist 而面板壳 `aria-labelledby` 悬空（P3，留 a11y 批）、tab 未做 roving tabindex（P4）。**门禁**：`vp check` 0 error · 全仓 **266 文件 / 2245 例 / 0 红** · 5 个 guard exit 0 · 双端 build exit 0 · 移动端红线 0 · 用户 2026-10-25 视觉验收通过。**Tag `v1.12.18`** · root / `apps/web` / `apps/desktop` `1.12.17 → 1.12.18`；`packages/*` 有源码改动（infrastructure / presentation-identity / shared），按近批惯例不单独 bump。详见 `docs/releases/v1.12.18.md`。

## [v1.12.17] - 2026-10-25

发布批次：**设置对话框按 4 类重排 + 平铺版式 + 登录设备重做**（`T533` · Issue #243 · PR #245）：① **信息架构** = `account | appearance | reminder | data`（左栏导航 + 右侧面板；15 个行 id 各出现且仅一次，断言以 `data-settings-nav` / `data-settings-category` / `data-setting-id` / `data-settings-zone` 钩子为准）；账户类含 `profile / password / sessions / sign-out / deactivate`，危险区独立容器（退出登录 → 注销账户，各自二次确认），「数据与关于」含只读同步状态行（`mirrorPulledAt` + 与侧栏同一 `formatMirrorPulledAt`）、折叠式本地数据说明（折叠态全文不进 DOM）、版本号 + 「查看更新」外链（`window.open(...,'_blank','noopener')`，桌面经既有 `setWindowOpenHandler`）。② **版式（用户三轮裁定后定稿）**：**R1 平铺**（删除卡片 `border` / `background` / `radius` / 行间 hairline、左栏竖分隔线，改留白 + 标题分级）—— 栏目标题 `--nue-text-lg` 20px/600、类别块间距 44px（窄屏 32px）、标题↔首行 16px、行间距 16px、行高 44px / 控件 40px，危险区 68px 间距 + 错误色标题 + 图标 + 文本四重可辨；顺带修复 `--nue-font-weight-medium` 在主题中未定义导致「标题加粗」失效（实回 400）。③ **R2 左栏简化**：仅图标 + 名称，说明迁至右侧组头（`data-settings-desc` 仅允许出现在面板组头，左栏出现即测试红）。④ **R3 登录设备三段式**（`presentation-identity/session-manager`）：设备图标 + 设备名 + 「当前设备」chip / 地区与 IP / 最近活跃（相对时间）+ 登录于（日期），当前设备**置顶 + `--nue-primary-color-100` 轻底 + 文字 chip** 三通道，项间 12px 无边框；新增相对时间纯函数（`<60s` 刚刚 / 分钟 / 小时 / 24–48h 昨天 / 2–6 天 / ≥7 天回落日期，`Intl.RelativeTimeFormat(numeric:'always')` + `title` 完整时间戳），四态统一 `LoadingError`；设备图标集无浏览器/设备字形 ⇒ 暂用统一 `drive`（映射集中常量，一行可换）。⑤ 密码修改改为**行内展开**（共享 `password-updater` 行为零改动；其三个输入缺程序化标签为既有缺口，另单）。**门禁**：`vp check` 0 error · 全仓 **263 文件 / 2210 例 / 0 红** · 5 个 guard exit 0 · 双端 build exit 0 · 移动端红线 0 · 用户 2026-10-25 视觉验收通过。**Tag `v1.12.17`** · root / `apps/web` / `apps/desktop` `1.12.16 → 1.12.17`；`packages/*` 有源码改动（presentation-identity / shared），按近批惯例不单独 bump。详见 `docs/releases/v1.12.17.md`。

## [v1.12.16] - 2026-10-24

发布批次：**提醒功能补齐（设置区 / 免打扰 / 完成动作 / 信息与权限引导）**（`T529` · Issue #238 · PR #240）：在 `v1.12.15` 已把提醒判定下移本机的基础上补齐**可控性与预期校准** —— ① **设置区**（并入「应用设置」区块，不新增 Tab）：`notify` / `sound` / `quietHours` 三项，单键 `REMINDER_SETTINGS`（身份级）+ `preferences.reminder` 快照跟随账号同步（**服务端零改动**；`buildUserConfigSnapshot` 本地从未设置 ⇒ 省略字段、`isSnapshotEmpty` 以 `'reminder' in snapshot` 判非空、`applyUserConfigSnapshot` 存在性驱动 + `null` 显式清空 + 缺字段不覆盖本地 + 非法值不动，`version` 保持 1）② **免打扰 = 静默排队**：新增 `isWithinQuietHours` 纯函数（单段半开 `[start,end)`、**`start > end` 合法跨天**、`start === end` = 关闭、非法 fail-open、设备本地墙钟）+ 引擎抑制门置于 `collectDueReminders`/`claim` **之前**（门抛错 fail-open）⇒ 时段内**零落账 / 零通知 / 零消费**（`remindAt` 不推进），结束后由既有 10s 轮询 / 可见性补扫**逐条补弹恰 1 次** ③ **弹窗「完成」**（替代被 qa 实证「与确认等价」的「跳过本次」）：成功（写 done + 出队）/ 失败（提示 + 保留）/ 只读（归档类 ⇒ 静默出队），`completing` 防重入 ④ **弹窗信息**：`TaskReminderEvent` 增必填 `projectId` / `remindAt`（引擎 consume 前组装 ⇒ 为本次触发时刻），清单名由装配层注入 `getProjectName`（弹窗零 router/仓储依赖），`remindAt` 早于 `now()` ≥60s ⇒ 标「原定」 ⑤ **权限三态 + 一次性引导**：`sendNotification` 改为返回 `boolean` 且**永不抛**（构造 try/catch，修复「Android Chrome 权限 granted 但构造抛错 ⇒ 已 claim 未 consume ⇒ 永久丢提醒」）；派发层在「未送达 + `granted`」时写**设备级**降级标记（幂等，先查再写）⇒ 设置区 `status = unsupported` + 声音开关置灰 + 说明，刷新/登出仍在；**移除启动自动索权**，改为设置区手势触发；一次性 ack 为设备级 ⑥ **未新增依赖、未新增常驻定时器**（设置每轮扫描读一次，O(1)）。**门禁**：`vp check` 0 error · 全仓 **262 文件 / 2173 例 / 0 红** · 5 个 guard exit 0 · 双端 build exit 0 · 移动端红线 0 · 用户 2026-10-24 手动测试验收通过。**Tag `v1.12.16`** · root / `apps/web` / `apps/desktop` `1.12.15 → 1.12.16`；`packages/*` 有源码改动（shared / infrastructure / presentation-task），按近批惯例随批次不单独 bump。详见 `docs/releases/v1.12.16.md`。

## [v1.12.15] - 2026-10-23

发布批次：**任务提醒改本地轮询（Web + 桌面统一）**（`T524` · Issue #232 · PR #234 · 跨仓 `nao-todo-server#55` / `a4d8850`）：提醒的**到期判定权从服务端 SSE 推送下移到本机** —— 新增 `packages/shared/reminder`（`collectDueReminders` 纯判定 · `nextOccurrence` daily/weekly 位掩码 + monthly 续期 · `claimLedger` 持久去重账本 · `createReminderEngine` 调度/可见性/消费；**端口注入**，不引 `persistence-local`），Web 壳 `apps/web/src/views/index/index-view.ts` 装配，桌面经 webapp 壳复用同一引擎；桌面自有扫描器（`use-local-reminder.ts`）与其独立弹窗装配、`reminder-sse.ts` + 其用例、`shared/hooks/use-sse.ts`、`shared/types/sse.ts`（迁 `types/reminder.ts` 的 `TaskReminderEvent`）、`VITE_DISABLE_SSE`（2 个 `.env` / `csp-policy` 注释 / README ×2 / 接线）**全部下线** ⇒ 单一实现、无双弹。**口径**：可见标签页 10s 轮询（单一常量）+ 最近一条精确定时（提前 100ms），隐藏停轮询、`visibilitychange/focus/online` 补扫（≤2s），冷启动补弹 ≤30s；键 = `taskId@remindAt`，**展示前落账 → 通知 → 展示后消费**（一次性清空 `remindAt`，重复提醒推进下一次，越过 `endAt` 终止）；活跃态过滤对齐 ADR `2026-09-21` D1（排 deleted / archived / givenUp / done、**不过滤子任务**，修正桌面旧实现漏弹子任务与误弹已完成）；跨标签 `navigator.locks`（`ifAvailable`）+ 异常降级 CAS，账本存储不可用（隐私模式 / 配额满）⇒ 内存账本、唯一性降级「同标签内一次」（已知限制）；候选查询不经 `list()`（默认只取顶层 + 不排 done + 全表解密）⇒ 新增 `task-reminder-candidates.ts` 直读明文列粗筛、**只解密到期行**。**AC9 补齐**：`viewDetail` 由注释空实现改为经 props `onOpenTask` 注入（不引 router），`sendNotification` 两处补 `onClick`（聚焦 + 开详情）。**F1（验收期发现）**：冷启动首条补弹可能因弹窗异步加载未注册被 `DialogManager` 丢弃而键已落账 + 已消费 ⇒ 永久不再出现；修法 = 引擎启动移到 `isLoading=false` 之后 + `await nextTick()`（含卸载守卫）+ `presentation/task/components/dialogs/reminder/index.ts` 改**静态导出**（注册与 `app-dialog-adapter` 同一次 flush；体积 task chunk +2,880 B / gzip +924 B、异步 chunk 3,428 B 消失、全量 JS −514 B、请求数 −1），并加结构断言防回归。**服务端**：`reminder.cronFieldWriteBack`（默认 `false`）停用提醒 cron 的字段改写（保留代码 / 可回滚），`/sse/reminders` 保留但无客户端连接；**回滚须同批**。**门禁**：`vp check` 0 error · 全仓 `vp test` 250 文件 / 2025 例 / **1 红**（`packages/presentation-react` 既有「周起点 + 周六」用例，本单零触碰红线目录，已登记缺陷）· 5 个 guard exit 0 · 双端 build exit 0 · 移动端红线 0。**Tag `v1.12.15`** · root / `apps/web` / `apps/desktop` `1.12.14 → 1.12.15`；`packages/*` 有源码改动（shared / infrastructure / presentation-task），按近批惯例随批次不单独 bump。详见 `docs/releases/v1.12.15.md`。

## [v1.12.14] - 2026-10-22

发布批次：**手机抽屉工具带一行化 + SmartList 标题宽度**（`T522` Issue #225 / PR #228 · `T523` Issue #226 / PR #229）：**T522**：抽屉底部工具带由「同步图标 40×40 / 齿轮 40×40 上下两行（实测 256×93）」改为**用户裁定的形态** —— 同步状态为 content 区**吸底工具带**（`position: sticky; bottom: 0; height: 48px; padding: 0 var(--nue-gap-df)`，实测 256×57 前/48px 后）、**齿轮移入 `nue-footer`** 与 4 个导航图标同排；状态文案复用既有 `sync.*` 键（同步中 / 待推送 N / 失败 N / 上次同步 HH:MM / 从未同步），与 `aria-label` 共用同一 computed，三通道 = 颜色 + 符号（失败断链图标、同步中旋转）+ 文字；`paused && pendingCount === 0` 不再显示「待推送 0」。齿轮 40px 命中盒按用户裁定移除、在 `DESIGN.md` §3 **登记为例外**；抽屉宽度经实测判定**不需加宽**（footer 5 项所需 ≈165px ≪ 256px，逐档扫 240→320 无溢出）。**T523**：`NaoSmartList` 表头职责划分 —— 标题 `flex: 1 1 auto; min-width: 0`、名称 `nowrap + text-overflow: ellipsis` + 原生 `title`、计数 `flex: none`、动作区 `flex: none`；根因 = 两子项原均 `flex: none`（内容定宽）⇒ 溢出被祖先 `overflow-x: hidden` **硬切边**（实测 `scrollW 273 > clientW 221`，无省略号且计数被裁）。**范围扩展**：行内清单名 `.nue-link__content` 补 `nowrap + min-width: 0`（原缺 nowrap ⇒ 折行后被 40px 行高垂直硬切，实测 `sH 36 > cH 18`）。**两处技术陷阱（已加守卫）**：① `:deep()` **必须写在顶层** —— 写进 scoped 嵌套块会被展开成「父选择器 + `[data-v-xxx]` 目标」而**静默失效**；② 断言「框架透传 / 内部类名存在」必须用**真实组件 + 打印实测值**（`nue-button__text` 已核实存在）。**Tag `v1.12.14`** · root / `apps/web` / `apps/desktop` `1.12.13 → 1.12.14`；`packages/*` 中仅 `shared` 有源码改动（`smart-list`），按仓库惯例随批次不单独 bump。详见 `docs/releases/v1.12.14.md`。

## [v1.12.13] - 2026-10-22

发布批次：**移动端抽屉补齐同步状态与设置入口**（`T521` · Issue #221 · PR #223）：移动端（视口 ≤445px）`AppAsideV2` 走 Float 变体（抽屉），该变体此前**既无同步状态也无设置入口** —— `SyncStatusBar` 依赖 `railBottomHost`（仅桌面 rail 绑定）⇒ 抽屉在屏时宿主恒 `null`、整块不渲染；齿轮与 `<app-settings-dialog />` 亦只在桌面 rail。修法：① 抽屉 content 底部新增**工具区**（同步状态在上 + 齿轮在下，SHELL-02 语义）；② 注入点支持 rail/drawer 两变体、**同一时刻仅一个宿主**，`unbind` 带**元素令牌**（旧变体迟到解绑不抢新宿主）；③ 齿轮的打开 / 焦点归还 / 卸载清理收敛为 `use-settings-entry` 单一来源；④ 抽屉内挂载设置对话框（`hostReady` 闸门与 `unbind` 兜底保持）；⑤ 设置对话框 ≤445px 改**三段分段切换**（复用 `segmented-switch`，DESIGN §4.5 单一来源），长标签允许换行不裁字，≤400 档保持定高避免面板塌陷；⑥ `segmented-switch` 新增可选 `size: 'sm'|'md'` 轴（`md` = `--nue-box-size-md` ≈40px，仅用于点击区达标；默认 `sm` ⇒ 日历两处调用零变化），DESIGN §4.5 同步增补「第三个允许轴」并禁止调用处覆盖分段件尺寸；⑦ `DESIGN.md` 新增 §4.6「侧栏变体能力对等」。**返工四轮的真根因（R4，值得记账）**：`<nue-dialog :class="…">` 传入的 class **被 nue-ui 完全丢弃**（组件根为 `Teleport`，`.nue-dialog` 的 class 由 `normalizeClass(['nue-dialog', ...theme])` 重新组装）⇒ R1–R3 的 `.nue-dialog--settings.is-narrow …` **全为死代码**，窄屏始终是 row（Tab 占满行宽、主体被推出视口）。改挂自有 `.sd-body` 后生效；新增三层守卫（运行时落点 / 运行时结构 / 源级选择器前缀）+ **变异自检**（把标识挂回 `<nue-dialog>` ⇒ 4 红）。**用户 2026-10-22 在 iPhone 13 Pro（390px）真机视觉验收通过**。**Tag `v1.12.13`** · root / `apps/web` / `apps/desktop` `1.12.12 → 1.12.13`；`packages/*` 零改动不 bump。前置：PR `#222`（立项文档 `890fe2e9`）+ PR `#223`（代码 squash `443bee97`）。详见 `docs/releases/v1.12.13.md`。

## [v1.12.12] - 2026-10-22

发布批次：**Web 端移动浏览器视口与安全区修复**（`T519` · Issue #217 · 缺陷 `DEF-79`）：用户报障「手机浏览器打开网页版显示不全（顶部刘海遮盖 + 底部超越视口），最后一行被地址栏盖住且滚不到底」。根因（读码）：① 主题 reset 给 `.nue-html` 定 `height:100vh / width:100vw`（大视口），项目补丁 `apps/web/src/themes/variables.css` 只把 `body` 改成 `100dvw / 100dvh` ⇒ **父用静态视口、子用动态视口**；② `html{overflow:hidden}` ⇒ 溢出**既不可见也不可滚**（「永远够不到最后一行」）；③ `apps/web/index.html` 的 viewport meta **缺 `viewport-fit=cover`** ⇒ iOS Safari 下 `env(safe-area-inset-*)` 恒为 `0`（纯 CSS 安全区方案空转）；④ 窄屏（≤400px）贴底抽屉无底部安全边 ⇒ 按钮压手势条。修法：`html` 定为**唯一视口基**（`100dvh`）+ `body` / `#app` 取 `100%`（`box-sizing: border-box`），`@supports not (height:100dvh)` 时恢复 `html{overflow:auto}` 保证**末行可滚到底**（可用性优先于观感）；新增 `apps/web/src/themes/safe-area.css` **集中**四向 `env(safe-area-inset-*, 0px)`（外壳 `body` padding + 覆盖层 `.nue-overlay:not(.nue-overlay--transparent)` 改 `position:fixed; inset:0` 并内缩 —— Teleport 到 popup pool 的弹层不继承 body padding）；窄屏贴底抽屉底部留白 `max(var(--nue-padding-df), env(safe-area-inset-bottom, 0px))`、宽高改用相对覆盖层内容区（`100%`）；收敛残留 `100vh` 加载态（`height="100%"`）；新增**源级防回归测试** `apps/web/src/themes/__tests__/safe-area.test.ts`（6 例，含「全仓 `apps/web/src` 内 `100vh` / `100dvw` 残留 = 0」与 glob 防呆）；`DESIGN.md` §9「安全区与视口基线」成文 + `AGENTS.md` 指针一条。**桌面 / Electron 零变化**：`env()` 恒为 `0`、动态视口高度等于静态视口高度、popup pool 位于 `(0,0)` 且页面不滚动。**用户 2026-10-22 在 iPhone Safari 预览链视觉验收通过**（AC1a/AC1b/AC3/AC5a/AC5b/AC4 全过）。**前置**：`DEF-80`（`nao-todo-server` CORS 不放行预览域 / 局域网 ⇒ 预览环境与真机无法调接口）已修并部署生产（`d7a1af5`，PR `nao-todo-server#53`）。**Tag `v1.12.12`** · root / `apps/web` / `apps/desktop` `1.12.11 → 1.12.12`；`packages/*` 零改动不 bump。前置：PR `#218`（squash `3a896eb7`）。详见 `docs/releases/v1.12.12.md`。

## [v1.12.11] - 2026-10-21

发布批次：**日视图时间轴端点与当前时刻标注**（`T518` · Issue #209 · 缺陷 `DEF-78`）：① **`00:00` 处无刻度线**（`.day-col-lines` 四层 `repeating-linear-gradient` 把线画在**每周期末端** ⇒ `x = 0` 恒 transparent）、**`24:00` 线贴 `.day-scroll` 100% 且 `.day-body` `overflow-x: hidden`** ⇒ 被读作「被裁掉的容器边框」、**末标签停在 `23:30`** 后 6 列（触 `MIN_DAY_COLUMN_PX = 20` 下限时 120px）无任何标注 ⇒ 根因 = **模型无「轴端点」语义**（`build-day-grid.ts` 只描述内部刻度）。修法：`DayGridModel.axisEndpoints`（key/minutes/label/labelIndex）+ 标签文本单一来源 `formatAxisLabel`（端点**不进** `columns` ⇒ 内部刻度零变化）+ `.day-axis-endpoint` 1px 边界线（与内部小时线同粗细、仅以更深颜色区分）+ 端标签 `24:00`（×1/×1.5 沿用 `HH` ⇒ `24`，非交互 `span`、贴轴右端、`padding: 0`）。② **撤销末列 `.is-last-tick` 右对齐保护**（用户验收发现 `23`/`23:30` 整体右偏到刻度线左侧）⇒ 内部标签一律居中，`is-first-tick` 保留 ⇒ ADR `day-view-interaction-contract` **r9**。③ **当前时刻标注**：`.day-now-label`（恒 `HH:MM`，复用既有 30s 时基、不新增定时器，节点恒 1 个）+ `now-label.ts` **纯函数**（轴端点约束 ⊕ 视口约束**取交集**，文本比视口宽时贴左缘；`scrollLeft` 每移 1px ⇒ 偏移 ≤1px）+ **禁 `transition`/`animation`**（与「不得抖动」冲突）+ 文本宽度缓存（`offsetWidth`，失效点 = 文本/档位/切日/resize）。④ **间隔带 `--day-now-band`**（单一来源：定义 1 处、消费 2 处 = `.day-axis-bg` 与 `.day-grid .cal-lanes`；共享 `calendar-grid.css` 零改动 ⇒ 月/周零影响；`segmentStyleInColumns` 的 `topOffset` 仍为 0）⇒ 时刻文本不遮挡任务条、任务条 lane→Y **相对映射不变** ⇒ ADR 轴 **r5/r6/r7**。⑤ **换色**：线/圆点/文本由 `--nue-error-color-60` 统一改 **`--cal-fg`**（浅 ≈12.6:1 / 深 ≈10:1）。⑥ **布局**：全天泳道置顶（`.day-scroll` 顺序 = 泳道 → divider → 列头 → 网格）、「全天」文字标签移除（保留 `data-allday-reason` / `title-suffix`）。⑦ `aside.vue` 周起始文案 `周日/周一` → `日/一`（`calendar.weekday.sun|mon`，英文 `Sun`/`Mon`）。**用户 2026-10-21 视觉勾选确认交付**（9 轮复看 / 10 轮交付，其中 2 轮用户手工改码已纳入 PRD R12/R16）。**Tag `v1.12.11`** · root / `apps/desktop` `1.12.10 → 1.12.11`；`apps/web` `1.12.9 → 1.12.11`（本段首次涉及 web 源码，一并 bump）；`packages/*` 零改动不 bump。前置：PR `#211`（`678267ec`）+ `#212`（`33333ce5`）+ `#213`（`eba70916`）+ `#214`（`62a19323`）+ `#215`（`c04cca04`）。详见 `docs/releases/v1.12.11.md`。

## [v1.12.10] - 2026-10-21

发布批次：**桌面端 mac 打包修复**（`T513` · Issue #201 · 缺陷 `DEF-74`/`DEF-75`/`DEF-76`/`DEF-77`）：① `build.mac` 未配 `icon` ⇒ 产物回退 **Electron 默认图标**（electron-builder mac 默认只找 `buildResources/icon.icns`，实际文件在 `build/icons/mac/icon.icns`）；② CI 打包步显式 `CSC_IDENTITY_AUTO_DISCOVERY: false` ⇒ 找不到证书 ⇒ **整包跳过签名**，且 electron-builder **不会**自动兜底 ad-hoc（只有显式 `identity: "-"` 才签）⇒ Apple Silicon 上 arm64 无有效签名 + dmg 带 quarantine ⇒ Gatekeeper 报「已损坏，无法打开」⇒ **mac 版 0 可用（P0）**。修法三行 = `icon` + `identity: "-"` + `hardenedRuntime: false`（`hardenedRuntime` 默认 `true`，ad-hoc 下会因库校验拒绝 Electron 预签名框架，必须关）；`release.yaml` 新增 mac 打包**自证步**（`codesign` 须 `Signature=adhoc` · `Resources/icon.icns` 与源 sha256 **逐字节一致** · `CFBundleIconFile` · **挂载 dmg 对卷内 `.app` 复检**；任一不满足即 job 红；`spctl` 只打印不作门禁）。**同批 R1（`DEF-77`）**：自证步在 macOS `/bin/bash` 3.2 上因「非 ASCII 字符紧跟 `$var`」被 `set -u` 打死（校验实际已通过、只有成功提示行自杀）⇒ 变量一律 `${var}` + shell 消息纯 ASCII + `export LC_ALL=C`。`release` job 增 `if: github.event_name == 'push'` ⇒ `workflow_dispatch` 变为**只构建不发布**（发布前真机预演用）。**用户裁定（2026-10-21）**：不开 Apple Developer 账号 ⇒ **A 档（Developer ID + 公证）单独立项挂起**，当前走 **B 档 ad-hoc**（首次需放行一次）；**x64 / Intel 产物先不补**（`DEF-76`）。**Tag `v1.12.10`** · root / `apps/desktop` `1.12.10`；`apps/web` 与 `packages/*` 本段零改动，不 bump。前置：PR `#202`（`a483554d`）+ PR `#203`（`05f15b63`）；真机自证 run `39554313782` 三平台全 success。详见 `docs/releases/v1.12.10.md`。

## [v1.12.9] - 2026-10-13

发布批次：**T512 视觉走查定稿 + 分段选择复用文档**（`T512b`：① 用户亲手微调的侧栏布局定稿 —— 视图切换移出 `.view-switch-row` 独立成行、行内重排（周起始 + 两开关）、`.weekstart-row` 高 = `--nue-box-size-df`、标签色 `--nue-primary-color-700`、移除分段底距规则；模板恢复 `weekstart-label` 类 ⇒ 模板 / CSS / 测试三方一致、行为断言未删）② DESIGN.md 新增 **§4.5「分段选择（segmented-switch）」复用范围** + §8 检查清单条目 —— 后续同类「分段多选一」UX 一律复用、防样式漂移）。**Tag `v1.12.9`** · root / `apps/web` / `apps/desktop` `1.12.9`；`packages/shared` 及以下包零改动不 bump。前置：PR `#197`（`f6906342`）+ `#196`（`f2cece52`）+ `#198`（`ea96aaec`）。详见 `docs/releases/v1.12.9.md`。

## [v1.12.8] - 2026-10-13

发布批次：**日历侧边栏「周起始」选择 UI 对齐「日/月/周」分段切换**（`T512`：抽出通用「分段切换」展示件 `segmented-switch.vue`（N 段等分 + 滑块指示器 `calc(100%/N)` + `translateX` 整段平移 + `prefers-reduced-motion` 降级 + `role="group"`/每段 `aria-pressed`；仅既有 `nue-*` token、零 `--cal-*`）—— 单一来源防两处样式漂移；「日/月/周」视图切换 `segmented` 态改引通用件（3 段铺满，外观与行为零变化，既有行为断言一条未删）· 侧栏「周起始」改引通用件（2 段自适应、标签在左，`weekStart` 驱动 + `setWeekStart`）· i18n 新增 `calendar.weekStart` / `calendar.sunday` / `calendar.monday` 3 键三处齐备（顺带修掉英文界面显示中文的既有小缺口））。**Tag `v1.12.8`** · root `1.12.8` · `apps/web` / `apps/desktop` `1.12.8` · `packages/shared` `1.4.6 → 1.4.7`（新增 3 个 i18n 键）；`packages/presentation` / `packages/infrastructure` / `packages/domain-*` / `packages/presentation-react` / `apps/mobile` 本批零改动，不 bump。前置：立项文档 PR `#192`（`699ee0d7`）+ 代码 PR `#193`（`158b3839`）。详见 `docs/releases/v1.12.8.md`。

### 行为变更（请留意）

- **日历侧边栏「周起始」从描边按钮对改为滑块分段**（`T512`）：与顶部「日 / 月 / 周」切换同一套视觉（槽底 + 浮起指示块 + 选中加粗），点击后滑块平滑移到所选档，日历每周第一天按新口径重排（取值/持久化语义不变）。
- **英文界面补全**（`T512`）：以前「周起始 / 周日 / 周一」在英文界面显示中文，现显 “Week starts on / Sunday / Monday”。

## [v1.12.7] - 2026-10-07

发布批次：**搜索筛选栏细化（四项）**（`T505`：① 全链移除 `includeExcluded`（UI + 引擎 + URL `excluded` + 常用搜索/快捷预置 + 死码 `ROOT_STATUS_VARIANTS_INCLUDED` + 死徽标 + 4 个死键；兼容口径 = **忽略旧字段**，无迁移、无服务端契约变更）· ② 「包含已归档」开关补**可见文字标签 + a11y**（`role="switch"` / `aria-checked` / `tabindex` / Enter·Space / 点文字切换；规避 `NueSwitch` 忽略默认插槽的上游缺口）· ③ 全局 `theme="menu"` 下拉项间隙 `--nue-gap-xs → --nue-gap-2xs`（影响 7 组件 / 11 处）· ④ 筛选触发器改**显示已选名称**（含文字层级：维度名/**分隔符**次级色、已选名称正文色 + `font-weight: 500`；仅既有令牌 ⇒ 明暗自适应、无新色值）（≤2 全显、≥3 前 2 + `+N`、标签色点、超宽省略；维度名与已选之间用**全角冒号「：」**；新增纯展示件 `filter-trigger-label.vue`）+ 优先级短名（仅触发器）· 架构评审：① 有条件可行 · ③ 可行 · 中间态否决）。**Tag `v1.12.7`** · root `1.12.7` · `apps/web` / `apps/desktop` `1.12.7` · `packages/shared` `1.4.5 → 1.4.6`（新增 `task.priority.short.*` 3 键 + 删 4 死键）；`packages/infrastructure` **仅测试文件变更**（按 `T478` 先例不 bump）· `packages/presentation` / `packages/domain-*` / `packages/presentation-react` / `apps/mobile` 零改动不 bump。前置：代码 PR `#183`（`4df168f2`）+ 立项文档 PR `#182`（`9591ce75`）+ 视觉走查补丁 PR `#184`（`5051f04d`）+ PR `#185`（`bb915327`，文字层级）。详见 `docs/releases/v1.12.7.md`。

### 行为变更（请留意）

- **搜索不再能搜到「已删除 / 已放弃」任务**（`T505` ①）：筛选栏的「纳入已删除/已放弃」开关**整条移除**（该开关本就无任何文字，见 `DEF-73`）⇒ 已删除 / 已放弃任务**无 UI 可达**（已登记产品待办：将来如需另立单补入口）。
- **旧链接 / 旧常用搜索的兼容**：URL `?excluded=1` 不再被读取；旧 localStorage 常用搜索里的该字段在 `normalizeQuery` 逐字段构造时**静默丢弃**（不报错、不迁移、读路径不回写）⇒ 用户可见后果 = 「该条件不再生效，其余条件照常」。
- **筛选栏：少了 excluded 开关，归档开关补上文字与键盘可达**：点文字可切换；Tab 可聚焦（`:focus-visible` 描边）；Space / Enter 可切换；开关暴露 `role="switch"` 与 `aria-checked`（随态翻转）。⛔ 未改 `nue-ui` 组件（文字用兄弟元素承载）。
- **全站 `theme="menu"` 下拉项间隙收紧一档**（`T505` ③）：影响任务·标签/清单/内建清单筛选 · 任务侧栏 · 日历月视图排序 · 搜索筛选栏 · 搜索侧栏共 **7 组件 / 11 处**；项高 / 内边距 / 字号 / 圆角**不变**（`nue-collapse theme="menu"` 不受影响）。
- **筛选触发器改显示已选名称**（`T505` ④）：原「维度名 + 裸数字」→「维度名 名称A、名称B」（≤2）/「…、… +N」（≥3）；标签项带色点；优先级维度用**短名**（「优先级 高、中」），**下拉面板项与其它页面仍用「高优先级」等长名**（有锁测试防全局污染）；去掉原「仅计数」`aria-label`（连带删 `search.filter.selectedCount` 死键），可访问名 = 可见文本、保留 `aria-expanded`。

## [v1.12.6] - 2026-10-07

发布批次：**搜索页侧边栏收起 / 展开按钮**（`T504`：搜索页搜索栏左侧新增与全站一致的收起 / 展开入口（复用 `INDEX_VIEW_CONTEXT_KEY.switchDisplayAside` 同一开关，**未新增状态**）· 工具栏行改 flex（按钮定宽 + 输入框占满剩余宽度并垂直居中）· `title` + `aria-label` 随态中英齐备 · 新增组件测试锁定「位置 / 两态 / 负向闭环」；i18n 新增 `common.collapseAside` / `common.expandAside`）。**Tag `v1.12.6`** · root `1.12.6` · `apps/web` / `apps/desktop` `1.12.6` · `packages/shared` `1.4.4 → 1.4.5`（新增 2 个 i18n 键）；`packages/presentation` / `packages/infrastructure` / `packages/domain-*` / `packages/presentation-react` / `apps/mobile` 本批零改动，不 bump。详见 `docs/releases/v1.12.6.md`。

### 行为变更（请留意）

- **搜索页搜索栏左侧新增「收起 / 展开侧边栏」按钮**（`T504`）：行为与任务 / 番茄 / 日历 / 设置页**完全一致**（同一 `switchDisplayAside` 单一真源 ⇒ 左侧栏 `300px ↔ 70px` 图标轨道、搜索子侧栏随之显隐）；按钮**两态恒可见**、图标与提示随态切换。⇒ **用户可见后果**：搜索框左移出按钮空间，**输入区宽度略微收窄、位置右移**；收起侧栏后结果区明显变宽。**不持久化**（沿用现状：进入搜索页默认展开）。

## [v1.12.5] - 2026-09-30

发布批次：**A 组小件批 + 同步「半写」可见 + 任务详情跨视图保留 + 工程清理**（`T465`–`T489`：`aside` 死代码清理（用户裁定底部两按钮永久取消）· `DEF-39` 语义修正（移除把账户状态当角色的 `isAdmin`/`isVIP`）· `DEF-64` 账户按钮归并库语义（`destructive` + `primary`，删除 app 层死覆盖）· `DEF-60` 收窄 0 消费导出 · `DEF-44` **客户端消费 `SyncResult.droppedFields`**（additive 护栏 + 白名单 6 类 + 防漂移双向校验 + 同步面板信息级诊断）· `T473`「记录创建」通知改**多订阅者** · **`DEF-72`** tasks 切换视图类型丢失 `taskId` ⇒ 详情面板被关（`T474` 审计发现、真实 vue-router 实测证伪 ADR 原论断）· `T478` 日期炸弹用例修复（注入/冻结时钟）· 两处 SFC 游离字符清理）。**Tag `v1.12.5`** · root `1.12.5` · `apps/web` / `apps/desktop` `1.12.5` · `packages/infrastructure` `0.8.3 → 0.8.4` · `packages/presentation` `0.8.1 → 0.8.2` · `packages/shared` `1.4.3 → 1.4.4` · `packages/presentation-identity` `1.2.1 → 1.2.2` · `packages/domain-identity` `1.2.0 → 1.2.1`（`apps/mobile` / `packages/presentation-react` 零改动，不动）。详见 `docs/releases/v1.12.5.md`。

### 行为变更（请留意）

- **账户按钮配色统一到主题**（`DEF-64`）：设置页「**注销账户**」由 app 自造实心红改为库标准 `destructive`（**描边**）· 「**恢复账户**」改为 `primary`（恢复属正向操作）；同时**删除 `apps/web/src/themes/button.css` 的两段自造覆盖**（其 `danger` 会顶掉主题 AA）。对比度按**真实弹窗底色**实测：描边 7.39/6.16、`primary` 13.95/9.39。
- **番茄页侧栏底部两按钮下线**（`「新建常用番茄专注」/「查看历史专注记录」`）—— 用户 2026-09-30 裁定**永久取消**；`aside` 相关死代码一并清理。
- **清单「停用」态与番茄钟「归档」态可同步**（服务端 `#45`：`deactivedAt`/`archivedAt` 按既有 `NullableString` **真三态**承载）⇒ **需服务端同步部署**才生效。
- **同步「半写」不再静默**（`DEF-44`）：客户端消费 additive `SyncResult.droppedFields` ⇒ 非白名单字段被服务端丢弃时产生**日志 + 同步面板「错误/诊断」区信息级诊断**（**不阻塞出队**、**不新增与「冲突 N」并列的主徽标**）；**已知不支持的 6 类字段白名单**（`projects`/`tags` 的 `icon`/`sortId`、`pomodoros.totalDuration`、`taskComments.attachments/isTopUp/deletedAt`、`taskCheckItems.deletedAt`、`pomodoroRecords.deletedAt`）不提示；**防漂移用例**以「客户端发送集 − 服务端承载集 === 白名单」**精确相等**双向校验。
- **tasks 切换视图类型保留任务详情**（`DEF-72`）：三处 `switchViewType` 显式透传当前 `taskId`；**共存关键 = `undefined` 省略可选参数段** ⇒ 「切视图保留参数」与「`closeDetails` 仍能清参数」并用例证明。
- **`DEF-39` 语义修正**：移除 `isAdmin: state===1` / `isVIP: state===2`（`state` 实为**账户状态**，`state===1` = 已注销；服务端无 VIP 概念；且全仓 **0 消费**）。
- **`T473` 多订阅者**：「记录创建」通知由**单回调**（后注册覆盖前者、卸载可能误清他人）改为 **多订阅者 + 注销句柄**（快照派发）⇒ 内部健壮性，无用户可见变化。

## [v1.12.4] - 2026-09-30

发布批次：**日历与番茄专注页面优化 + 评论作者显示 + 「今日专注」串数据修复**（`T445`–`T460`：日历子视图切换入侧栏（滑块 Tab）/ 日视图「现在」定位并居中 / 任务条首尾圆角区分 / 接续末端收敛改期入口 · 番茄「今日专注」入侧栏（常展开、两行条目 `compact`、概览固定 + 列表滚动）· 番茄子视图切换不重置任务详情 · 番茄页头部悬浮 · **`DEF-69`** 新增评论作者显示 · **`DEF-71`** 番茄「结束专注」落库 · `getRecords` 读路径误触发「新记录」回调的串数据修复 · 两处 SFC 游离字符清理）。**Tag `v1.12.4`** · root `1.12.4` · `apps/web` / `apps/desktop` `1.12.4` · `packages/presentation` `0.8.0 → 0.8.1` · `packages/shared` `1.4.2 → 1.4.3` · `packages/domain-task` `1.4.0 → 1.4.1` · `packages/infrastructure` `0.8.2 → 0.8.3`（`apps/mobile` / `packages/presentation-react` 零改动，不动）。详见 `docs/releases/v1.12.4.md`。

### 行为变更（请留意）

- **番茄「结束专注」现落库**（`DEF-71`）：此前该按钮不保存记录（**历史数据缺失、不可回填**）；`reset()` 仍为「真取消」。
- **侧栏「今日专注」形态与加载时机变化**：常展开（不再折叠）· 标题行含**今日总时长** · 底部「新建 / 历史」两按钮暂不展示 · 进入番茄页即加载（原为仅计时页）· 仅「番茄专注 / 正计时」两页显示。
- **番茄页头部改悬浮**（`T452`）：仅「番茄专注 / 正计时」，去底边、`absolute` 不占高度、点击穿透；其余子视图头部不变。
- **日历任务条改「圆角区分首尾」**（`T447`）：真实首尾端圆角 4px、接续端直角 + 2px 内缩；**接续末端不再渲染改期触发器**；跨月行边界守卫保留。
- **日历子视图切换器移入侧栏**（`T445`/`T446`）：侧栏滑块 Tab（`segmented`）；**侧栏隐藏时内容区头部保留 `compact` 兜底入口**。
- **日视图按钮「今天」→「现在」**（`T445`）：回今天 + 当前时间线**居中**；月 / 周视图保持「今天」+ 今日高亮。
- **番茄子视图切换不再重置任务详情面板**（`T451`）：`pomodoros/:taskId?`、`records/:taskId?` 补齐可选参数。

## [v1.12.3] - 2026-09-29

发布批次：**组件库与主题升级 + 日历撤销入口重构 + 全仓测试布局规整 + 提示语义色 AA 达标**（`T358` NueUI `1.13.0` · `T362`/`T364`/`T366`/`T368` 日历撤销 · `T369` 测试目录 + 新守卫 · `T370`/`T385` 同步面板 · `T377` nue-ui-skill · `T380`/`T391` 主题 `0.13.27`/`0.13.28` · `T383` `DEF-61` 修复）。**Tag `v1.12.3`** · root `1.12.3` · `apps/web` / `apps/desktop` `1.12.3` · `packages/shared` `1.4.1 → 1.4.2`（新增 14 个 `calendar.undo.*` i18n 键）· `packages/infrastructure` 本批**零改动不动**（`apps/mobile` / `packages/presentation-react` 亦零改动）。详见 `docs/releases/v1.12.3.md`。

### 行为变更（请留意）

- **日历「撤销」入口改为库消息扩展插槽（`NueMessage`）**（`T362`）：不再用自研顶部胶囊；全节**单一入口**（新动作先关上一条）。**成功终态**：按钮变**不可点**并显示「已撤销」（`aria-disabled`）、主文案「已撤销该调整」，保持约 **2s**；**失败态**：红底「撤销失败，可重试」+「重试」**仍可点**，保持约 **3s**。取消/超时语义：非终态仍为**约 5s** 自消息出现起算。
- **提示（Toast）语义色更深**（`DEF-58` 修复，主题 `0.13.27`）：success 文字 `-70→-100`、warning/error 文字 `-70→-90`、三边框 `-60→-80` ⇒ 浅/深均达「文本 ≥4.5 / 图形 ≥3」。
- **按钮 / 徽标 / 表单提示语义色更深**（`DEF-61` 修复，主题 `0.13.28`）：实心 success/warning/error 按钮填充 `-40→-100`（白字对比度 **1.73→6.60**、**2.29→8.51**、**3.28→10.93**）、destructive 文字/描边 `error-40→error-80`、Prompt `value-error` `error-30→error-70`、Badge 底 `warning-50→warning-80` ⇒ **观感上填充明显变深**。
- **同步状态面板**（`T370`/`T385`）：分区之间纵向留白收紧；已无引用的 `.sync-panel__footer` 死 CSS 移除（「立即同步」按钮本就在**概览**分区内）。
- **测试文件位置约束**（`T369`，**对开发者行为变化**）：`apps/**` 与 `packages/**` 的测试文件必须位于 `__tests__/` 目录内；新增守卫 `guard:test-location` 并接入 CI `check`（不满足即 CI 红）。
- ⚠️ **依赖版本变更**：NueUI `1.11.0`（web）/ `1.10.58`（desktop）→ **`1.13.0`**；主题 `nue-ui-theme-shadlike` `0.13.24 → 0.13.28`。

### 依赖 / 工程

- **NueUI `1.13.0`（两端对齐）**：桌面端不再重复打包两份组件库 —— 渲染层 nue-ui 分块 **171.5 kB → 91.1 kB（−46.9%）**、模块数 **82 → 50**。
- **主题 `nue-ui-theme-shadlike` `0.13.24 → 0.13.28`**：含提示色（`0.13.27`）与按钮/徽标/提示（`0.13.28`）两轮对比度修复，上游并附 vitest 对比度自检（10 组）防退化。
- **新增守卫 `guard:test-location`**（`scripts/guard-test-location.mjs`，纯静态 ~0.07s）：测试文件须在 `__tests__/`；已接入 `package.json` scripts 与 CI `check`。全仓守卫增至 **5** 个。
- **新增 `nue-ui-skill`**（`.agents/skills/nue-ui/`：`SKILL.md` + `references/`）—— 供 Agent 按需加载 NueUI 选型/拼页面/定制样式；**非运行时依赖**，不进任何产物。

### 修复

- **`DEF-58`（提示色对比度不达 AA，上游主题债）**：见上「行为变更」；上游 `nue-ui-theme-shadlike@0.13.27` + 本仓升依赖后**关闭**。
- **`DEF-61`（按钮 / 徽标 / 提示语义色配对 6 项不达标）**：上游 `nue-ui-theme-shadlike@0.13.28` + 本仓升依赖后**关闭**。
- **日历撤销入口可用性与文案**（`T364`/`T366`/`T368`）：成功/失败终态改为**状态驱动**（非重建 DOM）；仅当写回**全部成功**才置「已撤销」（禁止乐观置位）；失败保持可重试；替换期旧条置 `retired` ⇒ 淡出中旧按钮不可点（防误撤最新动作）。

### 改进

- **日历撤销入口**：位置/主题/入场动画由组件库统一；读屏活动区（`role=status`）随状态播报；成功终态不丢焦点（`aria-disabled` 而非原生 `disabled`）。
- **同步面板**：分区间距收紧（`T370`）+ footer 死代码清理（`T385`）。
- **测试布局**：22 个散落测试（web 17 / desktop 4 / shared 1）`git mv` 进同级 `__tests__/`（保留历史），仅修正 31 处相对导入；**纯搬移，全仓文件/例数不变**。
- **文档**：`DESIGN.md` 新增「提示（Message）语义色配对」与「按钮 / 徽标 / 表单提示语义色」两张实测表（浅/深）；`AGENTS.md` 补 `guard:test-location` 与全范围门禁 ⑨ + 主干同步纪律。

### 内部质量

- 五守卫（`guard:ddd` / `guard:gate-pathspec` / `guard:barrel-imports` / `guard:mobile-imports` / **`guard:test-location`**）全绿。
- `pnpm exec vp check` **0 error**；全仓 `pnpm exec vp test --run` **207 文件 / 1698 例 / 0 红**；移动端 diff = **0**；双端构建 exit 0。

### 已知未做（已登记）

- `DEF-59`：冷加载 URL 的 `hash` 被 `LAST_VISITED_ROUTE` 覆盖（深链失效）—— 待定产品口径。
- `DEF-60`：`useCalendarMonthly` / `CalendarMonthlyContext` 仍导出页面 0 消费的 `undoAction`/`undoBusy`/`undoLast`/`dismissUndoAction`（契约收窄，待小单）。
- `DEF-49`：主行 `create` 时间戳 1ms 舍入（P3，服务端）。
- `DEF-51`：同毫秒「并列」语义不对称（P3）。
- `DEF-62`：**已在 `nue-ui` 仓修复**（PR CI 触发），nao-todo 侧无遗留。

### 协同前提

- 仍建议与服务端 `nao-todo-server` `5cb30c5`+ 配套（OCC + 派生行回传）。

## [v1.12.2] - 2026-09-28

发布批次：**冲突 UX 收口**（`T331` 计数同源修复 + `T332` / `T338`–`T346` 冲突界面对话框化与可读性重构 + `T333` 测试加固 + `T347` 走查修复）。**Tag `v1.12.2`** · root `1.12.2` · `apps/web` / `apps/desktop` `1.12.2` · `packages/shared` `1.4.0 → 1.4.1` · `packages/infrastructure` `0.8.1 → 0.8.2`（`apps/mobile` / `packages/presentation-react` 零改动，不动）。详见 `docs/releases/v1.12.2.md`。

### 行为变更（请留意）

- **「冲突 N」计数口径：由「journal 条目数」改为「待处理对象数」**（`T346`）：同一对象（`表:实体`）多条记录只算 **1 项** ⇒ **徽标数字 = 面板左栏行数**；处理一个对象计数 **−1**（不是 −N），全清 ⇒ **0**。计数仍由 journal 派生（单一真源）。
- **冲突面板形态：内嵌列表 → 模态对话框**（`T338`）：入口为状态栏「冲突 N」；`role=dialog` / `aria-modal`；**`×` / Esc / 底部「关闭」三条路径均关闭并归还焦点**（`T347`）。
- **技术字段不再可隐藏（常显、次要样式）**（`T339`）。
- **偏好同步失败语义本版无变化**：沿用 `v1.12.1`（入队失败报错并回滚）。

### 修复

- **处理冲突后「冲突 N」计数不递减 / 不归零**（`T331`）：根因 = 两条恢复动作只删 journal 条目并刷新列表，**未把 journal 的剩余数量写回状态面计数** ⇒ 徽标滞留快照（用户看到「处理完不消失、重启才消失」）。现改为**同源写回**（`resolveConflictKeepServer` / `resolveConflictRetryLocal` 后 `setConflictCount(剩余对象数)`）⇒ 处理 1 个对象减 1、全清归零（徽标隐藏）。
- **冲突界面可读性与对比度（`T347`，qa 走查五项）**：① 浅色三态标签/符号**按卡片真实底色**（`--nue-primary-color-100` = `#e6e6e6`）重算 —— 绿色系小文本/符号提级至 `--nue-success-color-100`（**5.29:1**）、橙色符号提级至 `--nue-warning-color-90`（**5.34:1**），红系沿用（7.19 / 6.07）② 深色技术卡片背景由写死 `#efefef` 改 `var(--nue-primary-color-100)`（深色 `#262626`）⇒ 深色 **5.31:1** / 浅色 **4.60:1** ③ `×` / Esc / 底部按钮 / **遮罩空白**四条路径**一致归还焦点**（对话框点击曾冒泡到 window 误关父面板 ⇒ 在 `document` 冒泡阶段**常驻**截断、用**本对话框自己的 overlay**做 `composedPath()` 身份判定） ④ 空态图改 `assetUrl('/images/...')`（原 `/public/images/...` 生产 **404**）⑤ 底部「关闭」改为**关闭对话框**。

### 改进（冲突 UX C 端化重构 · `T332` / `T338`–`T346`）

- **对话框 + 左右布局**（`T338`）：左栏 = 待处理**对象**（一行一对象）、右栏 = 差异详情 + 动作区；≥900px 分栏、窄窗堆叠。
- **计数与列表同口径**（`T346`）：标题 / 徽标 / 左栏行数均按**对象数**；右栏「对象信息」保留**记录条数 + 全部类型（去重）**。
- **逐字段横向卡片 + 三态三重冗余**（`T332` / `T338`）：按对象分组、颜色 + 符号（`+ − ~`）+ 文字标签；长值截断可展开；双方来源标注（我的修改 / 云端最新）。
- **文案去术语、字段名可读化**（`T340`）：字段名映射可读标签，未映射走可读回退，不裸露技术键名。
- **技术字段常显 + 次要样式**（`T339`）：移除开关，排在普通字段之后、轻分隔。
- **三态统一 `LoadingError`**（`T342`）与**状态栏面板分区**（`T343`：概览 / 数据 / 待处理 / 冲突 / 错误 / footer）。
- **密度与层级**：行高 18→24px、行距 4→8px；条目点击区 ≥40px；覆盖类动作加安全提示 + 主/次按钮。
- ⛔ 仅展示层：不改恢复动作 / 合并语义 / 计数真源。

### 内部质量

- **同毫秒时间戳 flake 加固**（`T333`）：pull 侧 LWW 用严格 `>`，用例若与本地 create 同毫秒 ⇒ 判「本地胜」跳过 ⇒ 偶发红；统一改为远端 `now+1ms`（严格更晚）。**仅测试，无运行时影响**。
- **`T346` 计数口径测试**：徽标 = 对象数 / 行数 = 徽标 / 多记录对象 −1 / 全清 0 / 重启一致；**`T347` 回归守护**（token 提级、深色无写死亮色、`assetUrl`、关闭语义 + 焦点归还）。

### 协同前提

- 仍建议与服务端 `nao-todo-server` `5cb30c5`+ 配套（OCC + 派生行回传）。

### 已知未做（已登记）

- `DEF-51`：同毫秒并列语义不对称（pull 严格 `>` vs 服务端 `After`）—— P3；建议修法 = 并列时按「本地是否有待推改动」分流。
- `DEF-49`：主行 `create` 时间戳 1ms 舍入（P3）。
- `LoadingError` 的 `error` 分支为**防御性路径**（现有调用点以 `loading` / `empty` 驱动），本版未构造错误注入用例。

### 验证

- `vp check` 0 err（1267 files）；全仓 **205 文件 / 1678 例 / 0 红**；四守卫 rc0；**移动端 diff = 0**；`apps/web` / `apps/desktop` 构建 exit 0；生产产物无 `/public/images` 引用。对比度为按 token 计算值（qa 将在最终构建二次实测）。

## [v1.12.1] - 2026-09-28

发布批次：**同步冲突客户端侧修复**（`T325` / `T326` / `T329`）—— 消除「desktop 频繁修改后概率性同步冲突」与「无提示静默覆盖」窗口。**Tag `v1.12.1`** · root `1.12.1` · `apps/web` / `apps/desktop` `1.12.1` · `packages/infrastructure` `0.8.0 → 0.8.1`（`apps/mobile` / `packages/presentation-react` 零改动，不动；其余包本批无改动，不 bump）。详见 `docs/releases/v1.12.1.md`。

### 修复（同步冲突 · 客户端侧）

- **服务端时间校准接线修复**（`RC-2`，`617c3f72`）：push/pull 读取 `serverTime` 少了一层（实际在 `body.data.serverTime`）⇒ `getServerTimeOffset()` 恒 0、本地写用**裸客户端时钟**；修复后本地写时间基准随服务端校准生效，消除时钟偏斜导致的**伪 `noop` / `stale`**。
- **pull「本地胜」回写 base**（`RC-3`，`617c3f72`）：本地有未推改动且本地时间更新时，原实现整段跳过且**不回写 base** ⇒ OCC 下下一次推送必然 `stale`；现把 base 收敛到服务端当前版本。
- **写库与入队同事务**（`RC-5` / `DEF-50`，`617c3f72` + `2241a31a`）：本地业务行写入与同步入队原为两次独立 await ⇒ 拉取/对账可在「行已写、队列未入队」窗口内**无提示覆盖**本地改动。现已收进**同一 Dexie 事务**，入队失败整体回滚；覆盖 `tasks` / `projects` / check-items / comments / `tags` / `pomodoros` / `pomodoroRecords` / **冲突「以我的版本重试」** / 偏好队列（含**对账覆盖侧事务内再确认**）⇒ **静默覆盖窗口归零**。
- **同毫秒出队竞态**（`AC-T325-8`，`617c3f72`）：推送在飞时同毫秒的新写原会被误判「未变」而误删队列项；改用入队修订号（`revision`）比较。
- **消费服务端派生行回执**（`RC-1` 客户端半边，`617c3f72`）：读取 `/sync/push` 的 `data.derivedUpdates[]`（缺省 ⇒ 完全 no-op，向后兼容旧服务端），把被计数联动改写的父任务/清单 base 收敛到**库中最终版本**；**脏行也收敛**；**先应用 `results`、后应用 `derivedUpdates`**（后者覆盖前者）。
- **清单 pull 边界 `'' → null` 归一**（`DEF-42`，`ccd7c659`）：项目 pull 时把服务端空串 `archivedAt` 归一为 `null`，避免「空串哨兵」误判。
- **日历名称排序固定 `zh-CN`**（`DEF-40`，`59b0b012`）：消除随运行环境 locale 变化导致的排序不一致。

### 行为变更（请留意）

- **偏好保存失败会报错并回滚**：原偏好入队失败被静默吞掉（本地行仍写入）；现与业务行**同事务**，入队失败 ⇒ 返回错误并回滚。web 端清单/标签偏好视图已有可见反馈（`NueMessage.error` toast）。
- **`stale` 冲突更「可见」**：服务端部署 OCC 后，陈旧 base 的推送会得到**可见冲突**（而非静默覆盖）⇒ **可见冲突数可能上升**（设计使然，非缺陷）。

### 前置与协同（跨仓 `nao-todo-server`）

- **需与服务端配套**（OCC + 派生行回传，已部署 `5cb30c5`）：客户端 A / B① / B③ 修复独立生效；`derivedUpdates` 消费端在**旧服务端**下自动 no-op（行为逐字不变）。
- 旧客户端在**新服务端**下：陈旧 base 会得到可见 `stale`（不再静默覆盖），属预期且更安全。

### 已知未做（已登记）

- `DEF-49`：主行 `create` 时间戳 1ms 舍入（7 处，按发布口径本批不改）。
- `deletions` 不参与 OCC（`R-15b`，既有局限）。

### 验证

- 全仓 **202 文件 / 1626 例 / 0 红**；四守卫（领域隔离 / 门禁 pathspec / 导入面可解析 / 移动端红线）全绿；**移动端 diff = 0**；`apps/web` / `apps/desktop` 构建 exit 0；CI `check` + `test` 双绿。

## [v1.12.0] - 2026-09-25

发布批次：**清单归档**（Issue #99）—— 归档 = **收起但可找回**，**绝不删数据**。web 与 desktop 行为一致，**移动端零改动**。**Tag `v1.12.0`** · root `1.12.0` · `apps/web` / `apps/desktop` `1.12.0` · `packages/infrastructure` `0.7.0 → 0.8.0` · `packages/shared` `1.3.4 → 1.4.0` · `packages/domain-project` `1.1.0 → 1.2.0` · `packages/domain-task` `1.3.0 → 1.4.0` · `packages/presentation` `0.7.0 → 0.8.0`（`presentation-react` / `apps/mobile` 零改动，不 bump）。详见 `docs/releases/v1.12.0.md`。

### 新增（清单归档）

- **归档 / 取消归档闭环**（`777d2d43`）：三处入口（清单头部操作菜单 · 清单右键菜单 · 侧栏底部「已归档」直达管理弹窗页签）；二次确认提示「该清单内 **N** 个任务将一并归档」；**级联归档**在**同一个本地事务**内完成且**逐任务入队同步**（离线一致、不丢改动）；取消归档**回最近位置**（`sortId` 保留，与活动项碰撞时自动归一）；页签内展示归档清单的任务数与归档时间。
- **可见性收口 + 搜索开关**：清单视图 · 8 个内置视图 · 侧栏 · 日历 · 番茄 · 新建下拉 · 搜索**默认均不显示归档内容**；**唯一显式包含通道** = 搜索筛选栏新增「**包含已归档**」开关（URL 参数 `archived=1` 可分享 / 回填），结果行标注「已归档」。
- **归档清单只读**：归档清单内的**任务写入**与**清单自身修改 / 删除**均被拒绝，返回稳定错误码 **`ARCHIVED_READONLY`**（用户可见提示为**单条、本地化**文案，不透出错误码）；**唯一例外 = 「取消归档」**。
- **单任务「取消归档」**：清单**仍在归档** ⇒ 任务**移入收集箱**并给出可见提醒（「已移入收集箱 / 原清单仍处于归档状态」）；清单**已恢复** ⇒ 回到原清单。
- **服务端对齐**（跨仓 `nao-todo-server`）：列表查询**默认排除归档**（**任务与清单两面**，「未传 `isArchived`」与「显式 `false`」**同语义**）；`/sync/pull` **照常返回归档内容**（本地镜像完整，不因默认排除而丢失）。

### 行为变更（请留意）

- **默认排除归档**（**任务与清单两面**，含**移动端**）：本版**客户端发布不会**使该行为在移动端生效 —— 取决于**服务端部署 / 发布**。
- 归档清单内的写入被拒绝并给出本地化提示（`ARCHIVED_READONLY`）—— **设计使然，非缺陷**。

### 修复

- **归档曾误删数据**（`DEF-36`）：`archive()` / `unarchive()` 曾被错误地走「删除」路径（`deletedAt` 被置位）⇒ 改为**委托仓储的归档 / 取消归档**，绝不写删除标记。
- **脱归档变更同步不到服务端（静默）**（`DEF-37`）：单任务取消归档后写入的本地「收集箱」归属，在推送时会被服务端拒绝（字面量 `inbox` 非合法 ID）⇒ 队列长期退避、**永不出队**、且无提示。已修：**推送侧**将本地 `inbox` 归一为「无清单」发送、**拉取侧**将服务端归一后的 `userId` 回填为本地 `inbox`（**同批**，往返闭环）。
- **服务端归档过滤空操作 + `sort` 参数无白名单**（`DEF-12`，跨仓）：非法字段 / 方向 ⇒ 回落默认排序，不再拼接 SQL。

### 工程与治理

- **发布版本号补齐（本次发版后修正）**：v1.12.0 首次发版仅 bump 了**根 `package.json`** ⇒ 桌面产物仍命名为 **1.11.0**（`nao-todo-1.11.0-x64.exe` 等）且 `latest*.yml` 版本错乱。本条目所在提交补齐 **`apps/web` / `apps/desktop`** 与其余**本批次实际有改动**的包（infrastructure / shared / domain-project / domain-task / presentation），并补录本 CHANGELOG。

### 已知未做（已登记）

- **移动端同源残留**（`DEF-38`）：移动端按字面 `inbox` 过滤收集箱 ⇒ 服务端归一后的值不命中（**本版不动移动端**，需单独授权后修）。
- 归档只读提示的**静默为「约定式」**：依赖「通知入口逐处登记」⇒ 建议后续收拢为**唯一通知包装**并加静态守卫。
- 归档确认文案的 **N 口径微差**：N 不含「已放弃」与「子任务」，而级联会归档二者 ⇒ N 可能略小于实际归档数（既定取舍）。

## [v1.11.0] - 2026-09-24

发布批次：**阶段二 2B —— 冲突精细化（OCC + 冲突解决 UX）+ 多标签协调 + 偏好面收口**（+ `FIX-D`）。**Tag `v1.11.0`** · root `1.11.0` · `apps/web` / `apps/desktop` `1.11.0` · `packages/infrastructure` `0.6.0 → 0.7.0` · `packages/shared` `1.3.3 → 1.3.4`（其余包零改动，不 bump）。详见 `docs/releases/v1.11.0.md`。

### 新增（冲突精细化 · OCC）

- **服务端 OCC（additive，跨仓 `nao-todo-server` `54e843d` / `ac72a37`）**：`/sync/push` 条目支持 `baseUpdatedAt`（缺失 ⇒ 与现行 LWW 逐字一致）；base 不等 ⇒ **不写** + 回库中版本 + outcome **`stale`**（与 `conflict`=ID 碰撞 semantic 区分）。**无 DB 迁移、无新错误码**（HTTP 200 + 既有 `90010` + 逐条 outcome）；OCC 字段仅落在 7 个 sync 专用条目，共享 create DTO 加 `json:"-"`（C-44）。
- **客户端 OCC 基建**（`5db13f5b`）：7 表 + `projectPreferences` 记 `syncedServerUpdatedAt`（**不 bump Dexie version**）；pull 落 base · push 回传 base · `applied`/`noop`/`stale` 确认写回。
- **全 outcome 消费**（`5db13f5b`，闭合 2A 登记的 `error` 窄窗）：**`error` 不出队 + 业务退避**（不再静默丢数据）；`noop`/`stale`/`conflict`/`skipped` 记 journal + 可见计数。
- **冲突解决 UX**（`355aa7d2`）：「冲突 N」入口 → 列表 / 只读对比（败方快照 vs 本地当前）→ **两种恢复动作**（保留服务端版本 / 以我的版本重试）；折叠信号（上限 **50 → 200**，`limit`/`evicted` 两文案区分）；web/desktop **同组件同 hook**；i18n 中英齐备。
- **多标签协调**（`5178fe37` / `795f3c13`）：push 加 `navigator.locks` **单主**（未取锁 ⇒ 跳过且**不消耗重试**、队列保留）；journal `meta` **读写原子**（`nao-todo:journal:<uid>` 专用锁覆盖全部写者，锁序 `pull/push → journal`）。
- **偏好面收口**（`17e56016` / `f89d0aea`）：普通清单偏好**按行 LWW**（base 写回 + **触发点对账**远端胜）；`tagPreference` 纳入本地优先（web 撤 `withMirrorFallback`，与 desktop 同构）；**偏好面仍不入业务 `syncQueue`**；**读路径本地优先**（本地有行 ⇒ 立即返回、不发网络）。
- **`FIX-D`（DEF-35 / C-68）**（`852cdde1`）：web 端旧版本密文一次性自愈（检测 ⇒ `countDirty` 护栏 ⇒ 丢弃本地密文副本 + 全量重拉 + 可见告知；**不删 `key-bundle`**）。

### 行为变更（请留意）

- **OCC 全局启用**：离线期间基于陈旧 base 的本地修改，推送时会得到 `stale` 并进入**可见的冲突列表**（服务端权威版本保留、本地改动不丢，可「以我的版本重试」）⇒ **可见冲突数可能上升**（R-16，设计使然，**非缺陷**）。

## [v1.10.0] - 2026-09-24

发布批次：**web 离线能力（阶段一）** + **业务数据面两端同构 local-first（阶段二 2A）** + 本轮用户报障的 P0 登录缺陷修复。**Tag `v1.10.0`** · root `1.10.0` · `apps/web` / `apps/desktop` `1.10.0` · `packages/presentation` `0.6.0 → 0.7.0` · `packages/shared` `1.3.2 → 1.3.3` · `packages/domain-identity` `1.1.0 → 1.2.0` · `packages/infrastructure` `0.5.0 → 0.6.0` · `packages/presentation-identity` `1.2.0 → 1.2.1`（`domain-task` / `presentation-react` / `apps/mobile` 零改动，不 bump）。详见 `docs/releases/v1.10.0.md`。

### 新增（web 离线 · 阶段一）

- **离线进入 + 离线可读**（`0e095d88` / `ebc2e87b` / `33901b90`）：本地镜像 + 新鲜度提示（「离线模式 · 数据截至 X」/「尚未同步完成」），冷启动读 `meta` 落盘值；镜像续拉至无更多。
- **安全姿态与迁移**（`9ee0c08b` / `b7612b86` / `a8480151`）：两端一致的明文本地存储 + 启动门内历史密文迁移 + **按键白名单清库**（`wipeUserData` 单一真源，禁 `localStorage.clear()`）。
- **统一禁写 + 可见反馈**（`3af3b854` / `f650dd39`）：离线写入口统一拦截并给可见提示（不再 5 项静默失败）。
- **多标签登出广播**（`c368fe63`）：一个标签登出，其他标签同步清库并跳登录。

### 新增（两端同构 local-first · 阶段二 2A）

- **业务 7 域写路径切本地**（`1c31e09d` / `5e19565e` / `c2459a4a` / `09c7cdff`）：任务 / 检查项 / 评论 / 清单 / 标签 / 番茄 / 番茄记录 ⇒ 本地仓储 + `syncQueue` 回传；**离线写合法**。
- **前置四件**（`6a75a0de` / `68b336b6`）：**服务端时间校准**（PS-15）· **冲突 journal（含败方快照，有界 50）**（PS-14）· **web 首拉门**（PS-16）· **dirty 监听 → 自动推送**（PS-12）。
- **闸门作用面收敛至身份域**（`b4960a4d`）：写闸门仅保留 `USER_WRITE_METHODS`（身份域仍远端直连 + 离线拦截）；`withReadOnlyGuard` / `OFFLINE_READONLY` 保留。
- **`markDirty` 语义变更**（ADR r10）：web 业务**不再恒 0**；`pendingCount = countDirty`，成功同步出队回 0；身份域不产生业务 `markDirty`。
- **同步面板冲突计数**（`1bed1d8d` / `ba2c189e`）：新增只读「冲突 N」行（warning 语义，不做交互）。
- **服务端**（跨仓 `nao-todo-server` `ed4abdf`）：`SyncResult.Outcome` **additive** 字段（`applied` / `noop` / `conflict` / `skipped` / `error`，与 `DecideUpsert` 同源）。

### 修复

- **登录成功后被弹回登录页**（DEF-34，`c7c782d3`）：守卫内「补清上次登出」不再删除**当前会话凭据键**（按调用语境区分「终结会话」/「补清」）⇒ 存量残留态**无需手动清数据**即可自愈。
- **刷新「检入失败」且无法自愈**（DEF-33，`453fd076`）：检入失败分类改为「网络白名单 + 结构化 code 优先」——只有明确网络类保留认证，其余按凭证失效处理（含未知码安全默认）；仓储边界透传 `code`（闭合 DEF-25 的文案耦合）。
- **SSE 空/失效令牌报 MIME 错误**（`85e3278b`）：无令牌不建连；失效由请求层单一出口处理（避免 SSE 瞬断误登出）。
- **读路径回退语义纠正**（`37cac094`，ADR r12）：`mirror-fallback` 抛出分支仅对**明确凭证结构信号**（HTTP 401/403 或业务码 10041/10021/10022）上抛，**网关 502/504、5xx、非凭证 4xx、未知错误一律回退本地镜像**。

### 工程与治理

- **启用 GitHub flow**（`c057f8b5`）：1 需求 = Issue + 分支 + PR（squash）· `main` 始终可发布 · 合并由 RD 执行、PM 只验收授权 · 发布 tag 指向 main 合并提交；**baseline 追平一次性使用 merge commit**（PR #89）。
- **PR 模板**：新增 `.github/pull_request_template.md`。
- **ADR 修订**：C-59 业务只读**正式退场**（r10）· C-52/C-53 清库语境（r11）· 新增 **C-67**（认证失败分类）与 **C-68**（web 无 DEK 时旧密文处置）· **r12**（读路径回退 fail-soft）。
- **舰队资产**：同步 nao-skill **v0.7.0 / v0.7.1**（`c9144a22` / `3924552e`）—— 含 `close` 回收闸门修复；`nao-fleet.sh check` exit 0。
- **门禁**：4 个新增守卫（导入面可解析 · 移动端红线 · 门禁 pathspec · 领域隔离）全部纳入批末验收。

## [v1.9.0] - 2026-09-23

发布批次：任务导出多格式（JSON / HTML 账单）+ 导出框内加载与错误态 + 日视图测试时间炸弹修复。**Tag `v1.9.0`** · root `1.9.0` / `@nao-todo/desktopapp` `1.9.0` / `@nao-todo/webapp` `1.9.0` / `@nao-todo/presentation` `0.6.0` / `@nao-todo/shared` `1.3.2`（`@nao-todo/domain-task` `1.3.0` / `@nao-todo/infrastructure` `0.5.0` / `@nao-todo/presentation-identity` `1.2.0` / `@nao-todo/presentation-react` `0.1.0` 不动）。范围：web + desktop。

### 新增（任务导出）

- **JSON 导出格式**（TASK-22，`c25ac0ec`）：`generateTaskJson(root, exportedAt)` 纯函数；固定全量 schema（`formatVersion` / `exportedAt` / `task` 包装），**标量与时间缺失输出 `null`（空串归一为 `null`）、数组缺失输出 `[]`**（机器消费稳定）；时间保持 ISO 与原始枚举值（`state` / `priority` / `isGivenUp` / `projectId` / `tagIds`），另附本地化 `stateLabel` / `priorityLabel` / `projectName` / `tagNames`；描述保留原始换行；递归字段名 `subTasks` 与 Markdown / HTML 段一致。
- **HTML 账单风格导出（可独立打开的单据）**（TASK-22，`c25ac0ec`）：`generateTaskHtml(root, labels, generatedAt)` 纯函数输出**完整 HTML 文档**（`<!DOCTYPE>` + `<head>` + 内联 `<style>`），**自包含**（零外部资源 / 零脚本）；**固定浅色**（`color-scheme: light` —— 成品 = 纸）以保证「预览所见 = 复制源码所得」；**五字符转义**（`& < > " '`）覆盖全部插值文本；描述 `pre-wrap` 保留换行；空段整段省略；**合计段**给出检查项 / 子任务完成度（判定条件为**对象数 `y > 0`**，`x = 0` 仍输出 `0/y`，`0/0` 永不出现）；视觉规格见 PRD §14（纯灰阶小票：等宽数字 + 右对齐对账列 + 撕口虚线，完成度计量条为唯一记忆点）。
- **导出对话框：多格式 + 框内加载/错误态**（TASK-22，`2a1df84e` / `af08a270`）：流程**反转**为「点导出**立即开框**」→ 框内 `loading-error` 三态（加载 / 错误 + **「重试」** / 内容），失败保留 toast；顶部格式分段控件（Markdown / JSON / HTML，`data-format`）；**Markdown 可编辑（含「还原」）**、JSON 只读 `<pre>`、HTML 经 `iframe[sandbox=""]` + `srcdoc` 只读预览；**一次取数产三格式**（切格式零重取、`retry` 防重入）；`env.d.ts` 补 `vite/client` 类型（供 `?raw` 源码级断言）。

### 修复

- **日视图测试日期时间炸弹**（DEF-4，`5d2e51f1`，**非本批引入**）：`daily-view.test.ts` 全天任务 fixture 硬编码 `endAt: '2026-09-22'`，而视图按 `todayDateKey()` 建网格 ⇒ 该日之后**恒红**（v1.8.0 验证日恰等于该日故曾绿）；改为相对当天（`const TODAY = dayjs().format('YYYY-MM-DD')`）。

### 工程与治理

- **`.agents/**` 舰队资产同步至 nao-skill v0.6.1**（`ce55edbc` / `7284e116`）：`nao-fleet.sh` 修 `ensure` 无 `--task` 时 `set -u` 崩溃（上游 `a363f12`），并新增**文本契约校验**（`check_eol` + `check_roles_indent`：`.agents/**` 全 LF、`roles.yaml` 缩进 2/4、禁 Tab，失败 rc=1 且报告先于解析 die）⇒ 此前靠人守的「全 LF + 缩进 2/4」不变量**首次有了守卫**。
- `AGENTS.md` 更正已过期的 `.agents/**` 危险警告（`fmt.ignorePatterns` 已覆盖 ⇒ 全仓 `vp check --fix` 安全）。
- 工艺规则：PM 不再重复跑终局门禁；由 worker 跑**全量**门禁并回执精确数字（见 `docs/tasks-state.md` §四）。

## [v1.8.0] - 2026-09-22

发布批次：日历日视图三批（子路由化 / 时间轴缩放 / 交互调整）+ 导出对话框 + 工具与治理。**Tag `v1.8.0`** · root `1.8.0` / `@nao-todo/desktopapp` `1.8.0` / `@nao-todo/webapp` `1.8.0` / `@nao-todo/presentation` `0.5.0` / `@nao-todo/domain-task` `1.3.0` / `@nao-todo/shared` `1.3.1`（`@nao-todo/infrastructure` `0.5.0` / `@nao-todo/presentation-identity` `1.2.0` / `@nao-todo/presentation-react` `0.1.0` 不动）。范围：web + desktop。

### 新增（日历日视图）

- **日视图**（TASK-16，`0d1b801e` 起）：横坐标=时间 48×30 分钟列（整点有文本）、分钟级连续定位（显示不吸附）、轨道打包 + 日级 `+N`、跨日裁剪与续接、全天行、当前时间线、快速新建 / 拖拽改时间 / 拉伸改时长。
- **三视图子路由化 + 布局单一基线**（TASK-18，`a15ce8f9` / `c76bc1fd`）：`calendar-monthly` / `calendar-weekly` / `calendar-day` 三条子路由（均 `:taskId?`）、状态宿主上移 `.nue-calendar-host`（`--cal-*` 令牌随行、monthly 去重复 padding）、`viewMode` 由 `route.name` 只读派生（无可变镜像）、切视图 `replace` 幂等短路、`LAST_CALENDAR_ROUTE` 恢复子路由（含 `taskId`）。
- **时间轴档位缩放 + 横向溢出滚动 + 全天任务内嵌泳道**（TASK-19，`c08b7b3c` / `5eac8ff9`）：×1 / ×1.5 / ×2 / ×3 / ×4 五档（列数 48 / 48 / 96 / 96 / 144）、总宽 `max(k × 容器宽, 列数 × 20px)`、刻度密度随档位细化、**日视图不再折叠 `+N`**（全部轨道纵向可滚可达）、全天任务移入网格顶部泳道（与时间轴同横向坐标系）、`CALENDAR_DAY_ZOOM` 持久化（跨会话 / 跨视图沿用）。
- **日视图交互调整六项**（TASK-19B，`44bb402d` / `99d81aaf`）：
    - 点击**刻度标签**打开任务创建对话框（预填 `startAt` / `endAt = +30min`，原生 `button` 可键盘可达）；**移除**空白点击新建。
    - 全天任务改为**只读任务条**（复用 `task-bar`），并给出不可拖拽原因（`data-allday-reason`）。
    - 任务名 **sticky 贴视口左缘**（不越出自身条）；左右缘渐隐遮罩提示被裁切内容。
    - 任务条**左右缘均可拖拽**：左缘改 `startAt`、右缘改 `endAt`（真实值锚，不夹取可见日边界）。
    - 时间轴空白处**拖拽横向平移**（阈值复用 `DRAG_THRESHOLD_PX`，目标排除清单零抢占）。
    - ×4 档细化为 **5 分钟刻度**（288 列）、标签水平居中于刻度线、格线四级（60/30/10/5）。
- **pan 加固 / 任务条拖动修复 / 拖动反馈 / 格线像素 / SFC 拆分**（TASK-20，`dee5b8f6` / `70c9723c` / `942116c5`）：
    - **修复「任务条拖不动」**：根因 = `.day-axis-track` 覆盖层未声明 `pointer-events: none`，静默吞掉任务条命中（jsdom 无法发现）—— 该覆盖层已改为不拦截，并把该约束固化为**覆盖层命中契约**。
    - 拖动新增**交互反馈**：跟随浮层、源条区分、**吸附后起止时刻预览**、**吸附刻度高亮线**（松手即清）。
    - 纵向恢复可滚（`overflow-y: auto; overflow-x: hidden`）、列头恢复与列对齐。
    - 格线改**整数列宽**（消除 1px 线在设备像素网格上的半像素抗锯齿 ⇒ 细线不再消失/闪烁），细层对比提升（10min 55% / 5min 45%）。
    - `daily/index.vue` **911 → 359 行**（CSS 抽离为 `daily/index.css` + 4 个 composable，DOM / `data-testid` / 结构契约不变）。

### 新增（任务导出）

- **导出浮层可编辑 + 一级子任务字段丰富**（TASK-13，`0527461d` / `facddf27` / `04d90762`）：只读预览改为可编辑 `nue-textarea`（含「还原」）；一级子任务字段丰富（名称行仅复选框 + 名称，属性走 `- 名: 值`）。
- **`TaskCheckItemUseCase.listByTask`**（domain-task 新增只读原语）：加载任务检查事项列表且**不写 store**，归一排序 `sortId ASC, id ASC`（不依赖底层仓储顺序），供导出等旁路读共享数据使用。

### 修复

- **CodeGraph 索引警告不再计入 `vp check` 退出码**（TASK-16 批次，`02626f23`）：`Pending Changes` 警告原被记为 `rc=1`，与「索引过期 → 提醒、不阻塞」的既定口径冲突，会造成误停。
- **周视图 active 误绑**（TASK-18，`c3aa5c1b`）：点击已激活的「周」按钮不再跳回月视图。
- **日视图重复 padding**（TASK-18，`0d1b801e`）：采纳用户手工微调并补回被删的 `data-testid="day-unscheduled-entry"`。

### 其他（Chore / 治理）

- **日视图命中抽检固化**（TASK-21，`149305fe`）：新增 `scripts/electron-smoke/checks/day-view-hit.mjs`（feature `day-view`，基于既有零第三方依赖的 CDP 真实渲染冒烟工具）。回归判据 = **`elementsFromPoint` 命中栈不含覆盖层** + **空白点 `inTrack=false`** + **覆盖层 `pointer-events: none`**；无数据一律 `SKIP`（绝不 `PASS`）。
- 清理零引用死规则（`.cal-nav-btn` ×3 / `.cal-aside-toggle`，`b32e05a6`）。
- 测试基础设施：放行 `*.css?raw`（Vitest `css.include`，`dee5b8f6`），使「以 CSS 源码文本断言样式契约」的用例在 CSS 抽离后仍可运行。

### 已知问题（未修，已入池）

- `packages/infrastructure` 的 `sync.test.ts > Q3` 约 1/10 概率失败（`fake-indexeddb` / `syncQueue` 共享状态跨用例泄漏，属**测试隔离**问题）；已核实与本批次改动无因果，单跑该包全绿。待另立单修。

### 质量门槛

- `vp check`：全绿（1313 文件格式 / 1123 文件 0 error 0 warning）。
- `vp test`：**110 文件 / 993 例全绿**。
- `pnpm webapp build` ✓ / `pnpm run desktop:build` ✓。
- 红线：`apps/mobileapp`、`packages/presentation-react` 本批零改动；月/周视图 DOM 与布局零变化。

## [v1.7.9] - 2026-09-21

发布批次：放弃/提醒同步缺陷链修复（客户端 patch）。**Tag `v1.7.9`** · root `1.7.9` / `@nao-todo/desktopapp` `1.7.9` / `@nao-todo/webapp` `1.7.9` / `@nao-todo/presentation` `0.4.6`（`@nao-todo/shared` `1.3.0` / `@nao-todo/infrastructure` `0.5.0` / `@nao-todo/presentation-identity` `1.2.0` / `@nao-todo/domain-task` `1.2.0` / `@nao-todo/presentation-react` `0.1.0` 不动）。范围：web + desktop（同步 + 提醒）。

### 修复（同步与提醒）

- **批量「取消放弃」无法同步到后端（T33，`3a0a5a99` / `d2608306`）**：载荷 `givenUpAt` 由 `null` 改为空串（服务端同步契约 `nil`/JSON `null` = 缺省不写列、`""` = 清空置 NULL）——原 `null` 被服务端按「缺省」处理，`given_up_at` 不会清空；现与任务详情页 footer 路径行为对齐。
- **关闭提醒后服务端提醒时间残留（T34，`79779c13` / `7166721e`）**：提醒设置器关闭分支载荷 `remindAt`/`remindTime` 由 `null` 改为空串（同源语义误用）；Web 端 `PUT /tasks/{id}` 原先无法清空 `remind_at`，而 `remind_repeat='none'` 照写 ⇒ 状态自相矛盾，可能导致已关闭的提醒仍触发。
- **提醒变更判定基准归一**：当前值 `null`/`undefined`/`''` 统一按「已清空」比较，消除「关-开-关」产生冗余更新事件。
- **类型收紧**：`TaskRemindSetterUpdateVO.remindAt`/`remindTime` 由 `string | null` 收紧为 `string`；任务日期选择器 `hasReminder` 改真值判定，与「空串视为无提醒」口径一致。

### 配套（服务端 nao-todo-server，已单独部署）

- sync push 契约补齐 `archivedAt`/`starMarkAt`/`givenUpAt`（原先静默丢弃 + 假成功，致桌面端放弃/收藏无法落库）。
- 提醒扫描排除已完成/已归档/已放弃任务；重复提醒在未设 `end_at` 时正确续期。

### 其他（Chore）

- 测试：新增 7 例（T33 批量取消放弃 4 例 + T34 关闭提醒 3 例，含双红测证明），全量 88 文件 / 772 例。

### 质量门槛

- `vp check`：全绿（fmt / lint / type）。
- `vp test`：88 文件 / 772 例全绿。
- `pnpm webapp build` ✓ / `pnpm desktopapp build` ✓。

[v1.7.9]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.7.9

## [v1.7.8] - 2026-09-21

发布批次：常用搜索（Saved Searches）+ 搜索页侧栏化（AppAsideV2 Adapter / 折叠 / 空态 / 快捷搜索）+ 收集箱搜索缺陷修复（patch）。**Tag `v1.7.8`** · root `1.7.8` / `@nao-todo/desktopapp` `1.7.8` / `@nao-todo/webapp` `1.7.8`（`@nao-todo/presentation` `0.4.5` / `@nao-todo/shared` `1.3.0` / `@nao-todo/infrastructure` `0.5.0` / `@nao-todo/presentation-identity` `1.2.0` / `@nao-todo/domain-task` `1.2.0` / `@nao-todo/presentation-react` `0.1.0` 不动）。范围：web + desktop（搜索 UI）。

### 新增（搜索）

- **常用搜索（T24，`482970c8` / `22df1b4b` / `0052a37c`）**：将当前完整搜索条件（关键词 / 清单 / 标签 / 优先级 / 状态 / 纳入已删除放弃）存为具名条目（localStorage `naotodo.search.saved`，上限 20，允许重名），侧栏一键复现；支持重命名、删除、桌面端拖拽排序；默认名按条件自动派生（可改）。
- **搜索页侧栏（T26，`0a5959b2` / `76c98a6e` / `ab7913d3`）**：常用搜索与最近搜索迁至侧边栏常驻（AppAsideV2 Adapter，teleport 两段式）；状态单一真源（provide/inject，主区与侧栏同一实例）。
- **侧栏折叠 + 空态 + 快捷搜索（T27′，`3d421a7f` / `ca65d8c7` / `4a17ee80`）**：侧栏分区可折叠（`nue-collapse` theme=menu；常用/最近可折叠，默认展开、非 accordion、不持久化；快捷搜索固定常显）；两区空态提示（标题恒显 + 文案 / 创建引导）；置顶只读「快捷搜索」预置四项（高优先级 / 待办 / 进行中 / 已完成），点击即应用条件并搜索。

### 修复

- **收集箱搜索失效（T28，`c2b22384` / `dc8bafa2`）**：搜索页清单选「收集箱」搜不到结果（收集箱哨兵不一致：任务数据为 `'inbox'`、搜索内部为 `''`）——搜索入口归一（Fix B）+ 过滤两端归一（Fix A）；URL 契约（`?project=inbox`）与内建清单查询不变。

### 优化（搜索）

- **折叠头 UI（T29，`b33b9d66` / `f73925fa`）**：指示箭头改用 `nue-icon` 自绘并调小（0.75rem，弃用库类）；「最近搜索」清除按钮移至头部、箭头左侧（`@click.stop` 防误触折叠）。

### 其他（Chore）

- i18n 中英新增搜索相关键（`search.saved.*` / `search.history.empty` / `search.quick.*`）。
- 测试：新增 `saved-search` / `use-saved-search` / `aside` / `quick-search` 及收集箱回归，全量 87 文件 / 765 例。

### 质量门槛

- `vp check`：目标文件 pass（fmt / lint / type）。
- `vp test`：87 文件 / 765 例全绿。
- `pnpm webapp build` ✓ / `pnpm desktopapp build` ✓。

[v1.7.8]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.7.8

## [v1.7.7] - 2026-09-20

发布批次：任务详情导出 Markdown + footer 样式内聚（patch）。**Tag `v1.7.7`** · root `1.7.7` / `@nao-todo/desktopapp` `1.7.7` / `@nao-todo/webapp` `1.7.7` / `@nao-todo/presentation` `0.4.5`（`@nao-todo/shared` `1.3.0` / `@nao-todo/infrastructure` `0.5.0` / `@nao-todo/presentation-identity` `1.2.0` / `@nao-todo/domain-task` `1.2.0` / `@nao-todo/presentation-react` `0.1.0` 不动）。范围：web + desktop（任务详情 UI）。

### 新增（任务详情）

- **导出任务文本（T21 / T22，`7281a695` / `d99652a6` / `fd7a49f3` / `431aa14b`）**：详情面板底部「更多」菜单新增「导出」——将任务全部数据（名称/状态/优先级/时间/项目/标签/描述/检查项/子任务）渲染为 Markdown 文本，经 nue-dialog 预览并一键复制到剪贴板；子任务递归导出（逐层分页取尽，深度上限 5 层防环）；无描述/检查项/子任务的段落整段省略；取数/复制失败均有明确提示。生成器为纯函数（`export-markdown.ts`），取数/复制为 composable（`use-export-task.ts`）。

### 优化（样式）

- **任务详情 footer 底部分隔线样式内聚（用户调整，`21d61212`）**：移除 `details.vue` 外层 `> .nue-footer` 的重复定义（padding / height / border-top），`border-top` 内聚至 footer 组件自身。

### 其他（Chore）

- i18n 中英新增 17 键（导出相关：标题 / 按钮 / 复制 / 元信息标签 / 段落标题），zh-CN / en-US / types 三处同步。
- 测试新增 `export-markdown.test.ts`（7 例）与 `use-export-task.test.ts`（6 例，含递归 / 分页 / 深度上限 / 复制），全量 83 文件 / 716 例。

### 质量门槛

- `vp check`：目标文件 pass（fmt / lint / type）。
- `vp test`：83 文件 / 716 例全绿。
- `pnpm webapp build` ✓ / `pnpm desktopapp build` ✓。

[v1.7.7]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.7.7

## [v1.7.6] - 2026-09-20

发布批次：日历界面 UI 优化（TASK-11 ①③ + 触发器改截止时间修订 + ② 还原）+ 用户样式微调（patch）。**Tag `v1.7.6`** · root `1.7.6` / `@nao-todo/desktopapp` `1.7.6` / `@nao-todo/webapp` `1.7.6`（`@nao-todo/presentation` `0.4.4` / `@nao-todo/shared` `1.3.0` / `@nao-todo/infrastructure` `0.5.0` / `@nao-todo/presentation-identity` `1.2.0` / `@nao-todo/domain-task` `1.2.0` / `@nao-todo/presentation-react` `0.1.0` 不动）。范围：web + desktop（日历 UI）。

### 优化（日历）

- **格子头部两端对齐（TASK-11 ①）**：`.cal-cell-top` / `.wk-cell-top` 撑满格宽 `justify-content: space-between`，日期号靠左、专注角标靠右（无角标时数字仍靠左，列对齐一致）。
- **任务条末尾触发器改显示截止时间（TASK-11 ③ 修订）**：有截止时刻（`showTime` 且 `endAt` 合法）时触发器显示 `HH:mm`（常显），点击仍弹改期下拉；否则回退 `more-vertical` 三点图标（悬停出现，单击仍可改期）；触发器 hover 沿用底色提示；时间/图标共用 `.cal-item-more`，拖拽跳过统一。
- **段末截止时刻（TASK-11 ③）**：任务条时刻内容由 `startAt` 改为 `endAt` 并移至名称末尾；月/周视图可见性判定由「真起始段」改为「真末段」，抽为共享纯函数模块 `segment-time.ts`（可单测）。
- **任务条名称文字抬升（用户调整，`7b5c87f4`）**：`.cal-lanes` 内嵌套 `.cal-item-text { z-index: 3 }`，名称文字高于网格分隔线；仅名称，条背景/色条/触发器仍在网格线下方。

### 还原

- **任务条整条抬升撤销（TASK-11 ②，`c36167e0`）**：任务条整条抬升至网格线之上的尝试经用户实测效果不佳，已撤销；网格分隔线回到任务条上方（TASK-07 状态）。

### 其他（Chore）

- 测试同步：新增 `segment-time.test.ts`（7 例）+ `task-bar.test.ts` 触发器/段末时刻断言（全量 81 文件 / 703 例）。

### 质量门槛

- `vp check`：目标文件 pass（fmt / lint / type）。
- `vp test`：81 文件 / 703 例全绿。
- `pnpm webapp build` ✓ / `pnpm desktopapp build` ✓。

[v1.7.6]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.7.6

## [v1.7.5] - 2026-09-15

发布批次：日历模块结构 / 视图 UI / 排序下拉 / 标题年月跳转与改期菜单（NueDropdown 化）+ 任务详情子任务节点 UI + 用户样式微调（patch）。**Tag `v1.7.5`** · root `1.7.5` / `@nao-todo/desktopapp` `1.7.5` / `@nao-todo/webapp` `1.7.5`（`@nao-todo/presentation` `0.4.4` / `@nao-todo/shared` `1.3.0` / `@nao-todo/infrastructure` `0.5.0` / `@nao-todo/presentation-identity` `1.2.0` / `@nao-todo/domain-task` `1.2.0` / `@nao-todo/presentation-react` `0.1.0` 不动）。范围：web + desktop（日历 + 任务详情 UI）。

### 优化 / 重构（日历）

- **结构优化（T6）**：月/周共享样式归并至 `calendar-grid.css`（净减 227 行）；`useCalendarGrid` / `useMonthJump` 抽取为共享 composable；god-composable 拆分（538 → 312 行，`useCalendarTaskQuery` / `useCalendarSchedule`）；周视图 33 个 props 收敛为 provide/inject 上下文；每格派生数据预计算（42 格 × 模板重复调用 → 每格一次）；拖拽卸载清理；死码清理 + 空态工厂（O6）；无障碍语义（`gridcell` / role / `aria-pressed`）。
- **视图 UI（T9，含用户微调）**：网格分隔线覆盖层（线在任务条上方 + 降亮度）；N+ 文本颜色增强对比；任务条行高 16 → 20px（`GRID_ITEM_STEP` 同步 22）；跨周续接圆点移除（数据语义保留）；整格点击不再开当日抽屉（仅 N+ 触发）；用户后续微调末列分隔线渐变修复（`9bcd9272` / `0c0047e0`）。
- **排序下拉（TASK-08，`4eb78a4f` / `726ecee3`）**：月/周视图头部新增排序下拉（优先级 / 开始时间 / 截止时间 / 创建时间 + 升降序），未选字段默认按名称升序（`localeCompare`）；独立 localStorage 键 `naotodo.calendar.sort` 持久化、双视图共享；仅影响日历展示顺序，不回写服务端、不改 `sortId`（拖拽改期仅改日期）。
- **中间标题年月跳转改 NueDropdown（TASK-09，`d6e8b77e` / `4ed8e3fc`）**：废弃手写弹层 `month-jump-panel.vue`（-214 行），新增 `calendar-month-grid.vue` 经 NueDropdown `execute` 委托；开合 / 定位 / Esc / 外点由 NueDropdown 内建；月跳月 / 周落周语义不变。
- **任务条右键菜单移除 + 改期菜单改 NueDropdown（TASK-10，`3350404f` / `cc175949`）**：任务条右键完全禁用（`@contextmenu.prevent`，阻止原生菜单 + 无响应）；`reschedule-menu.vue` 内部改 NueDropdown（任务条三点 + 抽屉「安排到…」统一触发器插槽，同 group 互斥），「选择日期…」保留内嵌 `NueDatePicker`；键盘弹层抑制谓词同步（移除常驻 `.rmenu` 判定，改由 NueDropdown 容器 / popup-pool 覆盖）。
- **测试整理（TASK-14，`1be3c939`）**：19 个 calendar 测试文件统一移入 `monthly/__tests__/`（纯路径变更，用例数不变）。

### Added（新增）

- **任务详情子任务节点 UI（TASK-06，`a250cd96` / `3cc7ada2`）**：移除「脱离父任务」按钮；时间与描述合并单行（`·` 分隔，`clamped=2`）；名称行右侧新增检查项 / 子任务数量徽标（>0 渲染）。

### 其他（Chore）

- 用户样式 / 图标调整（iconfont 重新生成，新增 `icon-ntd-disconnect`，移除未引用图标）。

### Changed

- 版本协同 bump（patch）：root / `@nao-todo/desktopapp` / `@nao-todo/webapp` `1.7.4 → 1.7.5`；`@nao-todo/presentation` `0.4.3 → 0.4.4`（T7 / TASK-06 改动 `subtasks.vue`，沿 v1.7.1 先例）。其余包不动（i18n 文案新增不触发 bump，沿 v1.7.3 先例）；无公开 API 导出面破坏。

### 质量门槛

- `vp check`：目标文件 pass（fmt / lint / type）。
- `vp test`：80 文件 / 691 例全绿（含日历排序 / 年月跳转 / 改期菜单 NueDropdown 迁移与 19 文件 `__tests__/` 迁移）。
- `pnpm webapp build` ✓ / `pnpm desktopapp build` ✓。

[v1.7.5]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.7.5

## [v1.7.4] - 2026-09-14

发布批次：子任务行标签栏 flex 压缩修复 + oxfmt 全仓归一化 + .agents 目录重组（patch）。**Tag `v1.7.4`** · root `1.7.4` / `@nao-todo/desktopapp` `1.7.4` / `@nao-todo/webapp` `1.7.4`（`@nao-todo/presentation` `0.4.3` / `@nao-todo/shared` `1.3.0` / `@nao-todo/infrastructure` `0.5.0` / `@nao-todo/presentation-identity` `1.2.0` / `@nao-todo/domain-task` `1.2.0` / `@nao-todo/presentation-react` `0.1.0` 不动）。范围：web + desktop（presentation 子任务行样式）+ 全仓工程（oxfmt 归一化 / .agents）。

### Fixed（修复）

- **子任务行标签栏 flex 压缩修复（`b0db5d6`，用户手动修复）**：`.subtask-row__title-line` `gap` `xs → 2xs` + `flex-wrap: nowrap`；`.subtask-row__tags` `flex 0 1 auto → 0 0 auto` + `nowrap`，移除 `max-width: 55%` 上限——修复长标签把名称挤没 / 标签栏被压缩的布局问题。

### Chore（工程）

- **oxfmt 全仓归一化（`764044c`）**：829 文件（ts / vue / css / json / md）统一 oxfmt 规范，含换行符对齐 `.editorconfig`（CRLF）；`git diff -w` 验证纯格式零语义变更。
- **.agents 目录重组（`4b7eae3`）**：prompts / common / scripts / skills 重构与技能包拆分，删除旧命令 / 技能。

### Changed

- 版本协同 bump（patch）：root / `@nao-todo/desktopapp` / `@nao-todo/webapp` `1.7.3 → 1.7.4`；`@nao-todo/presentation` `0.4.2 → 0.4.3`（subtasks.vue 真实样式修复，沿 v1.7.1 先例）。其余包不动（oxfmt 纯格式零语义，不触发语义 bump）；无公开 API 导出面破坏。

### 质量门槛

- `vp check`：1219 文件格式全对 + 1045 文件无 lint / type 错误。
- `vp test`：73 文件 / 645 例全绿（含 `subtasks.test.ts` 14/14）。
- `pnpm webapp build` ✓ / `pnpm desktopapp build` ✓。

[v1.7.4]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.7.4

## [v1.7.3] - 2026-09-14

发布批次：设置-应用设置新增版本号显示（patch；webapp 首次纳入版本协同）。**Tag `v1.7.3`** · root `1.7.3` / `@nao-todo/desktopapp` `1.7.3` / `@nao-todo/webapp` `1.7.3`（新增 version 字段，首次纳入协同；`@nao-todo/presentation` `0.4.2` / `@nao-todo/shared` `1.3.0` / `@nao-todo/infrastructure` `0.5.0` / `@nao-todo/presentation-identity` `1.2.0` / `@nao-todo/domain-task` `1.2.0` 不动）。范围：web + desktop（设置页 UI + 构建配置）。

### Added（新增）

- **设置-应用设置版本号显示**：底部（语言 / 主题之后）新增只读版本号行（i18n `settings.version`，zh-CN / en-US / types 同步）。版本号**双端区分**：vite `define` 构建期从各自 package.json 注入 `import.meta.env.VITE_APP_VERSION`——Web 显示 `@nao-todo/webapp` 版本、Desktop 显示 `@nao-todo/desktopapp` 版本（desktop 复用 web 源码，经构建期注入区分）。
- **webapp 首次纳入版本协同**：`apps/web/package.json` 新增 `version: 1.7.3`（此前无此字段）。

### Changed

- 版本协同 bump（patch）：root / `@nao-todo/desktopapp` `1.7.2 → 1.7.3`；`@nao-todo/webapp` `1.7.3`（新增）。其余包不动；无公开 API 导出面破坏。

### 质量门槛

- `vp test`：73 文件 / 645 例全绿。
- `vp check`：目标文件 pass（fmt / lint / type）。
- `pnpm webapp build` ✓ / `pnpm desktopapp build` ✓；产物核验：web 注入 `1.7.3`、desktop 注入桌面端版本（bump 前实测 `1.7.2`，bump 后 `1.7.3`）。

[v1.7.3]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.7.3

## [v1.7.2] - 2026-09-14

发布批次：桌面端同步状态栏 UI 重构 + 日历月/周边距微调（patch）。**Tag `v1.7.2`** · root `1.7.2` / `@nao-todo/desktopapp` `1.7.2`（`@nao-todo/presentation` `0.4.2` / `@nao-todo/shared` `1.3.0` / `@nao-todo/infrastructure` `0.5.0` / `@nao-todo/presentation-identity` `1.2.0` / `@nao-todo/domain-task` `1.2.0` 不动；webapp 无 version 不参与）。范围：web + desktop（renderer UI 层）。

### Fixed（修复 / 重构）

- **桌面端同步状态栏 UI 重构**：面板结构 nue-text 化（li 行改直挂面板根）、`placement` 调整 `right-center → top-start`、新图标 `ntd-sync2`、footer 动作按钮去包装；内容可见性改由库 `data-visible` 控制（移除组件级 @close 卸载）。
- **日历月 / 周边距微调**（`apps/web/src/components/calendar/monthly|weekly/index.vue`）；新增 iconfont 图标（`iconfont.css` / `.woff2`）。
- **测试同步**（`sync-status-bar.test.ts`）：选择器对齐新结构（`.sync-panel__row` / `.sync-panel__footer` / `.sync-panel__error` → 面板根 / 按钮 / title 全文定位），行为断言全部保留（三态文案 / 错误 title 全文+无子元素 / 焦点归还 / live summary / 无障碍）。

### Changed

- 版本协同 bump（patch）：root / `@nao-todo/desktopapp` `1.7.1 → 1.7.2`。其余包不动；无公开 API 导出面破坏。

### 质量门槛

- `vp test`：**73 文件 / 645 例全绿**（含 `sync-status-bar.test.ts` 4/4，原 2 failed 已同步修复）。
- `vp check`：目标文件 pass（fmt / lint / type）。
- `pnpm webapp build` ✓ / `pnpm desktopapp build` ✓。

[v1.7.2]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.7.2

## [v1.7.1] - 2026-09-14

发布批次：TASK-04 详情面板子任务行标签展示（patch）。**Tag `v1.7.1`** · root `1.7.1` / `@nao-todo/desktopapp` `1.7.1` / `@nao-todo/presentation` `0.4.2`（`@nao-todo/shared` `1.3.0` / `@nao-todo/infrastructure` `0.5.0` / `@nao-todo/presentation-identity` `1.2.0` / `@nao-todo/domain-task` `1.2.0` / `@nao-todo/domain-project` `1.1.0` / `@nao-todo/presentation-react` `0.1.0` 不动）。范围：web + desktop（presentation 层）。设计记录：PRD `docs/prds/2026-09-14-task-details-subtask-tags.md`。

### Added（新增）

- **详情面板子任务行标签展示（TASK-04；`d3c5e5cc`）**：名称右侧原时间内联位改挂**只读 small 标签栏**（`clamped=2` 溢出 +N，标签池复用详情上下文，空标签不渲染）；时间下移为名称下、描述上**独立行**（文案 / 拼接规则不变，无时间不渲染）；脱离按钮 hover / focus-within 展示语义锁定；`.subtask-row__tags` 收缩上限防长标签挤没名称。

### Changed

- 版本协同 bump（patch）：root / `@nao-todo/desktopapp` `1.7.0 → 1.7.1`；`@nao-todo/presentation` `0.4.1 → 0.4.2`（TASK-04 展示增强，patch）。无公开 API 导出面破坏；移动端红线 `@nao-todo/presentation-react` 零改动。

### 质量门槛

- `vp test`：TASK-04 目标 14/14 绿（全仓 643/645，2 失败为既有 sync-status-bar 工作树状态，与本次零交集）。
- `vp check`：目标文件 pass（fmt / lint / type）。
- `pnpm webapp build` ✓ / `pnpm desktopapp build` ✓。

[v1.7.1]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.7.1

## [v1.7.0] - 2026-09-13

发布批次：设置分栏 / 搜索增强 / 离线边界加固 / 离线写入与自动回传 协同收尾。**Tag `v1.7.0` 待 PM 放行后打** · **前置：服务端 `5c0b25d3`（SYNC-DEF-01）已部署** · root `1.7.0` / `@nao-todo/desktopapp` `1.7.0` / `@nao-todo/infrastructure` `0.5.0` / `@nao-todo/presentation-identity` `1.2.0` / `@nao-todo/presentation` `0.4.1` / `@nao-todo/shared` `1.3.0`（`@nao-todo/domain-task` `1.2.0` / `@nao-todo/domain-project` `1.1.0` / `@nao-todo/presentation-react` `0.1.0` 不动）。范围：web + desktop（views / presentation / presentation-identity / shared / infrastructure 层）。设计记录：PRD `docs/prds/2026-09-13-shell-05-offline-boundary-hardening.md`、`docs/prds/2026-09-13-shell-06-offline-backfill.md`；ADR `docs/adr/2026-09-13-shell-06-offline-backfill.md`（C-38–C-45）。

### Added（新增）

- **离线写入与自动回传（SHELL-06）**：单机离线可写 + 恢复后自动补传，失败三分类（凭证 / 网络 / 业务）：
    - **失败三分类 + 退避（C-38/C-39，提交 `8cb1effa`）**：网络类（离线 / 超时 / 5xx / 归一化离线）⇒ 服务级 `pausedUntil`，**不写 item、不消耗重试额度**；业务 / 数据类 ⇒ item `nextAttemptAt` 指数退避（5s → 10s → 30s → 60s → 120s 封顶）；凭证类（401 / 403 / `10041`）维持既有「会话失效不自动重试」。可推判定改为 `isRetryDue`（替换 `retryCount >= MAX_PUSH_RETRY`，删除项同规则）。
    - **回传触发（C-40/C-43）**：启动 / 解锁、前台恢复（`visibilitychange → visible`，节流）、`online` 事件（**仅触发、不作鉴权**）、条件退避定时（有 pending 才存在，5s→10s→30s→60s→120s，成功即清）；全部经 `syncService.enqueue` 串行化 / 去重 / 节流；去除离线期无效推送（G11）。
    - **队列上限可见性与触顶恢复（C-41/C-42，提交 `9b24ce3b`）**：单表 1000 / 总量 2000，**仅提示不阻断、无数据丢失**；状态栏显示「有 N 项修改待同步（离线，联网后自动同步）」+「立即重试」；手动同步 / 网络恢复 / 前台恢复 / 重启经 `resetFailed` 重置暂停与退避并重新入列（含删除项）。
    - **暂停到期定时修复（SHELL-06-DEF-01，提交 `95a9744b`）**：暂停期不再直接 `return`，按 `pausedUntil` 到期安排 tick（clamp ≤120s），到期自动重试；单一定时器可重排、成功即清 ⇒ 修复「网卡在线但后端 5xx/超时」不自愈（BC-13）。
    - 存储层 `SyncQueueRecord` **纯追加可选字段**（`attempts` / `nextAttemptAt` / `lastErrorClass`）；**无 Dexie version bump、无新增索引**（C-44/C-45）。
- **搜索增强（SEA-04；`c11b755b` / `5d1b4366` / `81931547` / `e5733066`）**：URL 深链持久化（查询 / 筛选 / 命中字段 / 已删·已弃开关 / 分页）、搜索历史（本地持久化 + 回填）、命中字段标识与「含已删 / 已弃」开关、i18n 文案；DEF-01（`6e36d2d1`）详情下钻保留查询、DEF-02（`1987a641`）本地状态为单一事实源。
- **离线边界加固（SHELL-05）**：H6 vue-router 去重（`resolve.dedupe`）+ `$router` 降级（`6273acc3`）；门壳必达兜底与同步有界失败（`f7576426`）；全局未捕获错误可观测（`0b031a4c`）；导航目标合法化与回退链（`3f288ffa`）；内容视图去 profile 前置 + 默认视图自愈（`3c6a8fc6`）；离线进入前置校验、结构化凭证失败、`safeReplace` 收敛（`e58cf46f`）；离线登出（本地优先）与缓存昵称占位（`385e1d75`）；判空加固 `c1f86354` / `9e6f41c7`。会话管理离线显示「需联网」占位（G13）。
- **设置对话框左右分栏 + 定尺（SHELL-04；`ed081748`）**。
- **`@nao-todo/shared` 新增 locale 键**：SEA-04 `search.*`、SHELL-05/06 `sync.*` / `identity.*` / `gate.*`（zh-CN / en-US / types 同步）。

### Fixed（修复）

- **任务详情面板标签栏覆盖子任务（TASK-03；`25fef945`）**：`task-details/main` 标签栏与子任务区重叠修复。

### Changed

- 版本协同 bump（功能批次 → minor）：root / `@nao-todo/desktopapp` `1.6.0 → 1.7.0`；`@nao-todo/infrastructure` `0.4.0 → 0.5.0`（离线回传能力）；`@nao-todo/presentation-identity` `1.1.0 → 1.2.0`（离线身份 / 判空）；`@nao-todo/shared` `1.2.0 → 1.3.0`（新增 locale 键）；`@nao-todo/presentation` `0.4.0 → 0.4.1`（TASK-03 修复，patch）。
- **发布前置**：服务端 `5c0b25d3`（SYNC-DEF-01）**已部署**；**无 Dexie 版本迁移**；同步协议 / 表结构 / 游标未变。
- 无公开 API 导出面破坏；移动端红线 `@nao-todo/presentation-react` 零改动。

### 质量门槛

- `vp test --run`：**73 文件 / 641 例全绿**。
- `vp check --no-fmt apps packages`：**1025 文件 0 错 0 警**（仓库内未跟踪 `scripts/electron-smoke/*.mjs` 为 QA 工具脚本，不计入本版范围）。
- `pnpm webapp build` ✓ / `pnpm desktop:build` ✓ / `pnpm guard:ddd` OK。

### 已知遗留

- 本版未打 tag：`v1.7.0` 待 PM 放行后打注解 tag。
- 客户端 `v1.7.0` 发版须晚于服务端 `5c0b25d3` 上线（已部署）。
- SHELL-06 触发源注册与上限提示 UI 未补独立组件测试（能力经纯层单测 + 门禁构建覆盖）；`crypto-service` 多用户隔离用例偶发超时（隔离运行通过）。

[v1.7.0]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.7.0

## [v1.6.0] - 2026-09-13

发布批次：SORT-01 详情面板子任务拖拽排序（per-group `sort_id`）。**Tag `v1.6.0` 待 PM 放行后打** · **前置：服务端 `fc20c74` 需先上线**（`GetMaxSortId` 按组 + `CreateTaskReq.sortId` + `parentTaskId` 查询默认序）· root `1.6.0` / `@nao-todo/desktopapp` `1.6.0` / `@nao-todo/presentation` `0.4.0` / `@nao-todo/infrastructure` `0.4.0` / `@nao-todo/domain-task` `1.2.0`（`@nao-todo/shared` `1.2.0` / `@nao-todo/domain-project` `1.1.0` / `@nao-todo/presentation-react` `0.1.0` 不动）。范围：web + desktop（presentation / infrastructure / domain-task 层；移动端红线零改动）。设计记录：ADR `docs/adr/2026-09-13-subtask-reorder.md`（r3）；PRD `docs/prds/2026-09-13-subtask-reorder.md`（AC1–AC15）。

### Added（新增）

- **子任务拖拽排序（SORT-01；per-group 作用域）**：详情面板子任务区支持整行拖拽重排，排序键 `sortId ASC, id ASC`；组 = 同一 `parentTaskId`（`0` = 顶层组）。落点（提交 `c176c922`）：
    - **`sortId` 全链路透传**：`TaskRes` / `TaskEntity`（尾部可选 `=0`）/ `TaskViewObject` / `UpdateTaskViewObject` / `CreateTaskReq`；`persistence-go`·`persistence-local` 转换器与 `TaskRecord`（**无 Dexie version bump**，ADR §5.3）；旧响应/旧记录缺失兜底 `0`；sync tasks `entityToPush` 白名单 +`sortId`。
    - **`0` 不产出**：`createTaskValueObject2Req` 与 push 载荷在 `sortId = 0` 时省略该字段（ADR B1/G4，防存量推送清零组内序）。
    - **`TaskUseCase.resort(originalId, boundId, isBefore, { allowRebuild })`**：组内浮动间隔 1000 + **仅本组**重建（`1000, 2000, …`，复用 `batchUpdate`）；预检「目标位置 == 当前位置」⇒ no-op；重建触发 `newSortId <= 0`（前插得 0）/ `> 65535` / 相邻差 `< 2`；单条失败 ⇒ 本组重建后重试一次；组 `> 65` 行或未取尽（R1/Q2）⇒ 禁用重建，仅单条浮动赋值。
    - **子任务按组全量加载**（`limit = 100`）并按 `(sortId, id)` 展示，`resortSubTasks` 带 `pagination.total` 判定的 `allowRebuild`（R1 数据顺序阻断项处置）。
    - **拖拽 UI 模仿检查项**：`useEventDragger` 参数化（row/list/idKey，默认值保持检查项契约）+ 同列表守卫 + 交互元素 `dragstart` 防误触；`subtasks.vue` 整行拖拽 + up/down 蓝色插入指示线；dragImage 自定义半透明鬼影（提交 `afdb8228`：`setDragImage` clone，`opacity 0.35`、离屏挂 body、光标对位 offset、异步移除；提交 `c8d12d73`：补 `--nue-primary-color-100` 浅灰底 + `--nue-primary-radius` 圆角）——两列表统一观感。

### Changed

- 版本协同 bump：root / `@nao-todo/desktopapp` `1.5.0 → 1.6.0`；`@nao-todo/presentation` `0.3.0 → 0.4.0`；`@nao-todo/infrastructure` `0.3.0 → 0.4.0`；`@nao-todo/domain-task` `1.1.0 → 1.2.0`。
- `TaskEntity` 构造器新增**尾部可选** `sortId = 0` ⇒ 非破坏 minor，既有调用点零改动；`TaskUseCase.resort` 为新增方法，无导出面破坏。

### 质量门槛

- `vp test run`：**59 文件 / 541 例全绿**（SORT-01 新增 +26 例：resort 10、转换器与 push 白名单、排序与重建守卫、拖拽组件/ghost）。
- `vp check --no-fmt`：**1011 文件 0 错 0 警**。
- 突变验证：重建条件回改 `< 0` ⇒ 2 failed；移除 push 的 `0` 省略 ⇒ 1 failed；注释 `applyDragImage` ⇒ 1 failed。

### 已知遗留

- 顶层任务列表手动排序（组 0）与顶层默认序（需先做 `sort_id = 0` 数据普查/回填）另立（ADR §12）。
- 跨父拖拽 reparent 另立；换父仍走既有父选择器/脱离入口。
- `Restore` 保留原 `sort_id` 不重排（B7）；组内 `> 65` 行重建降级策略、服务端按组 `resort` 接口为观察项。
- 发版顺序约束：客户端 `v1.6.0` 必须晚于服务端 `fc20c74` 上线（本版未打 tag）。

[v1.6.0]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.6.0

## [v1.5.0] - 2026-09-13

发布批次：领域统计属性（计数）字段透传 —— 客户端收尾单。**Tag `v1.5.0` 待 PM 放行后打**（架构评审修正：服务端上线 + `backfill_counts.sql` 回填完成后才可客户端发版；本版只做版本号/CHANGELOG 准备与提交）· root `1.5.0` / `@nao-todo/desktopapp` `1.5.0` / `@nao-todo/presentation` `0.3.0` / `@nao-todo/infrastructure` `0.3.0` / `@nao-todo/domain-task` `1.1.0` / `@nao-todo/domain-project` `1.1.0`（`@nao-todo/shared` `1.2.0` / `@nao-todo/presentation-react` `0.1.0` 不动）。范围：web + desktop（presentation / infrastructure 层）。设计记录：ADR `docs/adr/2026-09-12-stat-counts-denormalized-events.md`（r2）；PRD `docs/prds/2026-09-13-stat-counts-denormalized-completion.md`（AC11–AC15）。

### Added（新增）

- **领域统计属性（客户端只读透传；计数 = 服务端 owned）**：Task +`checkItemCount / commentCount / subtaskCount`，Project +`taskCount`。字段透传（提交 `8ce494cb`，ADR §13.2 全 13 项）：
    - 远程模型 `TaskRes` +3 / `ProjectRes` +1；`taskRes2TaskEntity` / `projectRes2Entity` 映射，旧服务端/存量响应缺失兜底 `?? 0`（AC11）。
    - 实体 `TaskEntity` +3 / `ProjectEntity` +1 **尾部可选参数（默认 0）** ⇒ 既有 8 个 `new TaskEntity(...)` 调用点零改动（AC14）。
    - 视图对象 `TaskViewObject` +3 / `ProjectViewObject` +1；`taskEntityToViewObject` / project 转换器逐字段显式透传（AC12）。
    - 本地 `TaskRecord` / `ProjectRecord` 接口 +字段（**无 Dexie version bump、无索引**，ADR §5.3）；record↔entity 映射 `undefined` 兜底 0（AC13）。
    - `sync-service.ts` push 白名单**不含计数**（双向拒绝客户端计数；服务端 req 亦无），回归断言把关（AC15）。
- **任务详情视图对象计数透传 + 单测**：`TaskDetailsViewObject` 组装器 `use-task-view-object.ts` 显式透传 3 个计数字段（逐字段复制模式的涟漪），并补单测断言计数进入详情视图对象且随 store 同步刷新（QA 复核缺口）。

### Changed

- 版本协同 bump（ADR §9）：root / `@nao-todo/desktopapp` `1.4.5 → 1.5.0`；`@nao-todo/presentation` `0.2.1 → 0.3.0`；`@nao-todo/infrastructure` `0.2.2 → 0.3.0`；`@nao-todo/domain-task` / `@nao-todo/domain-project` `1.0.0 → 1.1.0`。
- 实体构造器为**非破坏 minor**（尾部可选参数，签名不破坏）⇒ 未升 major。
- 无公开 API 导出面变更；`shared` / `presentation-react`（移动端红线）零改动。

### 质量门槛

- `vp test run`：**58 文件 / 515 例全绿**。
- `vp check --no-fmt`：**1010 文件 0 错 0 警**。
- 突变验证：移除详情组装器 3 行计数透传 ⇒ 新增单测 1 failed（真实护栏）。

### 已知遗留

- 计数**展示 UI**（角标位置/文案/项目列表任务数）不在本单，另立 UI 单（ADR §14）。
- 本地乐观增量（离线写后本地计数 +1 回显）首版不做（ADR §5.4 可选增强）。
- 按计数排序若要索引 ⇒ 才需 Dexie version(5)（观察项）。
- 发版顺序约束：客户端 `v1.5.0` 必须晚于服务端上线 + 回填完成（本版未打 tag）。

[v1.5.0]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.5.0

## [v1.4.5] - 2026-09-12

发布批次：任务查询默认排除已删除（快速修复）。Tag: `v1.4.5` · root `1.4.5` / `@nao-todo/infrastructure` `0.2.2` / `@nao-todo/desktopapp` `1.4.5`（`@nao-todo/presentation` `0.2.1` 不变）。范围：本地查询层（web + desktop 共用；mobile 走服务端仓库，零影响）。

### Fixed（缺陷修复）

- **任务查询默认包含已删除任务（含子任务）**：`task-repo-impl.ts` 未传 `isDeleted` 时不过滤，已删除任务（含子任务）照常出现在默认视图查询里——与项目仓库（`project-repo-impl.ts`「对齐远程 GET /projects/ 语义」）及 `isGivenUp`「默认排除」惯例不一致。修复（提交 `8f5dbb6a`）：默认（未传）或 `isDeleted=false` ⇒ 排除已删除；`isDeleted=true` ⇒ 仅已删除（行级过滤，父/子一视同仁）。
- 影响面：父任务选择器显式 `isDeleted:false` 不受影响；「垃圾桶」内置视图（`builtin.deleted`）显式 `isDeleted:true`，**不受默认排除影响**；移动端走服务端仓库，零跨端涟漪。
- 恢复路径（订正，2026-09-12 用户提示「垃圾桶」后核实）：「垃圾桶」内置视图**已存在**（`builtin.deleted`，`default.ts:177` 偏好 `getTasksOptions` 显式含 `isDeleted: true` + `sort: deletedAt desc`）——显式传参不受默认排除影响 ⇒ **恢复入口完好**，本批不触碰它。

### Changed

- 无公开 API 变更（`infrastructure` `0.2.1 → 0.2.2` 为 patch；行为默认值变更属缺陷修复）。

### 质量门槛

- `vp test run`：**503 passed**（唯一失败 = 已裁决的周六边界 flake `task-filter-core tomorrow/week`，与本次无关；`local-repos.test.ts` 59/59 全绿）｜`vp check --no-fmt`：**1007 文件 0 错 0 警**。
- 突变验证：回退旧实现跑新 2 测试 ⇒ 2 failed（真实护栏）。
- 新增测试：默认不查已删除任务 / 默认不查已删除的子任务。

### 已知遗留

- 周六边界 flake（`task-filter-core.test.ts`，presentation-react 红线包内）未修（test-only 修复待用户放行）。
- 其余同 v1.4.4（A6 删除 / 协议 v2.3 落 PRD §9 / DEF-STORE-01 重构 / C4 前半 / §7）。

[v1.4.5]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.4.5

## [v1.4.4] - 2026-09-11

发布批次：`DEF-STORE-06` 内存 store 未随落库失效（P1 用户可见陈旧）修复。Tag: `v1.4.4` · root `1.4.4` / `@nao-todo/presentation` `0.2.1` / `@nao-todo/desktopapp` `1.4.4`（`@nao-todo/infrastructure` 本版零改动，不 bump）。范围：web + desktop（presentation 层）。设计记录：ADR `docs/adr/2026-09-11-def-store-06-store-invalidation.md`。

### Fixed（缺陷修复）

- **`DEF-STORE-06`（P1，用户可见陈旧）：外部变更经「立即同步」已落本地 DB，但重载前内存 store 与面板行文案仍旧值**。根因 = 失效（invalidation）依赖**视图域订阅**：`nao-todo:data-changed` 的监听与 `RefreshData` 发射绑在 `index-view.ts`（随视图挂载存在/卸载消失），且 `TaskDetailsStore` 无任何 `RefreshData` 订阅者 ⇒ 详情副本只在 `initialize()`（路由变更/重挂载/重试）刷新。修复（ADR 决策，提交 `4e51ca30`）：
    - **方向 1**：新增应用级失效中心 `useStoreInvalidationHub()`（`packages/presentation/task/stores/store-invalidation.ts`）—— `window 'nao-todo:data-changed'` → 全局 `useSubscriber().emit('RefreshData')`，与视图挂载解耦；web/desktop 各一行接线；幂等守卫保证整应用只注册一次。
    - **方向 2**：`use-subtasks.ts` 订阅 `RefreshData` → `retrySubTasks()`（以当前父任务 id 清空整体重取 = 等价 `initialize()` 语义），`onUnmounted` 反订阅。
    - **方向 4（事件不丢失）**：`use-task-loader.ts` 的 `loadAndReplace` 由"在飞时静默丢弃"改为**单槽 pending**（置脏 → 完成后重跑一次；单槽天然防风暴）。
- 验收（QA 实机 T1 断言）：外部直写 + 立即同步 + **静置 3s 零交互** ⇒ `store.details` 与面板行文案**应变新**（重载自愈对照）。【QA 结论：**PASS**（`RUN_TAG=mtwulk95`：T1 时 `store.details`=B 且行文案=新值；T2 重载自愈对照通过；`pulls=1`、重复 pull=0 ⇒ hub 幂等守卫有效）】

### Changed

- 无公开 API 变更（`presentation` `0.2.0 → 0.2.1` 为 patch）。`stores/index.ts` 补导出 `store-invalidation`（接线所需）。

### 质量门槛

- `vp test run`：**55 文件 / 502 例全绿**（499 + 新增 3：在飞不丢失 / RefreshData 重取 / mock 补导出）｜`vp check --no-fmt`：**1006 文件 0 错 0 警**。
- 回归线：`sync-service.ts` / `syncStatus`（BC-3a/b/c）、五个视图适配器、`loadAndPush`/翻页均未触碰。

### 已知遗留

- 列表 store 的"顶层行 T1 仍陈旧"已**静态判定为分页作用域假象**（主列表默认只查顶层任务，子任务不进页内数据集；滚动/筛选触发新批次即新）⇒ **不立新单**。
- `DEF-STORE-01`（观察项，P2-leaning）维持；A6 `fillStartAt()` 死方法删除、§7"内容未变跳过写入"、T1 断言落常驻探针等仍为延后/待触发。

[v1.4.4]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.4.4

## [v1.4.3] - 2026-09-11

发布批次：`DEF-SYNC-05` 客户端拉取游标修复 + 零调用 API/死字段清理（补丁；含一处**包导出面收窄**）。Tag: `v1.4.3` · root `1.4.3` / `@nao-todo/presentation` `0.2.0` / `@nao-todo/infrastructure` `0.2.1` / `@nao-todo/desktopapp` `1.4.3`。范围：web + desktop（+ `infrastructure` 同步层）；**移动端不动**。设计记录：ADR `docs/adr/2026-09-11-def-sync-05-client-pull-cursor.md` + `docs/adr/2026-09-11-infra-cleanup.md`。

### Fixed（缺陷修复）

- **`DEF-SYNC-05`：外部变更经「立即同步」不回灌本地（P2）**。根因**两处叠加**：① 客户端游标推进用**字符串 max**（`applyPullBatch`，混合 `+08:00`/`Z` 表示法时**字典序即错**）；② 服务端 keyset 为**严格 `>`**（`updated_at > cursor OR (= AND id > cursorId)`，`query/sync.go:26-36`）⇒ 游标一旦越过某行 bump 后的 `updated_at`（毫秒级/同秒 + 更高 `cursorId`），该行**静默漏拉且永不重拉**（重载/重启自愈走的是**非 pull** 路径，故表现得像“能自愈”）。修法（ADR 选 **A**）：游标推进改**瞬时（ms）比较**；请求游标按瞬时**回拉 Δ=1s**，回拉时 `cursorId` 置空（同刻低 id 行否则仍被跳过）、**保持原时区后缀与精度形态**、**不可解析/无时区 ⇒ 原样返回**（退化为修复前行为，不冒险）。**存储游标只前进不后退**；BC-3a/b/c 回归线未触碰（diff 内相关符号出现 0 次）。
- 被否方案：**B**（拉取后以本地 `max(updatedAt)` 比对补偿 —— 受客户端时钟、未推送写入、服务端秒级截断干扰 ⇒ 易假阳性 ⇒ 触发重复拉取风暴）｜**服务端改 `>=`**（破坏 keyset 分页契约）。
- 验收：新增 4 例（含**硬判据**：预置 `syncCursor` ≥ 变更行 `updatedAt`（ms 级）+ fake requester 按服务端 keyset 严格 `>` 过滤 ⇒ 断言该行**仍被应用**）；并做**突变验证**（回退旧实现 ⇒ 新增 4 例**全 FAIL**，硬判据症状 `expected undefined to be defined` = 外部变更行确实未落库）⇒ 证明测试能抓住旧缺陷。

### Changed（API 收窄）

- **移除零调用公开 API 与死字段（`@nao-todo/presentation` 导出面收窄）**：`TaskHandler.updateTaskName` / `updateTaskDescription` / `updateTaskEndAt` / `giveUp`（4 个方法**全仓零引用**）+ `TaskDetailsStore.taskDetails` / `setTaskDetails`（**连带删除孤儿 import**）—— **同批一次删完，禁止半删**（避免留下语义不明的半成品 API）。判据三条：**零引用 + 无孤儿 + 不改运行时行为**。
- **保留**：`common.edit` 词典键（被 TASK-02 单测**反向断言**依赖，删除会静默弱化断言）；`TaskHandler` 其余存活方法。
- **延后**：客户端 `CreateTaskValueObject.fillStartAt()`（保留作服务端 `DEF-SYNC-04` 的语义参考，跨单协调后再处理）。
- ⇒ 版本语义：`@nao-todo/presentation` `0.1.3 → 0.2.0`（**移除导出面成员属破坏性变更**，0.x 下走 minor 位；本仓消费者对这 4 个方法零引用 ⇒ **实际破坏为 0**，语义如实标注）。

### 质量门槛

- `vp test run`：**55 文件 / 499 例全绿**（v1.4.2 基线 495 + 新增 4）｜`vp check --no-fmt`：**1005 文件 0 错 0 警**。
- 实机：QA `defsync05` 探针（外部 API 直写 → 「立即同步」→ 读本地 DB）在修复后应从 FAIL **转 PASS**（列后置复跑）。

### 已知遗留（本版不修）

- **回拉窗口的重复写入**：窗口内已应用的行会被再次 `put()` 并计入 `writtenCount`（`applyPullBatch` 未入队分支无条件 `put`）⇒ 理论上游轮同步**可能多触发一次 `data-changed`（视图重拉）**；**无数据风险**（同 id upsert 幂等）。若观察到刷新抖动 ⇒ 另单加“内容未变跳过写入”。
- **`DEF-SYNC-04`（服务端 P1，另一仓库）**：`FillStartAt()` 覆盖客户端显式 `startAt` ⇒ 已在 `nao-todo-server` 修复（`fae99e2` 提交；`go test -count=1` 三包通过，已独立复跑核对），待该仓发版。
- **`DEF-STORE-01`（观察项，P2-leaning）**：Pinia 任务多副本（两副本同 id 同时在场为**必然**、任一侧后续写入会让另一侧陈旧）；**用户可见陈旧未复现**（受控 P3 阴性）；修复方向 = **单一权威源**（另立设计单，不混入清理单）。
- **`DEF-UI-01`**：**已驳回关闭** —— 原判“已有时间窗子任务日历打不开”系**探针误报**（误找 creator 式按钮 + 误用无效区间）；实测日历可用、无效区间提交**有 toast 校验**非静默。
- **清理单延后/另立**：A6 `fillStartAt()`｜C1 `DEF-STORE-01` 单一权威源重构｜C2 `giveUp()`（含确认弹窗）与批量 `update({givenUpAt})`（静默）的**行为差异**（产品语义决策）｜C3 TASK-01 移动端遗留（继承未覆盖、继承规则升级 B、行内日期编辑）｜C4 SHELL-02/03 遗留（nue-ui 版本对齐、infrastructure 硬编码中文 i18n、离线写入口径、`apps/mobile` 壳耦合）。
- 其余沿用 v1.4.2/v1.4.1/v1.4.0 已登记遗留。

[v1.4.3]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.4.3

## [v1.4.2] - 2026-09-11

发布批次：TASK-02 子任务行布局精简（补丁）。Tag: `v1.4.2` · root `1.4.2` / `@nao-todo/presentation` `0.1.3` / `@nao-todo/desktopapp` `1.4.2`。范围：**仅 web + desktop**（均消费 `@nao-todo/presentation`）；**移动端不动**。明细见归档 PRD（`docs/prds/2026-09-11-subtask-row-layout.md`）+ ADR（`docs/adr/2026-09-11-task-02-subtask-row-layout.md`）。

### Changed（行为变更）

- **子任务行布局（TASK-02）**：开始/结束时间由第二行 meta **移至名称末尾内联**；**脱离父任务**按钮由独立操作列**移至名称末尾**，该列整体移除。布局判据 = **α + 时间相对上限**：时间 `flex: 0 0 auto`（宽度随内容、**不收缩**）+ `max-width`（默认 `60%`，CSS 变量 `--subtask-row-time-max-width` 可调）+ 省略号；名称 `flex: 1 1 auto; min-width: 0` ⇒ **空间不足时名称先被省略号截断、时间保持完整**；时间被截断时**全文由 `title` 提供**。
- **子任务改名入口收敛**：行内改名唯一入口（编辑按钮）移除后，**改名唯一入口 = 点击名称进入该子任务详情页标题**（`task-details/main/index.vue` 标题 textarea → `updateTaskDetails`）⇒ **能力不丢**。点击导航**仅挂在名称元素**：点击时间、点击脱离按钮**均不触发**详情导航。
- 描述**仍居第二行**（无描述则不渲染该行）；时间内联后 `metaText()` 的“时间 ~ 描述”拼接**死分支**一并清理。**不新增可见文案**（i18n 三文件未动）。

### Removed（移除）

- 子任务行内改名机制整体删除：编辑按钮 + 编辑输入框 + 编辑态 check/clear 按钮 + `data-editing` 属性 + 仅其使用的 CSS（`editingId`/`editingName`/`startEditName`/`submitEditName`/`cancelEditName`）。**`TaskHandler.updateTaskName` 保持零调用**（登记死代码，不在本单删）。

### 质量门槛

- `vp test run` **55 文件 / 495 例全绿**（本单 +1 文件 +6 例；TASK-01 既有 489 例**无回归**）；`vp check --no-fmt` **1004 文件 0 错 0 警**；提交前后各跑一次一致。
- 实机冒烟（Electron/CDP，`scripts/electron-smoke --feature task-02`）：**AC①…⑧ + 追加 A/B 全 PASS（PASS 34 / FAIL 0 / SKIP 0）**。关键实测：AC③ 时间截断 `181px ≤ 上限 183.2px`（占行宽 59.9%）；整行 `scrollWidth == clientWidth`（**无横向溢出**）；脱离按钮 `width=14 > 0` 且**未被裁掉**；`opacity` hover/focus 单帧 `0 → 1`（**无 transition**）。
- **TASK-01 冒烟回归**（`--feature task-01`，同文件被改）：case1–case4 + case1recheck **0 FAIL**。
- 提交：`2f04ec93`（实现）→ 发布提交（版本协同 + CHANGELOG）。

### 已知遗留（非阻断）

- **跳端不一致（C-R1；用户明确“移动端不动”）**：移动端子任务行 = `checkbox + 名称 + 删除(✕)`，**无时间展示 / 无行内改名 / 无脱离父任务**；web/desktop 端**无删除** ⇒ 两端**动作集不相交**。文档与验收**不得声称两端一致**；跨端收敛另立单。
- **名称截断事实口径**：详情抽屉内容宽固定 ~404px，内联时间约占 218px ⇒ **名称可用 ≈138px ≈ 10 个中文字**后省略号。用户已确认**保持 60%**（降上限会切掉尾部「截止 <时间>」= 本域锚点）；若要给名称腾空间 ⇒ “**压缩时间文案**”另单。
- `common.edit` 词典键三处定义**保留**（移除按钮后零引用属**预期**，**不得**当死键清理）。
- 时间整体截断**可能切在 `~` 中间**（预期；不拆分分段 `span`）。
- **`DEF-STORE-01`（观察项，暂不定级）**：任务实体在两 store 各存一份（`TasksStore.tasks` ↔ `TaskDetailsStore.tasks`，两个独立 `useMapperStoreBase` Map、无跨 store 同步）；且**两副本同 id 同时在场是必然**（`TaskUseCase.get` 末尾 `addTask` 写列表 store；子任务列表由 `subTaskUseCase` 写详情 store）⇒ 任一侧后续写入会让另一侧陈旧。但“用户可见的陈旧”**属未复现而非否定**：探针差异 0/10 的**前置条件未满足**（未断言两副本同 id 同时在场、且那轮未产生写入）⇒ **保持观察**；复现且该行曾被渲染出陈旧值 ⇒ P1。
- 其余沿用 v1.4.1/v1.4.0 已登记遗留（`DEF-SYNC-04` 服务端 `startAt` 覆盖、错误文案 i18n、离线写入边界、fmt 基线、nue-ui 双版本等）。

[v1.4.2]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.4.2

## [v1.4.1] - 2026-09-10

发布批次：TASK-01 子任务创建继承父任务清单与时间窗（补丁）。Tag: `v1.4.1` · root `1.4.1` / `@nao-todo/presentation` `0.1.2` / `@nao-todo/desktopapp` `1.4.1`。明细见归档 PRD（`docs/prds/`）+ ADR（`docs/adr/2026-09-10-task-01-subtask-inherit.md`）。

### Added（新增功能）

- **子任务继承父任务参数（TASK-01）**：任务详情页「添加子任务」创建时，新增继承父任务的**清单**（`projectId`）与**时间窗**（`startAt`/`endAt`）。规则 = **以 `endAt` 为锚的快照拷贝**：两者皆有效且 `start ≤ end` ⇒ 逐字拷贝两者；仅 `endAt` ⇒ 拷贝 `endAt` 且 `startAt=null`；`endAt` 缺失/无效 ⇒ 均**未安排**；`startAt` 缺失/无效/倒置 ⇒ 仅 `startAt=null`（**保留有效 `endAt`**）；`projectId` 原样拷贝（`''`/`null` 均＝收集箱）。新增**模块内**纯函数 `resolveSubTaskDraft`（单一实现；**不经包公开面导出** ⇒ 仍属 patch 变更）+ 5 例单测（U1–U5）。

### Changed（行为变更）

- **父任务未排期时，新建子任务不再默认落在「今天」**，而是**未安排**（此前硬编码 `endAt = 当天`）。注：子任务数据结构性隔离（写 `taskDetailsStore`，与日历/任务视图读的 `tasksStore` 分离）⇒ **不进日历、不进未安排桶、不影响计数**。
- 继承为**创建时快照**：父任务之后改清单/时间窗**不回写**已存在子任务（禁级联）。

### 质量门槛

- `vp test run` **54 文件 / 489 例全绿**（本单 +5 例）；`vp check --no-fmt` **1003 文件 0 错 0 警**；提交前后各跑一次结果一致。
- 提交：`5117cc48`（功能）→ 发布提交（版本协同 + CHANGELOG）。

### 已知遗留（非阻断）

- **跳端不一致（D7-a=B，用户裁决）**：移动端 `packages/presentation-react/src/logic/compose-task-usecase.ts:129` 的同源 `createSubTask` **未同步修** ⇒ 手机端新建子任务仍为「收集箱 + 当天」。**故本次不触发移动端发版**（`presentation-react` 不在本版版本表内属**有意**：`apps/mobile` 依赖的正是该包、不含 `presentation`）。升级判据 B-5（同类硬编码第二次回归）已命中 ⇒ 下一次触碰“子任务创建默认值”应直接升级为 application 层默认解析，不再逐端修。
- 存量数据**不回填**：同一父任务下新旧子任务可并存（旧为“今天”、新可能“未安排”），**不得当缺陷报**。
- 本单**不新增**子任务行内的日期编辑 UI（未安排子任务仍可进详情页设日期）。
- 待清理死代码登记（另立清理批次）：`CreateTaskValueObject.fillStartAt()`（`create-task.ts:98`，零调用点）、`taskDetailsStore.taskDetails/setTaskDetails`（零调用点）、`LocalUserRepoImpl`。
- 其余沿用 v1.4.0 已登记遗留（错误文案 i18n、离线写入边界、fmt 基线、nue-ui 双版本等）。

[v1.4.1]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.4.1

## [v1.4.0] - 2026-09-10

发布批次：SHELL-02 桌面端同步状态并入侧栏轨道 + SHELL-03 离线可用性（离线白屏 / 门壳终态完备 / 同步状态运行级语义 / 离线进入路由与守卫 / 离线身份呈现）。Tag: `v1.4.0` · root `1.4.0` / `@nao-todo/shared` `1.2.0` / `@nao-todo/infrastructure` `0.2.0` / `@nao-todo/domain-identity` `1.1.0` / `@nao-todo/presentation-identity` `1.1.0` / `@nao-todo/desktopapp` `1.4.0`。

> 两单同日交付且交叉依赖已闭合（SHELL-02 的失败可见性依赖 SHELL-03 的运行级语义；SHELL-03 的离线壳依赖 SHELL-02 的轨道注入点），故合并为一个发布批次。明细见 [docs/prds/2026-09-10-desktop-sync-status-rail-merge.md](docs/prds/2026-09-10-desktop-sync-status-rail-merge.md) 与 [docs/prds/2026-09-10-shell-03-offline-availability.md](docs/prds/2026-09-10-shell-03-offline-availability.md)，约束与决策见 [docs/adr/](docs/adr/)。

### Added（新增功能）

- **轨道同步入口（SHELL-02）**：同步状态由「视口左下角悬浮层」改为「主侧栏 70px 轨道底部、齿轮上方」的常驻按钮（`NueTooltip` 标签 + `NueDropdown` 面板 + `NueButton` 立即同步），面板含上次同步时间 / 待推送 / 失败 / 错误摘要（2 行截断 + `title` 全文）；附 `aria-label`、`aria-expanded` 与常驻读屏活动区域（只播摘要，不播错误全文）；中英三处新增 `sync.*` 7 键。
- **离线身份呈现（SHELL-03）**：本地缓存**昵称**（白名单 `{userId, nickname, cachedAt}`，明文 localStorage、无 TTL、失败静默、解锁前可读）→ 首字母头像（复用 `NueAvatar` 的 `default` slot + 确定性哈希色块映主题令牌）+ 离线标识；新增 `@nao-todo/presentation-identity` 的 `UserInitialAvatar` 组件与 `identity.*` / `gate.*` 4 键。
- **桌面端实机测试基建**：`scripts/electron-smoke/`（CDP 驱动真实 Electron、零第三方依赖、凭据只走环境变量；含 `checks/` 断言脚本、`lib/` 驱动、人工对照单）。

### Fixed（缺陷修复）

- **设置齿轮被同步浮层遮挡（SHELL-02）**：浮层 `position:fixed; left:1rem; bottom:1rem` 与轨道底部齿轮同水平带，指针路径 100% 不可点。修复 = 归位到侧栏轨道布局。
- **`z-index:9999` 压模态（SHELL-02，连带）**：该值越过 Nue 弹层池基线 99，导致设置对话框开启时浮层仍浮在遮罩之上且可点。修复 = 移除该 z-index，面板改由弹层池承载。
- **离线冷启动白屏（SHELL-03 / DEF-OFFLINE-01）**：`unlock-gate.vue` 模板仅 `v-if checking / v-else-if profile` 两分支且 `profile` 仅内存（离线必缺失）、`loadUserProfile()` 返回元组不抛错（原 `try/catch` 永不触发）⇒ 渲染空。修复 = 显式终态机（`checking`/`ready`/`error` + `v-else` 兜底）+ 就绪判据只用本地事实（JWT / 密钥包 / 本地库）+ profile 降级为装饰。
- **拉取阶段失败被同一次运行清空（SHELL-03 / DEF-SYNC-01）**：`markSyncing()` 在两阶段开端均 `set({lastError:null})` ⇒ 面板失败态永不出现。修复 = 同步状态引入运行边界（`beginRun`/`noteRunError`/`endRun`）。
- **队列项全超限时假成功 + `syncing` 永久 true（SHELL-03 / DEF-SYNC-02）**：`pushBody`/`deletions` 皆空时直接 `return` 不结算；且未确认实体仅 `console.warn`。修复 = 所有入口 `try/finally` 必达结算 + 失败/超限/未确认计入运行错误。
- **`lastSyncAt` 失败也推进（SHELL-03 / DEF-SYNC-03）**：`markSynced()` 无条件写时间戳。修复 = 仅无错运行推进（面板「上次同步」在失败运行后不再刷新，属**修正**）。
- **「离线进入」落登录页死路（SHELL-03 / DEF-01）**：离线时 auth 守卫把「有 JWT 但未认证」强制推入检入页，检入离线必败又 `replace('/auth/signin')` ⇒ 壳不可达。修复 = 跳转唯一点归 `AppRoot`（先 `await replace` 再挂载）+ 守卫**四条件**本地事实放行 + 会话级内存 flag + 检入失败分类（网络类不再跳登录页、改页内可重试）。
- **损坏的昵称缓存未清键（SHELL-03 / DEF-02）**：解析/形状失败时直接 `return`，脏键长期留存（与 C-16 文档约定不符）。修复 = `removeItem` 后返回 null。
- **`LoadingError` 潜在空渲染（SHELL-03 / F-5）**：末支 `<slot v-else />` 在调用方未提供 default slot 时渲染空。修复 = 加安全兜底（最小空态占位）。
- **壳耦合：轨道被 `profile` 门住（SHELL-03 / F-6）**：`aside-v2.vue` 的 `v-if="profile"` 使导航/齿轮/同步入口在离线时全部消失。修复 = 轨道常驻 + 身份区仅作装饰降级（含抽屉分支）。
- **凭证类失败不得授予离线进入（SHELL-03 / 安全）**：避免用无效凭证进壳；凭证类失败时「离线进入」隐藏。

### Changed（行为与口径变更）

- 同步状态语义：`lastError` = 本次运行**首个错误阶段**的错误（仅新运行清空）；新增 `errors[]` / `errorCount`；删 `markSyncing()`；`start()`/`manualSync()`/`pullAll()`/`pushAll()` 返回 `SyncRunResult`；初始同步门改以返回值判成败。
- 门/壳就绪判据分层：网络装饰数据（profile/config）**不得**作为就绪或渲染条件；缺失用占位。
- auth 守卫新增四条件离线放行（flag + JWT 用户一致 + 本地会话一致 + 本地已解锁）；**未**使用 `navigator.onLine`、**未**使用昵称缓存；在线且凭证无效仍走 signin/checkin。
- 检入页失败分类：网络类不再跳 `signin`（页内可重试，含「重试」+「重新登录」）；凭证类保持跳 `signin`。
- 初始同步门失败态三键：「重试」+「离线进入」+「登出/重新登录」（会话失效时主按钮文案切「重新登录」）。
- `AppRoot` 的 `initialSynced` 更名 `gatePassed`（语义 = 门已通过，含离线进入）。
- 新增用户可见文案一律 i18n；**存量**硬编码中文（解锁/登出/重试等）本轮不动（登记遗留）。

### 质量门槛

- `vp test run` **53 文件 / 484 例全绿**（本批新增 58 例）；`vp check --no-fmt` **1000 文件 0 错 0 警**；`webapp` / `desktopapp` 构建通过；`guard:ddd` OK。
- QA 实机（Electron 43.4.1 / Chromium 150，CDP 真实命中 + 内嵌证据）：**SHELL-02 PASS 51 / FAIL 0**；**SHELL-03 复跑 PASS 17 / FAIL 0 / SKIP 0**（BC-6 采单测口径，登记为验证方法选择）；测试前后 hash 逐条一致（无不明写入）。
- 冻结基线：SHELL-02 6 文件 / SHELL-03 最终 41 文件 hash 见两份 PRD 归档。

### 已知遗留（非阻断）

- 错误文案 i18n（infrastructure 内硬编码中文，如「拉取失败：网络错误」）与「等 N 项」计数文案。
- 离线**写入**完整口径（本地写上限、超限暂停提示、回在线批量回传可见性）；`retryCount` 无重置路径 ⇒ 永久超限设备每次冷启动停在 failed（可「离线进入」）。
- 离线专属常驻 UI（顶栏/图标「离线」标识）；`apps/mobile` 同类壳耦合未扫。
- 昵称缓存白名单之外的字段（**头像图片/邮箱**）若需缓存须**重新评审**（ADR 明载：白名单扩展即「有条件可行」结论失效）。
- `isCredentialFailure` 依赖错误文案匹配（现由文案集固定保证）；更稳做法是 `SyncRunResult` 增显式标记。
- `LocalUserRepoImpl` 疑似死代码；`NueAside` 的 `v-model:displayed` 为惰性写法；nue-ui 双版本并存（web 1.11.0 / desktop 1.10.58）；全仓 oxfmt 基线漂移（v1.3.0 已记 860 文件，本批 846）。
- QA 本地 dev 账号 `probe@x.local`（后端无 DELETE 用户端点）与昵称 `QA-Shell03`，登记待清理。

## [v1.3.3] - 2026-09-09

发布批次：SHELL-01-DEF-01 生产缺陷修复。Tag: `v1.3.3` · 修复提交 `5bc18ecd` · root `1.3.3` / `@nao-todo/presentation-identity` `1.0.1` / `@nao-todo/presentation` `0.1.1`。

### Fixed（缺陷修复）

- **设置对话框切「修改密码」致背景任务列表置空（SHELL-01-DEF-01）**：浏览器凭据自动填充把已保存账号邮箱写入任务名筛选框 → `GET /tasks?name=<邮箱>` 空返回 → 列表空态。修复 = 双保险：改密表单三密码输入标注 `autocomplete=current-password/new-password`（源侧隔离，浏览器不再视其为登录表单）+ 任务名筛选框内层 input `autocomplete="off"`（受害字段屏蔽，一处覆盖 全部/项目/标签 三视图）；附组件级回归单测 5 断言。

### 质量门槛

- vp test 42 文件 / 419 例全绿（含新增 5）；lint 0 错；webapp 生产构建通过（terser）。
- 真实浏览器自动填充路径 headless 无法触发，由新增单测覆盖（符合「仅生产复现则以断言覆盖」条款）；生产实机复验以用户指示发布为终签。

### 已知遗留（非阻断）

- 个别浏览器密码管理器对 `autocomplete="off"` 的 username 填充可能不完全尊重——备用方案（筛选框失焦/弹层关闭清空 name 过滤）待业务语义拍板。
- 日历/搜索页等同类型无 autocomplete 文本输入的全站排查建议单独立项（SHELL-01 齿轮全站可用）。

## [v1.3.0] - 2026-09-07

发布批次：日历排期效率 / 导航体验 / 番茄专注徽标三线（`v1.2.0..v1.3.0` 共 13 提交）。Tag: `v1.3.0` · Release commit: `a945a06c` · root `1.3.0` / `@nao-todo/shared` `1.1.0`。

### Added（新增功能）

- **日历排期效率三件套（CAL-07）**：未安排任务批量安排（多选模式 / 今天 / 明天 / 选择日期，部分失败保留选中可重试）；任务条快速改期菜单（右键 + 悬停三点：今天 / 明天 / 下周同日 / 选择日期…）；拖拽排期（未安排行拖出即安排、已排期任务条拖拽 = T1 整体平移改期，5px 阈值消歧点击）；共享改期内核 `reschedule.ts`（T1 平移语义）+ U2「最近一次操作撤销」action-toast。
- **日历导航体验（CAL-08）**：键盘导航（`←/→` 翻页、`T` 今天、`M/W` 切视图、`Enter` 开当日面板、`N` 格内快建；弹层开启 7 键全抑制；输入框守卫；n/p 遮蔽与回退）；标题点击年-月面板跳转（月视图定位 / 周视图落含 1 号周，weekStart 边界）。
- **番茄专注徽标（CAL-09）**：月格 / 周列头显示当日完成番茄轮数（type=1 按 startAt 落日，0 隐藏、99+ cap，含孤儿记录）；侧栏「专注徽标」开关（默认开、localStorage 持久化、off 停拉）。

### Fixed（缺陷修复）

- done 行单行「安排到…」守卫越权变更恢复 B7（单条含 done 可历史回填；仅批量/多选排除 done）。
- 抽屉内「安排到…」菜单外点 / 再点触发器不关闭（外点豁免收窄至 .rmenu / 触发器 / 展开的日期面板）。
- 专注徽标"请求有、徽标无"集成缺陷（store.records 为 Map 被强转数组迭代 → `toTimerRecordList` 归一 + Map 形态集成回归测试）。
- 逾期任务条呈现改版：背景 `error-10`（hover/focus → `error-20`）+ 左缘条仅随优先级（用户两轮裁决定稿）。

### Changed（行为/口径变更）

- `deferToToday`（当日面板"延期到今天"）归入 T1 内核：带 startAt 逾期任务整窗平移至今天（原仅改 endAt 会拉长跨度）。
- 全局 `n`（新建任务）/`p`（新建项目）命令绑定 `index-view` scope（五子 tab 均覆盖，auth 页 inert，无用户可见回归）。
- `@nao-todo/shared`：`Command.available` 上下文新增可选 `event`（供 Enter 等目标守卫判定）。

### 质量门槛

- vitest 39 文件 / 410 用例全绿（含 41+ 组件/集成断言）；vp check 0 错 0 警；webapp / desktopapp 构建通过。
- QA 独立验收（A 线 63 条 / C 线 27 条 / B 线 22 条用例）+ 用户 dev / 桌面（Electron 同源）双端终签冒烟。

### 已知遗留（P3，非阻断）

- `calendar.arrange_*` / `nav_shortcut` / `focus_badge_impression` 埋点口径已定义、落地待基建批次。
- pomodoro records store 跨区间累积不清理（建议 eviction）。
- `?`（快捷键帮助）/ `⌘K`（命令面板）全局实装后需对 C1 键位冲突复测。
- oxfmt 全仓 860 文件格式漂移（存量，另立清理批次）。

[v1.3.0]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.3.0
[v1.3.3]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.3.3
[v1.4.0]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.4.0