# T543 架构评审报告 —— 桌面端托盘常驻 / 开机自启 / 会话续期（Issue #254）

> 输入：PRD `docs/prds/2026-10-25-desktop-tray-autostart.md`（v1.0）· 缺陷池 `DEF-14` / `DEF-15` · `FEATURES.md` §3/§16 · `docs/prds/2026-10-24-settings-ia.md`（D1）· 跨仓 `nao-todo-server`。
> 口径：**影响面以 grep 穷尽 + 行段读码**为准（`pi-codegraph` 已卸载，`.codegraph/` 索引不存在；动态加载可能漏，见 §十一）。
> 交付物：`docs/adr/2026-10-25-desktop-tray-autostart.md`（决策）· `docs/research/2026-10-25-desktop-tray-autostart.md`（外部依据）· 本文件（影响面 / 指标 / 矩阵 / 风险 / 部署 / PRD 修订）。

## 一、可行性结论

**有条件可行**。核心路径成立且不需要新增运行时依赖，但有 **4 个必须由 PM/用户拍板的点**（不拍板就无法交付 AC）：

| 编号   | 决策点                                                                                                                             | 不拍板的后果                                               | 建议                                                                                  |
| :----- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------- | :------------------------------------------------------------------------------------ |
| **P1** | `R5`「macOS 关窗不退**保持不变**」字面成立 ⇒ macOS 关窗仍**销毁窗口** ⇒ 渲染层（提醒引擎）随之消失 ⇒ **AC1 / AC3 在 macOS 不成立** | 三平台里 macOS 明确「关窗后不提醒」，与 PRD TL;DR 承诺冲突 | 把 R5 改写为「**进程不退出语义不变**；三平台统一关窗 → 隐藏」，并在发布说明写清       |
| **P2** | 托盘「创建成功但不可见」（GNOME 无 AppIndicator 扩展）**无法程序化判定** ⇒ AC9 字面不可实现，且此时**没有可达的退出路径**          | 用户只能 `kill` 或注销；或误以为「关窗=退出」              | AC9 拆两态（构造失败 / 可能不可见）；设置「桌面常驻」块内**始终**提供「退出 NaoTodo」 |
| **P3** | 系统休眠（合盖/睡眠）期间定时器不运行 ⇒ 「到点必达」不成立                                                                         | 指标不可达、验收必吵                                       | §二/AC3 补前提「进程存活且系统未休眠」；唤醒后 ≤10s 补弹                              |
| **P4** | 托盘不可用（含 P2 的「不可见」）时，`D4`「自启静默到托盘不弹窗」会让应用**完全不可见**（无图标、无窗口）                           | 用户以为没启动 / 找不到窗口                                | 降级：**托盘不可用时自启改为正常显示窗口**（D4 仅在托盘可用时适用）                   |

其余（D0–D5、R1–R4、R6）与实现路径**无冲突**，不需要改口径。

## 二、影响面（改哪些包 / 仓）

### 2.1 本仓 `nao-todo`（分支 `feat/254-desktop-tray-autostart`）

