/**
 * 桌面端应用内自我更新（Web 桩实现 + 渲染层窄契约）
 *
 * @description 更新能力（检查 / 下载 / 重启安装 / 打开下载页）的唯一消费面：
 *              界面只看 `isDesktop` / `status` / `hintVisible`，**全部 no-op** ⇒ **Web 端零变化**（AC10）。
 *              桌面端在 `apps/desktop/src/renderer/src/hooks/use-desktop-updater.ts` 提供同名真实实现，
 *              由各自 `hooks/index.ts` 之外的**独立模块路径**装配（PRD §七：⛔ 不进 `@/hooks` 聚合，
 *              避免整包 mock）；界面一律 `import { useDesktopUpdater } from '@/hooks/use-desktop-updater'`。
 *              两端 `@/hooks/*` 前缀在桌面 `electron.vite.config.ts` 里被替换到桌面 hooks 目录 ⇒ 同路径双装配。
 * @see docs/prds/2026-11-20-desktop-self-update.md（AC1–AC13 · 可测性前置 ④）
 * @see docs/designs/358-desktop-self-update.md（§5 八态 · §9 测试钩子）
 * @see packages/shared/types/desktop-update.ts（`DesktopUpdateStatus` 单一事实来源）
 */
import { computed, readonly, ref, type ComputedRef, type Ref } from 'vue'
import type { DesktopUpdateStatus } from '@nao-todo/shared'

/** 首帧 / Web 桩用的空状态（`idle` 且无版本；不渲染时为无效值，无需占位） */
export const EMPTY_UPDATE_STATUS: DesktopUpdateStatus = {
    state: 'idle',
    currentVersion: '',
    installMode: 'download-page',
    updateAvailable: false
}

/** 设备级「已看过哪个可用版本」（只看过没看过，属纯 UI 语义 ⇒ 渲染层持久化，不进主进程） */
export const LAST_SEEN_UPDATE_VERSION_KEY = 'nao.lastSeenUpdateVersion'

export const readLastSeenUpdateVersion = (): string | null => {
    try {
        return localStorage.getItem(LAST_SEEN_UPDATE_VERSION_KEY)
    } catch {
        // 隐私模式 / 存储被禁用：读不到等价于从未看过（弱提示会亮，不阻塞任何动作）
        return null
    }
}

export const writeLastSeenUpdateVersion = (version: string | null): void => {
    try {
        if (version) localStorage.setItem(LAST_SEEN_UPDATE_VERSION_KEY, version)
        else localStorage.removeItem(LAST_SEEN_UPDATE_VERSION_KEY)
    } catch {
        // 写入失败只影响弱提示是否再亮，不影响更新本身
    }
}

/**
 * 弱提示是否该亮（设计稿 §3：有可用更新 **且** 该版本未在设置看过）
 * @description `updateAvailable` 由主进程算好（available / downloading / ready）⇒ 这里不推导状态集合
 */
export const resolveUpdateHintVisible = (
    status: Pick<DesktopUpdateStatus, 'updateAvailable' | 'latestVersion'>,
    lastSeenVersion: string | null
): boolean =>
    status.updateAvailable &&
    typeof status.latestVersion === 'string' &&
    status.latestVersion !== '' &&
    status.latestVersion !== lastSeenVersion

/** 体积格式化（未知 / 非正数 ⇒ `null`，调用方走「无体积」文案；⛔ 不写 0 MB、不编数字） */
export const formatUpdateBytes = (bytes: number | undefined, locale: string): string | null => {
    if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return null
    const mib = bytes / (1024 * 1024)
    const digits = mib >= 10 ? 0 : 1
    try {
        return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(mib)} MB`
    } catch {
        return `${mib.toFixed(digits)} MB`
    }
}

/** 设置页「关于与更新」块 + 侧栏弱提示的数据源与动作 */
export interface DesktopUpdater {
    /** 是否桌面端（Web ⇒ `false`：整块不渲染、弱提示不渲染、动作 no-op） */
    isDesktop: boolean
    /** 主进程单状态机载荷（Web 桩恒为 `idle`） */
    status: Readonly<Ref<DesktopUpdateStatus>>
    /** 是否已取到首份状态（首帧前 `false` ⇒ 读屏不得播报「已是最新」，设计稿 §8） */
    loaded: Readonly<Ref<boolean>>
    /** 侧栏齿轮弱提示（6px 空心环）是否该亮 */
    hintVisible: ComputedRef<boolean>
    /** 手动检查（忽略 24h 缓存；失败经 `state:'failed'` 回报，不靠 reject） */
    check(): Promise<void>
    /** 开始下载（仅 `installMode === 'in-place'`） */
    download(): Promise<void>
    /**
     * 安装并重启（只有用户显式触发）
     * @param force 卡 A「仍要更新」二次确认后为 `true`（主进程据此放行）；普通路径不传
     */
    restartToInstall(force?: boolean): Promise<void>
    /** 打开更新下载页（系统浏览器；AC4 / AC7 出口） */
    openDownloadPage(): void
    /** 当前可用版本已在设置看过（清弱提示，设备级持久化） */
    markSeen(): void
}

/** Web 桩：非桌面端，全部 no-op（不许有副作用、不发请求、不写存储） */
export const useDesktopUpdater = (): DesktopUpdater => {
    const status = ref<DesktopUpdateStatus>(EMPTY_UPDATE_STATUS)
    const hintVisible = computed(() => resolveUpdateHintVisible(status.value, null))
    return {
        isDesktop: false,
        status: readonly(status) as Readonly<Ref<DesktopUpdateStatus>>,
        loaded: readonly(ref(true)),
        hintVisible,
        check: async () => undefined,
        download: async () => undefined,
        restartToInstall: async (_force?: boolean) => undefined,
        openDownloadPage: () => undefined,
        markSeen: () => undefined
    }
}