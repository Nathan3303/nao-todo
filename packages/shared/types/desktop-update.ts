/**
 * 桌面端应用内自我更新 · 渲染层 / 主进程共享契约
 *
 * @description 单一事实来源：主进程更新内核（`apps/desktop/src/main/updater/`）产出该形状，
 *              preload 经 `desktopAPI.update` 暴露给渲染层（Web 端无此通道、整块不渲染）。
 *              主进程内核**零 electron / 零 electron-updater 依赖**（端口注入），本文件也**不含**
 *              任何实现细节（只放纯类型），避免渲染层被主进程实现牵连。
 *              面向用户的文案一律由渲染层按枚举映射 i18n 键（`settings.update.*`），
 *              ⛔ 主进程不返回可读中文/英文句子、不返回本机路径与内部编号。
 * @see docs/prds/2026-11-20-desktop-self-update.md（AC1–AC13）
 * @see docs/adr/2026-11-20-desktop-self-update.md（平台矩阵 / 五端口 / 可测性前置）
 * @see docs/designs/358-desktop-self-update.md（§5 状态机 / §9 实现契约）
 */

/**
 * 更新状态机九态（设计稿 §5；渲染层 `data-update-state` 直接取该字面量，⛔ 不改名不加态）
 * - `unsupported`：安装形态不支持应用内更新（**前置 gate**：进入后不发起检查、不参与
 *   `checking` / `available` 流转；客户端可见动作只有「打开下载页」，一行原因见 `degradedReason`）
 * - `idle`：从未检查
 * - `checking`：检查中
 * - `available`：有新版本（原地可更新，见 `installMode`）
 * - `downloading`：下载中（进度在 `percent` / `downloadedBytes`）
 * - `ready`：已下载待重启（只有用户显式触发才安装）
 * - `up-to-date`：已是最新
 * - `just-updated`：本次启动装好的新版本（不落盘，仅内存）
 * - `failed`：检查 / 下载 / 校验失败（原因见 `failure`）
 */
export type DesktopUpdateState =
    | 'unsupported'
    | 'idle'
    | 'checking'
    | 'available'
    | 'downloading'
    | 'ready'
    | 'up-to-date'
    | 'just-updated'
    | 'failed'

/**
 * 安装形态（ADR 平台矩阵，由纯函数 `resolveInstallMode` 判定，不做「试一次失败再降级」）
 * - `in-place`：Windows NSIS / Linux AppImage ⇒ 应用内下载并重启生效
 * - `download-page`：macOS / Linux deb / **未打包开发态** ⇒ 只能打开下载页，且**不发起检查**
 *   （AC4b ⇒ 状态直接落 `unsupported`；`degradedReason` 说明原因）
 */
export type DesktopUpdateInstallMode = 'in-place' | 'download-page'

/**
 * 不支持应用内更新的原因（= 文案键 `settings.update.manual.mac` / `.deb` / `.dev`）
 * @description `dev` = 未打包开发态（无更新源）；`resolveInstallMode` **先按 `isPackaged` 判 dev**
 *              再按平台判 mac / deb，⛔ 不得把开发态说成「deb 版由系统包管理」。
 */
export type DesktopUpdateManualReason = 'mac' | 'deb' | 'dev'

/** 失败发生阶段（决定标题文案：`failedCheck` / `failedDownload` / `failedVerify`） */
export type DesktopUpdateFailureStage = 'check' | 'download' | 'verify'

/**
 * 失败原因（= 文案键 `settings.update.reason.*`）
 * @description ⛔ 不新增「原始错误消息」字段：底层异常只用于本地日志与结果历史，
 *              面向用户的原因必须收窄到这几类（不裸露路径 / 主机名 / 内部编号）。
 *              AC9b：`electron-updater` 原文（如 `APPIMAGE env is not defined…`）**不得**进入
 *              任何面向 UI 的字段，认不出的一律 `unknown`。
 */
export type DesktopUpdateFailureReason = 'offline' | 'timeout' | 'server' | 'disk' | 'unknown'

export interface DesktopUpdateFailure {
    stage: DesktopUpdateFailureStage
    reason: DesktopUpdateFailureReason
}