| 落点                                                                          | 性质       | 内容                                                                                                                                                                                                             |
| :---------------------------------------------------------------------------- | :--------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/desktop/src/main/index.ts`                                              | 改         | 窗口 `close` → `hide()`（受状态机控制）；`backgroundThrottling:false`；`--autostart` 静默启动；`before-quit`/`query-session-end` 置退出位；`second-instance` 恢复窗口；`activate` 显示已隐藏窗口                 |
| `apps/desktop/src/main/tray.ts`                                               | **新**     | `createTray()` + 菜单（打开 / 退出）+ 状态（`available` / `unconfirmed` / `unsupported`）；Linux 变更菜单项后须重设 `setContextMenu`                                                                             |
| `apps/desktop/src/main/autostart.ts`                                          | **新**     | Win/mac `get/setLoginItemSettings` + 回读映射；**Linux 自写 XDG `.desktop`**；`AutoStartStatus` 三态                                                                                                             |
| `apps/desktop/src/main/app-settings.ts`                                       | **新**     | `userData/nao-desktop.json`：`autostartUserDisabled`、`trayHintShown`；原子写（tmp+rename），损坏回默认                                                                                                          |
| `apps/desktop/src/main/ipc.ts`                                                | **新**     | 仅 4 个通道：`getShellStatus` / `setAutostart` / `showMainWindow` / `quit`；校验 sender，不接受任意路径                                                                                                          |
| `apps/desktop/src/main/single-instance.ts`                                    | 改         | `focusMainWindow` 扩为 `show + restore + focus`（隐藏窗口 `focus()` 无效，AC5 需要）                                                                                                                             |
| `apps/desktop/src/preload/index.ts`                                           | 改         | 暴露 `desktopAPI.isDesktop === true` + 上述 IPC 的窄封装                                                                                                                                                         |
| `apps/desktop/src/renderer/src/hooks/use-desktop-shell.ts` + `hooks/index.ts` | **新**/改  | 桌面真实实现（状态订阅、开关、退出、显示窗口）                                                                                                                                                                   |
| `apps/desktop/src/renderer/src/AppRoot.vue`                                   | 改         | 接线会话续期（桌面专属文件，不进 Web 产物）                                                                                                                                                                      |
| `apps/desktop/build/tray/*`                                                   | **新资产** | Win ICO（16/24/32）、Linux PNG（22/24/32）、mac `trayTemplate.png` + `@2x`；总计 ≤40KB                                                                                                                           |
| `apps/web/src/hooks/use-desktop-shell.ts` + `index.ts`                        | **新**/改  | Web 桩实现（`isDesktop:false`，全部 no-op）⇒ **Web 行为零变化**                                                                                                                                                  |
| `apps/web/src/views/index/index-view.ts`                                      | 改（1 处） | `onOpenTask` 包装：先 `showTaskDetails`，再 `desktopShell.showMainWindow()`（Web 桩 no-op）                                                                                                                      |
| `apps/web/src/components/settings/panels/reminder-panel.vue`                  | 改         | 新增「桌面常驻」子块（D1），`v-if="isDesktop"`；三态 + 重试 + 退出入口                                                                                                                                           |
| `packages/shared/session-renewal/**`                                          | **新**     | 纯调度器（注入 `checkIn` / `now` / `timers` / `isIdle`），无框架、无 Electron 依赖；含单测                                                                                                                       |
| `packages/shared/requester/auth-rotation.ts`（+ `axios.ts` 分支）             | **新**/改  | 轮换宽限标记：`markTokenRotated()` / `consumeRotationGrace()`（10s 单次）；拦截器在宽限内收到 10041 时**不触发登出**（保留 `authExpiredFired` 语义，后续真实失效仍会登出）。**Web 从不调用 `mark` ⇒ 行为零变化** |
| `packages/shared/locales/*`                                                   | 改         | 新增文案键（说人话：不出现 `OCC` / `deviceId` / `tray` 等内部词）                                                                                                                                                |
| 测试                                                                          | 新         | `apps/desktop/src/main/__tests__/*`、`packages/shared/session-renewal/__tests__/*`、设置面板用例、**`backgroundThrottling===false` 防回退守卫**                                                                  |

### 2.2 跨仓 `nao-todo-server`（另一分支，本批只出方案）

见 §八（落点、开关、部署、验证均在那一节）。

### 2.3 零改动清单（验收口径）

- `packages/presentation-react` / `apps/mobile`：**0 文件**（移动端红线）。
- 提醒语义：`taskId@remindAt` 去重、免打扰 `[start,end)`、通知/声音开关、权限三态、子任务提醒、已完成/归档/放弃不提醒 —— **共享引擎逻辑 0 行改动**（只依赖窗口参数，见 §五 5.2）。
- `apps/web` 构建产物行为：新增文件均为桌面门控（`isDesktop===false` 时全部 no-op）。
- ⚠️ **口径提示**：桌面渲染层复用 `apps/web/src`（`electron.vite.config.ts` 的 `@` 别名）⇒「Web 端零改动」只能成立为**行为零变化**，不能成立为「web 源码零文件触碰」（`index-view.ts` / `reminder-panel.vue` 必改）。见 §九 RV2。

## 三、业务 NFR → 技术指标（T1–T7）

> 业务基线来自 PRD §六。指标为**提议**，qa 需先在改前采基线；阈值不达标 ⇒ 回本评审复议。

