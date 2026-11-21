/**
 * 桌面更新器装配（主进程侧）
 *
 * @description 把 `electron-updater` 端口、缓存面、状态机拼成一个可被 `main/index.ts`
 *              与 IPC 直接使用的句柄。约定：
 *              - **构造阶段零网络、零磁盘写**（只有 `createUpdateStore` 一个路径字符串）；
 *              - `start()` 才排静默检查（延后 ≥10s），且异常不出本模块（ADR「启动不阻断」）；
 *              - 状态变化主动推给主窗口（单向）；窗口重载后由 `bindWindow` 补推当前真值。
 *              - **不 import `electron`**：窗口只按 `UpdateStatusWindowLike` 的最小结构面接
 *                （真实 `BrowserWindow` 结构兼容），运行期 electron 耦合全在 `adapters/` 一处
 *                ⇒ 「内核目录零 electron」可被静态用例直接守住（可测性前置 ①②）。
 * @see apps/desktop/src/main/updater/wiring.ts（延后与异常兜底）
 * @see docs/adr/2026-11-20-desktop-self-update.md（启动不阻断 / 护栏判定在渲染层）
 */
import type { DesktopUpdateStatus } from '@nao-todo/shared'
import { bindUpdateStatusWindow, publishUpdateStatus, type UpdateStatusWindowLike } from '../ipc'
import { createElectronUpdaterPorts } from './adapters/electron-updater'
import type { InstallOutcome } from './core'
import { createUpdateStore } from './store'
import { createDesktopUpdater, type DesktopUpdater } from './wiring'

export interface SetupDesktopUpdaterOptions {
    /** `userData` 目录（缓存 + 结果历史落这里） */
    dir: string
    /** 当前主窗口（可能为 null / 已销毁；结构面最小化，不引 `electron` 类型） */
    getWindow(): UpdateStatusWindowLike | null
    /** 本地日志出口（更新器任何异常都不得外抛） */
    onError?: (error: unknown) => void
}

export interface DesktopUpdaterHandle {
    getStatus(): DesktopUpdateStatus
    check(options?: { manual?: boolean }): Promise<DesktopUpdateStatus>
    download(): Promise<DesktopUpdateStatus>
    install(options?: { force?: boolean }): Promise<InstallOutcome>
    openDownloadPage(): Promise<void>
    /** 启动静默检查（幂等） */
    start(): void
    /** 窗口创建后调用：页面加载完成时补推一次当前状态 */
    bindWindow(window: UpdateStatusWindowLike): void
}

/**
 * 装配桌面更新器
 * @description ⚠️ 本函数抛出即表示「更新器整体不可用」——调用方（`main/index.ts`）
 *              必须 `try/catch` 兜住并继续创建窗口（窗口创建优先级高于更新能力）。
 */
export const setupDesktopUpdater = (options: SetupDesktopUpdaterOptions): DesktopUpdaterHandle => {
    const ports = createElectronUpdaterPorts()
    const updater: DesktopUpdater = createDesktopUpdater({
        ...ports,
        store: createUpdateStore(options.dir),
        /**
         * 同步护栏（AC9）：**判定权威在渲染层**（复用既有 `useSyncStatus()`，ADR 明确不新建状态源）。
         * 主进程侧保留端口与 `force` 闸只是纵深防御：渲染层确认「仍要更新」才带 `force: true` 调安装，
         * 未确认前根本不会调用 ⇒ 安装器调用数恒 0。
         */
        syncGuard: { hasPendingChanges: () => false },
        onError: options.onError
    })

    updater.core.subscribe((status) => {
        const window = options.getWindow()
        if (window) publishUpdateStatus(window, status)
    })

    return {
        getStatus: () => updater.core.getStatus(),
        check: (checkOptions) => updater.core.check(checkOptions),
        download: () => updater.core.download(),
        install: (installOptions) => updater.core.install(installOptions),
        openDownloadPage: () => updater.core.openDownloadPage(),
        start: () => updater.start(),
        bindWindow: (window) => bindUpdateStatusWindow(window, () => updater.core.getStatus())
    }
}