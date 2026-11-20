# ADR：桌面端应用内自我更新（更新通道与平台降级）

- 状态：已接受（待落地）
- 更新：2026-11-20
- Owner：arch-designer（`T733`）
- 指针：`docs/prds/2026-11-20-desktop-self-update.md`（AC1–AC13） · `docs/tasks-state.md` §一之四 · Issue #358

## 背景

- 现状：桌面端升级只能去 Release 页手动下载重装（`apps/desktop` 无更新依赖，`desktopAPI` 无更新通道）⇒ 旧版本用户长期不升级。
- 既有基建（实测 `v1.20.3` Release）：7 个产物 + `latest.yml`/`latest-mac.yml`/`latest-linux.yml`（含 `files[].sha512`/`size`，无独立 `.blockmap` 资产）；本地同一 `build` 配置已生成 `resources/app-update.yml`（`provider: github` / `owner: Nathan3303` / `repo: nao-todo`）。
- 约束：C 端体验（不静默强更、重启前数据护栏）；macOS 仅 ad-hoc（`identity: "-"`，未签名未公证）；CI 用 `--publish never`；`gh` token 缺 `workflow` scope。
- 非目标：差分更新、后台静默强更、macOS 签名与公证、deb/apt 源、商店分发。

## 决策

采用官方 `electron-updater`（6.x，与 `electron-builder` 26 同线）+ GitHub Releases 作为**唯一**更新源。原地更新只开 Windows NSIS 与 Linux AppImage，macOS 与 Linux deb 一律降级为「打开下载页 + 一行原因」。安装时机完全由用户显式触发（`autoDownload=false` + `autoInstallOnAppQuit=false`），构建配置与 CI 形态维持现状。

## 理由

1. 业务匹配：PRD 平台矩阵（Win/AppImage 原地、mac/deb 下载页）与 electron-updater 支持面天然重合，无需自建分发面。
2. 成熟度：electron-builder 官方配套，更新元数据与现有构建同源；sha512 校验 / 下载进度 / 平台安装器 / 缓存管理均为既有能力。
3. 团队能力：本仓无「Windows 安装器交互 / AppImage 文件替换」经验与测试基建，自研等于把安全关键路径放进无人熟悉的代码。
4. 成本：零新增服务、零构建改造；成本集中在 UI 状态机与平台降级判定，属本需求本就要做的部分。

## 对照过的备选模式

1. **维持现状（手动下载）** —— 适用：用户极少、升级不紧迫；代价：版本触达为零；不采纳：PRD 北极星（旧版缺陷被反复感知）正指向此缺口。
2. **`electron-updater` 6.x + GitHub Releases（采纳）** —— 适用：产物挂 GitHub Release、只需 Win/AppImage 原地更新；代价：与 electron-builder 主版本线耦合、macOS 仍依赖签名。
3. **自研更新器（读 yml + 下载 + 校验 + 调平台安装器 + 重启）** —— 适用：非 GitHub 分发面或需定制差分；代价：复刻校验/安装/回滚三套平台逻辑，3–5 倍工作量且安全面自担；不采纳。
4. **Electron 内置 `autoUpdater`（Squirrel）** —— 适用：仅 Win/mac 且用 Squirrel 产物；代价：Windows 需 Squirrel 目标（与既有 NSIS 冲突）、Linux 无支持；不采纳。
5. **`update-electron-app`（Forge 封装）** —— 适用：Forge 脚手架项目；代价：底层仍是 electron-updater/Squirrel，本仓零收益；不采纳。

## 后果与风险

- 正面：一处依赖换到完整链路；更新源沿用 Release，无新增服务器与凭证；首个含本能力版本**无自动更新受众** ⇒ 首版风险近似为零。
- 风险：Windows 未签名 ⇒ 静默安装可能触发 SmartScreen，且 sha512 是唯一硬校验（无 Authenticode）⇒ 需 QA 真机各验一次首装与更新。
- 风险：`electron-updater` 6 与 `electron-builder` 26 同线；升 builder 27 / updater 7 改用 `files[]` 并强制 manifest Ed25519 签名，属独立迁移（不随本需求做）。
- 风险：无可复用 `.blockmap` ⇒ 全量下载（117–145 MB）＋ 缓存占盘约一个安装包量级；以「可重试 + 打开下载页」兜底，不承诺提供缓存清理入口。