| #      | 业务基线                   | 技术指标（可度量）                                                                                                                                                                                                                                                      | 度量方法                                                                           | 可行性                                         |
| :----- | :------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------- | :--------------------------------------------- |
| **T1** | 隐藏期间到点必达、时效不变 | 隐藏态：`remindAt → notify` 延迟 **p100 ≤ 11s**（10s 轮询 + 1s 余量），p50 ≤ 1.5s；唤醒/联网恢复后补弹 **≤10s**；隐藏态扫描**不得停止**（轮询计数单调增）                                                                                                               | 探针任务（`remindAt=now+N`）+ 假窗口隐藏 + 记录时间差，20 样本；`performance` 打点 | 可行（`backgroundThrottling:false`，见 5.2）   |
| **T2** | 常驻无可感知 CPU/内存增量  | 隐藏空闲 15min（同构建、同日、改前基线 B=可见空闲 RSS/CPU）：CPU 中位 **≤1.5%**（单核）、p95 **≤5%**、无 ≥30s 连续 >10%；RSS **≤B×1.3**；24h 常驻 RSS 增量 **≤60MB** 且首小时后斜率 **≤5MB/h**                                                                          | `app.getAppMetrics()`（主进程采样 1/s）或 `ps -o %cpu,rss`；改前/改后各 3 次       | 可行，但**隐藏态仍绘制**（代价项），须真机抽样 |
| **T3** | 常驻 ≥48h 不掉登录（AC6）  | 续期周期 **12h ±10% 抖动**；触发补集：启动 / 唤醒 / `online` / 距上次成功 ≥12h，去抖 **≥5min**；失败退避 **1m→2m→5m→15m→30m**（封顶），成功重置；48h 内 **≥4 次成功续期、0 次强制登出**                                                                                 | 假时钟单测（调度器）+ 真机 48h 探针（qa 可缩短到 2×12h 观察 + 服务端日志）         | 可行（JWT 48h ⇒ 12h 周期留 4 倍余量）          |
| **T4** | 过期会话可回收、活跃不误删 | 每日 **03:10**（可配）；`expired_at < now-7d` 与 `deleted_at < now-1d`；**500 行/批、≤20 批/次、批间 50ms**；单次 ≤2s（dev 60 行）；**活跃会话删除数必须 = 0**                                                                                                          | 服务端单测（种子数据断言）+ 部署后 SQL 前后对账                                    | 可行（无 DDL；见 §八）                         |
| **T5** | 托盘/自启失败必须可见      | 托盘：构造抛错 ⇒ `unsupported`；成功 ⇒ `available`（Linux 附加 `unconfirmed` 语义，见 §四）。自启**以回读为准**：Win `openAtLogin && executableWillLaunchAtLogin`；mac `status==='enabled'`；Linux 文件存在且 `Hidden≠true`。任一非 `enabled` ⇒ 状态「未生效」+「重试」 | 主进程单测（注入 mock app）+ 真机三平台各 1 次                                     | 可行（唯一不确定：mac 见 R6）                  |
| **T6** | 单实例收口（AC5）          | 第二实例 → 退出 **≤1.5s**、**不创建窗口**、不触碰数据面；主实例窗口被 `show+focus`                                                                                                                                                                                      | 主进程单测 + 真机双开                                                              | 可行（既有锁 + 补 `show`）                     |
| **T7** | 不加依赖、不增包体         | 运行时依赖 **+0**；托盘资产 **≤40KB**；桌面主进程新增代码 ≤600 行                                                                                                                                                                                                       | `pnpm ls` / 产物 diff                                                              | 可行                                           |

## 四、平台矩阵与降级路径

