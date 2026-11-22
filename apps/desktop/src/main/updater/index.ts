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
 *              - **开发态假更新源（T748）**：`assembleUpdatePorts` 只在「未打包 + `NAO_UPDATE_FAKE_FEED`
 *                非空」时才换成假端口；打包态在第一行就返回真实端口 ⇒ 生产**完全不生效**。
 * @see apps/desktop/src/main/updater/wiring.ts（延后与异常兜底）
 * @see docs/adr/2026-11-20-desktop-self-update.md（启动不阻断 / 护栏判定在渲染层）
 */
import type { DesktopUpdateStatus } from '@nao-todo/shared'
import { bindUpdateStatusWindow, publishUpdateStatus, type UpdateStatusWindowLike } from '../ipc'
import { createElectronUpdaterPorts } from './adapters/electron-updater'
import type { InstallOutcome } from './core'
import { assembleUpdatePorts } from './dev-fake-feed'
import { createUpdateStore } from './store'
import { createDesktopUpdater, type DesktopUpdater } from './wiring'

export interface SetupDesktopUpdaterOptions {
    /** `userData` 目录（缓存 + 结果历史落这里） */
    dir: string
    /** 当前主窗口（可能为 null / 已销毁；结构面最小化，不引 `electron` 类型） */
    getWindow(): UpdateStatusWindowLike | null
    /** 本地日志出口（更新器任何异常都不得外抛；入参为脱敏摘要，AC9b） */
    onError?: (summary: string) => void
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
    const realPorts = createElectronUpdaterPorts()
    /**
     * 端口装配（T748）：生产（`isPackaged`）恒拿真实端口；假更新源只在开发态 + 开关非空时生效
     * @description 假源**只换 `checker` / `downloader` / `installer` 与三项 env 读数**，内核与状态机零改动。
     */
    const { ports, fake, notice } = assembleUpdatePorts({
        realPorts,
        isPackaged: realPorts.env.isPackaged,
        env: process.env
    })
    // 启用失败只落本地日志（ADR「启动不阻断」；⛔ 不进状态、不影响窗口创建）
    if (notice) options.onError?.(notice)

    const store = createUpdateStore(options.dir)
    /**
     * 同步护栏（AC9）· **生产装配恒 `false`**
     * @description ① 判定权威**只在渲染层**：渲染层按既有 `useSyncStatus()` 的
     *              `pendingCount > 0` 弹确认框，用户确认后才带 `force: true` 调安装（ADR：
     *              「判定在渲染层，主进程只执行安装动作」）；
     *              ② 主进程**拿不到**渲染层的 Dexie 队列（要走 IPC 才能接上，超出本期范围），
     *              所以这里恒返回 `false` —— **生产链路上本端口不构成第二道闸**，护栏只有
     *              渲染层那一道；
     *              ③ 内核 `pending-sync` 分支的价值 = 单测覆盖该不变量 + 将来若新增 IPC
     *              的接线点（换成真实判定即可，内核无需改动）。
     */
    const syncGuard = { hasPendingChanges: () => false }
    const buildUpdater = (): DesktopUpdater =>
        createDesktopUpdater({ ...ports, store, syncGuard, onError: options.onError })

    let updater: DesktopUpdater = buildUpdater()

    /** 状态变化主动推给主窗口（单向；重载由 `bindWindow` 补推） */
    const forwardStatus = (): void => {
        updater.core.subscribe((status) => {
            const window = options.getWindow()
            if (window) publishUpdateStatus(window, status)
        })
    }
    forwardStatus()

    /**
     * 假安装后重建内核（**仅假源生效时**，T748）
     * @description 假安装不退出、不换文件（`dev-fake-feed.ts`），而状态机不允许 `ready → just-updated`
     *              （`state.ts` 是生产语义，⛔ 不改）⇒ 按「真实链路的重启」语义**重建一次内核**：
     *              缓存里 `readyVersion` 已等于假环境报告的当前版本 ⇒ 重建初值即 `just-updated`
     *              （`restoreStatus`），随后补推一次真值给渲染层。生产路径不可达（`fake` 恒 `false`）。
     */
    const rebuildAfterFakeInstall = (): void => {
        updater = buildUpdater()
        forwardStatus()
        const window = options.getWindow()
        if (window) publishUpdateStatus(window, updater.core.getStatus())
    }

    return {
        getStatus: () => updater.core.getStatus(),
        check: (checkOptions) => updater.core.check(checkOptions),
        download: () => updater.core.download(),
        async install(installOptions) {
            const outcome = await updater.core.install(installOptions)
            if (fake && outcome.installed) rebuildAfterFakeInstall()
            return outcome
        },
        openDownloadPage: () => updater.core.openDownloadPage(),
        start: () => updater.start(),
        bindWindow: (window) => bindUpdateStatusWindow(window, () => updater.core.getStatus())
    }
}