/**
 * 主进程推给渲染层的**唯一**状态载荷（单状态机 + 单订阅）
 * @description 字段均为可选是刻意的：状态机切换时只带该态有意义的字段，
 *              渲染层按 `state` 取用（例：`downloading` 才有 `percent`）。
 */
export interface DesktopUpdateStatus {
    state: DesktopUpdateState
    /** 当前应用版本（主进程 `app.getVersion()`，与发版一致；⛔ 不硬编码） */
    currentVersion: string
    /** 远端版本（`checking` / `idle` / `failed` 时缺省；`available` 起必有） */
    latestVersion?: string
    /** 更新包体积（字节；未知 ⇒ 缺省，⛔ 不写 0、不编数字） */
    sizeBytes?: number
    /** 已下载字节（仅 `downloading`；未知 ⇒ 缺省） */
    downloadedBytes?: number
    /** 总字节（仅 `downloading`；未知 ⇒ 缺省） */
    totalBytes?: number
    /** 进度百分比（0–100 整数；无总量 ⇒ 缺省，渲染层只显示「正在下载」） */
    percent?: number
    /** 安装形态（决定「立即更新」还是「打开下载页」，AC7） */
    installMode: DesktopUpdateInstallMode
    /**
     * 仅 `download-page` 且能判定具体形态时给出（mac / deb / dev），用于取一行原因文案
     * @description 缺省（形态判定不出）⇒ 渲染层走 `settings.update.manual.unknown` 兜底。
     */
    degradedReason?: DesktopUpdateManualReason
    /** 上次检查时间（ISO 串，R1 hint 用；从未检查 ⇒ 缺省） */
    lastCheckedAt?: string
    /** 仅 `failed` 时给出（阶段 + 收窄后的原因） */
    failure?: DesktopUpdateFailure
    /**
     * 侧栏弱提示是否该亮（有可用更新：`available` / `downloading` / `ready`）
     * @description 由主进程一并给出，渲染层无需自己推导状态集合；是否「已看过该版本」
     *              由渲染层按设备级持久化标记（`lastSeenUpdateVersion`）自行决定。
     */
    updateAvailable: boolean
}

/**
 * 「安装并重启」的载荷（AC9 二次确认）
 * @description `force: true` = 用户在「有改动还没同步」确认框里点了「仍要更新」。
 *              ⛔ 不携带队列数量/内容：护栏数量由渲染层从既有 `useSyncStatus()` 取（不双源）。
 */
export interface DesktopUpdateInstallOptions {
    force?: boolean
}

/**
 * preload 暴露的更新通道（`window.desktopAPI.update`，invoke 为主 + 单订阅）
 * @description 全部方法**可选**（`DesktopBridge.update?`）：容旧 preload / Web 桩 / 测试注入。
 *              抛错语义：调用失败 ⇒ promise reject（主进程侧统一 `try/catch` 后转 `failed` 状态，
 *              ⛔ 不把异常抛给渲染层当控制流）。
 */
export interface DesktopUpdateBridge {
    /** 当前状态（首帧初值；`onStatus` 订阅前先取一次，避免初值空洞） */
    getStatus(): Promise<DesktopUpdateStatus>
    /**
     * 手动检查（**忽略 24h 缓存**，必发一次检查请求；AC4 / AC8）
     * @description 例外（AC4b）：`unsupported` 形态**不发任何请求**，原样返回该态（0 次调用）。
     */
    check(): Promise<DesktopUpdateStatus>
    /** 开始下载（`installMode === 'in-place'` 时可用；AC2） */
    download(): Promise<DesktopUpdateStatus>
    /** 安装并重启（只有用户显式触发；未点之前 `installer` 调用数恒为 0；AC2 / AC9） */
    restartToInstall(options?: DesktopUpdateInstallOptions): Promise<void>
    /** 打开更新下载页（系统浏览器；AC4 / AC7 的降级出口） */
    openDownloadPage(): Promise<void>
    /**
     * 订阅状态变化（返回取消订阅）
     * @description 订阅时**立即回放**当前状态（preload 侧缓存），渲染层无需再等下一次变化；
     *              进度刷新受主进程节流（≤2 次/秒，设计稿 §7）。
     */
    onStatus(callback: (status: DesktopUpdateStatus) => void): () => void
}