| 维度             | Windows 10/11                                                                                                                       | Linux（X11 / Wayland）                                                                                                                                                                                                              | macOS（arm64，ad-hoc 签名）                                                                                               |
| :--------------- | :---------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| 托盘             | `Tray` + ICO，可靠；`guid` 仅签名后使用（本仓未签名 ⇒ 不用 guid）                                                                   | StatusNotifierItem；**GNOME 需 AppIndicator 扩展**，否则创建成功但不可见；KDE/XFCE/Cinnamon 正常                                                                                                                                    | 菜单栏 `Tray` + `Template` 图（16/32），可靠                                                                              |
| 关窗行为         | `hide()`（托盘可用）                                                                                                                | `hide()`（托盘可用）                                                                                                                                                                                                                | **待 P1 裁定**：字面 R5 ⇒ 保持销毁（无提醒）；建议统一 `hide()`                                                           |
| 开机自启         | `setLoginItemSettings({openAtLogin, args:['--autostart']})`（HKCU Run）；回读 `executableWillLaunchAtLogin`（任务管理器禁用可检出） | **无 Electron API** ⇒ 自写 `~/.config/autostart/nao-todo.desktop`：`Exec=<path> --autostart`、`TryExec=<path>`、`X-GNOME-Autostart-enabled=true`；**AppImage 必须用 `process.env.APPIMAGE`**（`execPath` 是每次不同的临时挂载路径） | `setLoginItemSettings({openAtLogin:true})` → SMAppService；macOS 13+ 可能返回 `requires-approval`（须用户在系统设置批准） |
| 自启生效判定     | `openAtLogin && executableWillLaunchAtLogin`                                                                                        | 文件存在 + 解析 `Hidden`（DE 可能回写）                                                                                                                                                                                             | `status === 'enabled'`                                                                                                    |
| 静默启动（D4）   | 可用（`--autostart` 不 `show()`）                                                                                                   | 可用，但**托盘不可见时改为显示窗口**（P4）                                                                                                                                                                                          | 可用                                                                                                                      |
| 通知点击还原窗口 | 可用（`desktopAPI.showMainWindow()`）                                                                                               | **部分 DE 不派发通知 action** ⇒ 退化为「只切窗口」                                                                                                                                                                                  | 可用                                                                                                                      |
| 托盘不可用降级   | 构造抛错 ⇒ 关窗即退出 + 状态「不支持」                                                                                              | 构造抛错 ⇒ 同上；**不可见** ⇒ 仍常驻 + 状态「已开启（可能不显示托盘图标）」+ 设置内退出                                                                                                                                             | 同 Win                                                                                                                    |
| 已知残留         | 卸载后 Run 键残留（指向不存在路径，系统忽略；不阻塞）                                                                               | AppImage 被移动后 `TryExec` 阻止启动（用户需重新开启）                                                                                                                                                                              | **ad-hoc 签名下登录项可能登记失败**（R6）                                                                                 |

**托盘判定口径（唯一）**：`new Tray()` 抛错 ⇒ `unsupported`；成功 ⇒ `available`；Linux 且 `XDG_CURRENT_DESKTOP` 含 `GNOME`/`Unity` ⇒ `unconfirmed`（**不探测 gsettings**，避免脆弱的 shell 依赖；`unconfirmed` 只影响文案与 P4 降级，不影响常驻）。

## 五、关键机制

### 5.1 生命周期状态机（主进程）

```text
boot(argv)
  └─ 取单实例锁（既有，先于窗口/托盘）
     └─ createWindow({ show:false, backgroundThrottling:false })
        ├─ 成功 → tray = createTray() ⇒ available / unconfirmed / unsupported
        └─ ready-to-show → 非 --autostart 且非「静默启动降级」⇒ win.show()
close 事件：isQuitting ? 放行 : (tray!==unsupported ? e.preventDefault()+win.hide()+首次提示 : 默认)
tray「打开」→ show + restore + focus
tray「退出」/ 设置「退出」→ isQuitting=true → app.quit()
second-instance(cmdLine)：cmdLine 含 --autostart ⇒ 忽略（不打扰）；否则 show+focus
window-all-closed：常驻态不退出；unsupported 且非 darwin ⇒ quit（旧行为）
activate(mac)：有窗口 ⇒ show；无窗口 ⇒ createWindow
before-quit / query-session-end / session-end(Windows)：isQuitting=true（防拦住系统注销/关机）
```

硬约束：**第一次 `close` 的一次性提示由主进程发系统通知**（隐藏后仍可见），标记落 `userData`（不走 `localStorage`，避免动 K10 白名单）。

### 5.2 为什么提醒引擎「零改动」仍能按时（关键结论）