## 限制与已知边界

- **更新源（现状够用，本期不改配置/CI）**：`app-update.yml` 与 `latest*.yml` 已由现有构建产出，`--publish never` + workflow 上挂资产成立；可选加固（非前提）= 显式 `publish` 字段锁定 owner/repo ＋ 发布检查项加「tag = `package.json` = `latest*.yml` 三者版本一致」（改 CI 需 `workflow` scope，先报 PM）。
- **平台能力矩阵（判定 = 纯函数 `resolveInstallMode({ platform, appimage, isPackaged })`，不做「试一次失败再降级」）**：Windows NSIS = 原地（`platform === 'win32'`）；Linux AppImage = 原地（`linux && appimage`）；Linux deb（无 `appimage`）= 下载页；macOS（ad-hoc）= 下载页；环境读取只发生在调用点，判定本身零 IO、零 `electron` 依赖 ⇒ AC7 可单测、不上真机。
- **可测性前置（QA `T735` 六条，逐条确认「可满足」）①–②**：更新内核**不 import `electron`**（只依赖端口与纯函数）—— 可满足；`electron-updater` 实例**只出现在 adapter 层**（整体包在端口后），单测不触真实 `net` ⇒ AC5/AC7 自动化面**不收缩** —— 可满足。
- **可测性前置 ③–④**：安装形态判定 = 上条纯函数（`platform`/`appimage`/`isPackaged` 显式入参，AC7 不上真机）—— 可满足；`useDesktopUpdater` **独立模块路径**（不进 `@/hooks` 聚合，避免整包 mock）—— 可满足。
- **可测性前置 ⑤–⑥**：24h 缓存 + 结果历史走「**传入目录的 fs 面**」（同 `app-settings.ts` 范式，用例用真 temp dir）—— 可满足；下载进度 / 中断 / 校验失败**经回调可观测**（adapter 暴露中断注入点，不吞在 updater 内部）—— 可满足。
- **数据护栏**：复用既有 `useSyncStatus()`（`pendingCount` / `failedCount` / `syncing` / `paused`），**不新建状态源**；判定在渲染层，主进程只执行安装动作。
- **启动不阻断**：能力探测不联网；检查延后 ≥10s 且全链路 `try/catch`，失败只落状态；更新器初始化任何异常都不得影响窗口创建。
- **坏包回滚**：撤回资产 + 发更高 PATCH（同版本重发无效）；紧急可把 Release 置为 prerelease/draft 使其不再是最新源；已发 tag 不删。安装期失败（NSIS 退出码非 0 / AppImage 替换失败）须保留旧版可启动 —— 由 QA 真机验一次「下载后不替换、重启仍可用」。
- **灰度**：`stagingPercentage` 需人工改 yml、与 CI 直传冲突，本期不用；自第二版起才需评估灰度手段。

## 参考来源

- [Auto Update · electron-builder](https://www.electron.build/docs/features/auto-update/) · 访问 2026-11-20 · 可自动更新目标（NSIS/AppImage/DMG）、`app-update.yml` 由构建生成（勿 `setFeedURL`）、macOS 必须签名、staged rollout 不能同版本重发。
- [publish · electron-builder](https://www.electron.build/docs/publish/) · 访问 2026-11-20 · 发布须显式 `--publish`；github provider 缺省由仓库信息补全并写入 `app-update.yml`。
- [autoUpdater · Electron](https://www.electronjs.org/docs/latest/api/auto-updater) · 访问 2026-11-20 · macOS 自动更新要求应用已签名（Squirrel.Mac 硬要求）。
- [AppImageUpdater.ts · electron-builder](https://github.com/electron-userland/electron-builder/blob/master/packages/electron-updater/src/AppImageUpdater.ts) · 访问 2026-11-20 · 无 `APPIMAGE` 环境变量 ⇒ 更新器停用（`isUpdaterActive()` 为 false）。
- [Issue #6330 · Linux 非 AppImage 包的自动更新](https://github.com/electron-userland/electron-builder/issues/6330) · 访问 2026-11-20 · v26 下 deb/rpm 不走 electron-updater（缺 `app-update.yml` 即失败）。