/**
 * 安全区核心（iPhone 刘海/底部 Home 条适配）
 * @description Lynx 不支持 CSS env(safe-area-inset-*)；宿主（LynxExplorer 等）经
 *              lynx.__globalProps 注入 status_bar_height / bottom_area_height（物理像素）。
 *              读取不到时按机型兜底推断（iOS 刘海机 47pt / 普通 20pt）。纯换算函数可单测。
 */

/** 安全区（逻辑像素 pt） */
export type SafeAreaPt = { top: number; bottom: number }

/** Lynx rpx 换算基准（750rpx = 屏宽） */
export const RPX_BASE = 750

/** 物理像素 → 逻辑像素（pt） */
export const px2pt = (value: number, pixelRatio: number): number =>
    pixelRatio > 0 ? value / pixelRatio : value

/** pt → rpx（Lynx 1rpx = 屏宽pt / 750） */
export const pt2rpx = (value: number, screenWidthPt: number): number => {
    if (value <= 0 || screenWidthPt <= 0) return 0
    return Math.round((value / (screenWidthPt / RPX_BASE)) * 100) / 100
}

/** 宿主未注入时的机型兜底推断 */
export const inferSafeAreaPt = (
    platform: string,
    screenWidthPt: number,
    pixelRatio: number
): SafeAreaPt => {
    if (platform === 'iOS') {
        // 刘海机型：宽 ≥ 390pt 且 3x 屏（iPhone X 起全系）；状态栏 47pt / Home 条 34pt
        const notched = screenWidthPt >= 390 && pixelRatio >= 3
        return notched ? { top: 47, bottom: 34 } : { top: 20, bottom: 0 }
    }
    // Android 状态栏约 24dp；Harmony 同 Android
    return { top: 24, bottom: 0 }
}

/** 读取宿主注入的安全区（__globalProps，物理像素 → pt）；无注入返回 null */
export const readGlobalPropsInsets = (pixelRatio: number): SafeAreaPt | null => {
    try {
        const lynxGlobal = (
            globalThis as unknown as { lynx?: { __globalProps?: Record<string, unknown> } }
        ).lynx
        const props = lynxGlobal?.__globalProps
        if (!props) return null
        const topPx = props['status_bar_height'] ?? props['statusBarHeight']
        const bottomPx = props['bottom_area_height'] ?? props['bottomAreaHeight']
        if (typeof topPx !== 'number' && typeof bottomPx !== 'number') return null
        return {
            top: typeof topPx === 'number' ? px2pt(topPx, pixelRatio) : 0,
            bottom: typeof bottomPx === 'number' ? px2pt(bottomPx, pixelRatio) : 0
        }
    } catch {
        return null
    }
}

/** 读取 SystemInfo（防御：Node 测试环境无 lynx 全局） */
const readSystemInfo = (): {
    platform?: string
    screenWidthPt: number
    pixelRatio: number
} => {
    try {
        const sys = (
            globalThis as {
                SystemInfo?: { platform?: string; pixelWidth?: number; pixelRatio?: number }
            }
        ).SystemInfo
        const pixelRatio = sys?.pixelRatio && sys.pixelRatio > 0 ? sys.pixelRatio : 2
        const screenWidthPt =
            sys?.pixelWidth && sys.pixelWidth > 0 ? sys.pixelWidth / pixelRatio : 375
        return { platform: sys?.platform, screenWidthPt, pixelRatio }
    } catch {
        return { screenWidthPt: 375, pixelRatio: 2 }
    }
}

/** 缓存（页面生命周期内不变） */
let cached: SafeAreaPt | null = null

/**
 * 获取安全区（pt）
 * @description 优先宿主注入，其次机型兜底；结果缓存（__globalProps 页面加载时已注入）。
 */
export const getSafeAreaPt = (): SafeAreaPt => {
    if (cached !== null) return cached
    const { platform, screenWidthPt, pixelRatio } = readSystemInfo()
    const injected = readGlobalPropsInsets(pixelRatio)
    cached = injected ?? inferSafeAreaPt(platform ?? '', screenWidthPt, pixelRatio)
    return cached
}

/** 获取安全区（rpx，供 UI 直接使用） */
export const getSafeAreaRpx = (): { top: number; bottom: number } => {
    const { screenWidthPt } = readSystemInfo()
    const insets = getSafeAreaPt()
    return {
        top: pt2rpx(insets.top, screenWidthPt),
        bottom: pt2rpx(insets.bottom, screenWidthPt)
    }
}

/** 测试专用：清空缓存 */
export const resetSafeAreaCache = (): void => {
    cached = null
}