- 现状：引擎在 `document.visibilityState === 'hidden'` 时**停轮询、停精确定时**（`create-reminder-engine.ts` + `reminder-engine-visibility.test.ts` 已固化该口径）。
- Electron 官方：`backgroundThrottling:false` 时 **`visibilityState` 保持 `visible`**（即使 `win.hide()`/最小化/遮挡）⇒ 引擎按原逻辑继续 10s 轮询 + 精确定时，**不需要改 `packages/shared/reminder` 一行**（Web 行为因此天然零变化）。
- 代价（必须验收）：隐藏态仍绘制/动画（T2）；`visibilityState` 不再反映真实可见性 ⇒ 既有的「隐藏即停」假设在桌面端失效（pomodoro tick / sync 的 `visibilitychange` 触发不再因隐藏而暂停，属可接受，但 qa 需回归）。
- 防回退守卫：桌面主进程单测断言 `webPreferences.backgroundThrottling === false`（否则提醒静默变慢，且无任何报错）。

### 5.3 会话续期时序与失败分流

```text
触发：启动成功 / 距上次成功 ≥12h(±10%) / powerMonitor.resume / window.online
门控：syncStatus 非 running（尽量避开同步在途）∧ 用户/同步空闲 ≥60s；无空闲窗口则每 5min 重试
执行：AuthUseCase.checkIn(currentToken)       ← 只用既有用例（含 DEF-5 网络/凭证分流）
成功：setUserToken(新 JWT)；lastSuccessAt=now；rotationAt=now；重置退避
网络失败：保留凭证；退避 1m/2m/5m/15m/30m（封顶）；网络恢复即补一次
凭证失败：停止续期 + 可见提示（隐藏态：系统通知「登录已过期，请重新登录」；打开后对话框 + 引导登录）
护栏：`markTokenRotated()` 后 10s 内到达的 10041 **不触发登出**（单次宽限，`authExpiredFired` 不置位）⇒ 该请求如实失败（同步层既有退避会重试），后续真实失效仍会正常登出（护栏落在共享请求器层 `auth-rotation.ts`；Web 从不 `mark` ⇒ 零行为变化）
```

- **7 天绝对期不变**：服务端 `CheckIn` 只换 token（`UpdateToken` 不写 `expired_at`），`expired_at` 仅在登录/同设备覆盖时 = `now+7d`（已读码确认）⇒ 客户端续期**无法**把会话续成无限期。
- **R4 成立**：网络类失败不清凭证（复用既有 `isCredentialError` 分流）；仅在明确凭证失效时走重新登录。
- 遗留：JWT 已过期（关机/休眠 >48h）时 `checkin` 无法成功 ⇒ 需重新输密码（属既有上限，写入 PRD 限制，见 RV10）。

### 5.4 自启持久化语义（默认开、可关、不反复骚扰）

`userData` 只存 `autostartUserDisabled`：

- 首次运行（无记录）⇒ 写入 `openAtLogin=true`（D0②「默认开启」）；
- 用户在设置关闭 ⇒ `autostartUserDisabled=true` 且写 `openAtLogin=false`，**此后永不自动重开**；
- 系统侧被禁用（Win 任务管理器 / mac 未批准 / Linux 文件被改）⇒ **不自动改回**，只显示「未生效」+ 重试。

## 六、安全语义

| 条款                 | 结论                 | 依据 / 约束                                                                                                                                                                                             |
| :------------------- | :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 7 天绝对期           | **维持**             | 服务端到期时间只在 `Create` 写 `now+7d`；`UpdateToken`/`CheckIn` 不动 `expired_at`；本批**不得**改用「每次 checkin 顺延」                                                                               |
| 续期失败不清凭证     | **成立**             | 复用 `AuthUseCase.checkIn` 的 `isCredentialError` 分流（`DEF-5` 口径）；调度器自身**不触碰** `clearAuthData`                                                                                            |
| 服务端不误删活跃会话 | **成立（有硬约束）** | 删除条件严格 `expired_at < now-retention`（retention ≥7d），而鉴权要求 `expired_at > now` ⇒ 两集合**恒不相交**；登出软删行 `deleted_at < now-1d`；批量 `LIMIT` + 每批计数；单测断言「活跃行删除数 = 0」 |
| 凭据暴露面           | **不变**             | 不新增本地明文/令牌落盘；不引入 refresh token；IPC 不传 token；日志不打印 token                                                                                                                         |
| 轮换竞态             | **需护栏**           | 见 §五 5.3 的「空闲门 + 10s 轮换窗」；若真机探针复现 10041 自伤 ⇒ 升级为服务端旧 token 宽限方案（ADR 备选 6）                                                                                           |

## 七、风险清单

| 编号    | 风险                                                                                   | 影响                                   | 应对                                                                                                                                             |
| :------ | :------------------------------------------------------------------------------------- | :------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1**  | `R5` 字面 ⇒ macOS 关窗后无提醒                                                         | 核心 AC 在 1/3 平台不成立              | P1 裁定；建议统一 `hide()`（PRD 记 R7 变更 + 逐条 AC）                                                                                           |
| **R2**  | 续期轮换使旧 token 立即失效 ⇒ 在途请求 10041 ⇒ 自伤登出 + 清凭证                       | 用户被动登出（严重但低频）             | 空闲门 + `auth-rotation` 10s 单次宽限（不置 `authExpiredFired`）+ qa 专项探针（同步在途时强制轮换）；复现则升级服务端旧 token 宽限（ADR 备选 6） |
| **R3**  | 系统休眠 / 关机期间无提醒                                                              | 与「合盖也提醒」的用户预期冲突         | PRD 补前提（RV3）；唤醒后 ≤10s 补弹；发布说明写清                                                                                                |
| **R4**  | GNOME 无扩展 ⇒ 托盘不可见 + 无可达退出                                                 | 用户以为卡死 / 无法退出                | 状态 `unconfirmed` + 设置内「退出」+ 首关提示文案；P2 裁定                                                                                       |
| **R5**  | Linux 自启：AppImage 路径漂移 / 文件被 DE 回写                                         | 自启失效但显示已开启                   | 用 `APPIMAGE`、`TryExec`；设置页「回读」为准；提供「重试」                                                                                       |
| **R6**  | macOS ad-hoc 签名（`DEF-75` B 档）下登录项可能登记失败                                 | macOS「默认开启」长期「未生效」        | 状态如实显示 `not-registered` + 引导；A 档签名后才能根治（本批不解决）                                                                           |
| **R7**  | `backgroundThrottling:false` 全局副作用（动画/计时不停；`visibilityState` 恒 visible） | 耗电、既有「隐藏即停」假设失效         | T2 抽样；qa 回归 pomodoro / sync / reminder 三处可见性逻辑；防回退守卫                                                                           |
| **R8**  | 清理任务误删                                                                           | 用户被动登出                           | 严格 cutoff + 7d 宽限 + 批量 + 统计断言 + 默认 runOnStart=false；先 dev 库演练                                                                   |
| **R9**  | 服务端多副本同时跑 cron（既有 H2）                                                     | 重复删除（幂等，无数据风险）+ 日志重复 | `DELETE ... LIMIT` 幂等；记录每批计数；不引入分布式锁（本批不必）                                                                                |
| **R10** | 旧客户端/清过 localStorage 的端 `device_id` 为空 ⇒ 仍会新增行                          | 膨胀残留                               | 清理兜底（7d 回收）；`nao.deviceId` 已在 K10 白名单；不加活跃会话上限（防误删在线设备）                                                          |
| **R11** | 托盘图标高 DPI / 深色可辨识                                                            | 视觉不达标                             | 提供多尺寸 + mac Template；AC13 由用户视觉验收                                                                                                   |
| **R12** | 首关提示用主进程通知，dev/未安装环境可能不显示                                         | 提示缺失（不阻塞常驻）                 | 打包态验收；dev 允许静默（qa 用日志断言）                                                                                                        |
| **R13** | 自启条目在卸载 / 移动到新路径后残留                                                    | 无效启动项                             | `TryExec`（Linux）；Win 指向不存在路径被系统忽略；写入发布说明                                                                                   |
| **R14** | Windows 关机/注销被 `close` 拦截                                                       | 关机被延迟                             | `query-session-end` / `session-end` 置 `isQuitting`（§五 5.1 硬约束）                                                                            |

## 八、跨仓：`nao-todo-server` 会话清理（`DEF-14`）

**分支**：从 `origin/main` 拉 `feat/254-session-cleanup`（另一仓，本次不改代码）。

**落点（沿用既有分层）**

| 层       | 文件                                                                                      | 改动                                                                                                                                                                      |
| :------- | :---------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 配置     | `conf/config.go` + `conf/config.yaml` + `.example/.env.example`                           | 新增 `session.cleanup.{enabled,cron,retentionDays,revokedRetentionHours,batchSize,maxBatches,runOnStart}` + `SESSION_CLEANUP_*` 环境变量（沿用现有 `os.Getenv` 覆盖风格） |
| 应用     | `application/auth/app.go` / `appImpl.go`                                                  | `CleanupExpiredSessions(ctx, opts) (removedExpired, removedRevoked int64, err)`（cron 只做壳）                                                                            |
| 领域端口 | `domain/identity/repositories/session.go`                                                 | `DeleteExpiredBefore(ctx, cutoff, limit)` / `DeleteRevokedBefore(...)`（或单个 `PurgeSessions(opts)`）                                                                    |
| 持久化   | `infrastructure/persistence/identity/sessionRepoImpl.go`                                  | **raw `DELETE ... WHERE ... LIMIT ?`**（不用 GORM 软删语义，避免 `Unscoped` 歧义）；两条件分开跑；无 DDL                                                                  |
| 定时     | `infrastructure/cron/cleanExpiredSessions.go` + `infrastructure/initialize.go` `LoadCron` | 注册 `03:10`（避开 04:00 删注销用户、避开每分钟提醒扫描）；`runOnStart` 可在进程启动后跑一次                                                                              |
| 测试     | `infrastructure/cron/*_test.go` / 仓储测试                                                | 种子：过期 8d、过期 6d（宽限内）、活跃 +1d、登出 2d、登出 2h ⇒ 仅删 2 行；活跃删除数 = 0                                                                                  |

**开关 / 回滚**：`SESSION_CLEANUP_ENABLED=false` + 重启（无 DDL、无需回滚迁移）。`runOnStart` 默认 `false`，仅在验证窗口临时开。

**部署步骤（用户执行，最小集）**

1. 合并 PR → 拉取服务端新镜像/代码并重启（同 `nao-todo-server#55` 的历史做法）。
2. 只读摸底（部署前）：
    ```sql
    SELECT COUNT(*) AS total FROM user_sessions;
    SELECT COUNT(*) AS active FROM user_sessions WHERE expired_at > NOW() AND deleted_at IS NULL;
    SELECT COUNT(*) AS reclaim_expired FROM user_sessions WHERE expired_at < NOW() - INTERVAL 7 DAY;
    SELECT COUNT(*) AS reclaim_revoked FROM user_sessions WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL 1 DAY;
    ```
3. 临时 `SESSION_CLEANUP_RUN_ON_START=true` 重启 → 日志应出现一行 `session_cleanup removed_expired=<reclaim_expired> removed_revoked=<reclaim_revoked>`（无 token）。
4. 复跑第 2 步：`total` 减少量 = 两者之和、**`active` 数值不变**；随后把 `runOnStart` 改回 `false` 重启。
5. 定时确认：把 `cron` 临时改 `*/5 * * * *` 观察一次，再改回 `10 3 * * *`；或次日看日志。
6. 客户端侧（AC7 另一半）：同设备登录两次 ⇒ 该用户行数不变；抓包/日志确认 `X-Device-Id` 非空；登出后本地 `nao.deviceId` 仍在（既有 K10 用例覆盖）。

**最小验证方法（qa 自动化口径）**：仓储层单测（种子数据 + 断言）为主；部署后 SQL 对账由 PM/用户按上表执行（可复制）。

## 九、对 PRD 的修订建议（按 R 编号，逐条枚举受影响 AC）

| 编号     | 建议                                                                                                                           | 受影响 AC / 条款              |
| :------- | :----------------------------------------------------------------------------------------------------------------------------- | :---------------------------- |
| **RV1**  | `R5` 改为「**进程不退出**语义不变；桌面端统一关窗 → 隐藏（含 macOS）」，否则补「macOS 关窗后不再提醒」的显式限制               | R5；**AC1、AC3、AC12**        |
| **RV2**  | 硬约束「Web 端零改动」改为「**Web 端行为零变化**（桌面专属能力以 `desktopAPI` 门控；共享源码允许新增受门控文件）」             | 头部硬约束；**AC12**          |
| **RV3**  | §二 与 AC3 补前提：「进程存活且系统未休眠」；休眠/关机期间不承诺，唤醒后 ≤10s 补弹                                             | §二 送达率；**AC3**；§四 场景 |
| **RV4**  | AC9 拆两态：① 构造失败 ⇒ 旧行为退出 + 「不支持」；② 构造成功但可能不可见（Linux）⇒ 仍常驻 + 「可能不显示托盘图标」+ 设置内退出 | **AC9、AC13**                 |
| **RV5**  | `D3` 补一句：托盘菜单仍只有「打开/退出」；**设置页「桌面常驻」块内额外提供「退出 NaoTodo」**（不属托盘菜单）                   | D3；**AC13**                  |
| **RV6**  | AC8 补可见性：到期判定发生在窗口隐藏时 ⇒ 先发系统通知，打开后再给对话框                                                        | **AC8**                       |
| **RV7**  | AC4 / AC10 补「需系统批准」状态（macOS 13 `requires-approval`；Windows 任务管理器禁用）：「默认开启」指写入意图，不等同已生效  | **AC4、AC10**                 |
| **RV8**  | 把 §三「首次收进托盘的一次性提示」补成可验 AC（含「退出请用托盘菜单」文案）；建议新增 **AC14**（或并入 AC1 的 Then）           | **AC1**（或 AC14）、AC13      |
| **RV9**  | AC7 明确：**不禁止空 `device_id` 登录**、不设活跃会话上限；靠「客户端稳定标识 + 7d 后回收」收敛                                | **AC7**                       |
| **RV10** | §二「常驻存活」补定义：常驻 = 进程持续运行；**关机/休眠 >48h 后仍须重新登录**（JWT 已过期）                                    | §二；**AC6** 措辞             |
| **RV11** | `D4` 补降级：托盘不可用/不可见时，自启**正常显示窗口**（否则应用完全不可见）                                                   | D4；**AC4、AC9**              |

**推翻建议**：无。仅「R5 字面」与「AC9 字面」需按 RV1 / RV4 修订或由 PM 明确降级口径。

## 十、里程碑（分阶段）

| 阶段       | 内容                                                                                         | 出口判据                                           |
| :--------- | :------------------------------------------------------------------------------------------- | :------------------------------------------------- |
| M0（0.5d） | PM 裁定 P1–P4 并回填 PRD（RV1–RV11）                                                         | PRD v1.1 + 受影响 AC 清单确认                      |
| M1（0.5d） | qa 用例先行（红基线）：状态机 / 自启回读 / 续期调度 / 清理谓词 / `backgroundThrottling` 守卫 | 用例提交且失败原因正确                             |
| M2（1.5d） | 桌面主进程：tray / autostart / app-settings / ipc / 生命周期                                 | 主进程单测绿；真机三平台手测入口可用               |
| M3（1d）   | 渲染层：`use-desktop-shell` 双实现 / 设置块 / 通知点击还原 / 续期接线 / 10041 护栏           | 受影响面测试绿；Web 行为零变化（快照/用例）        |
| M4（1d）   | 服务端清理（另仓）：配置 / 应用 / 仓储 / cron / 测试                                         | 单测断言「活跃 0 删除」；dev 库演练                |
| M5（0.5d） | 门禁 + 探针 + 用户真机清单（自启、托盘、48h、图标 DPI）                                      | 全范围门禁 9 项 rc0；移动端 diff 0；用户勾选表交付 |

## 十一、交付核对（仅列未过项）

- **未过：影响面评审使用 `codegraph impact/callers`** —— 本机 `pi-codegraph` 已卸载（`AGENTS.md` 2026-10-21 记录），本次以 **全仓 grep 穷尽 + 行段读码**替代，口径风险：动态加载（`import.meta.glob`）可能漏检。已在 §头部注明。
- 其余检查项（NFR 可量化、模式对照 ≥2 含基线、风险含应对、ADR 含参考来源、未改代码、回执 PM）均通过。