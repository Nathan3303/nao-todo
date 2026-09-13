/**
 * 回传触发注册（SHELL-06 T1 / C-40 / C-43）
 * @description 装配层单点注册：`online` 与 `visibilitychange→visible` 仅作**触发**，
 *              **不得**用于鉴权/放行/会话判定（C-43，沿用 C-22）。
 *              返回卸载函数，便于组件 onUnmounted 清理（避免重复注册）。
 */
export type BackfillTriggerTarget = {
    handleOnline: () => void
    handleVisibility: () => void
}

export const registerBackfillTriggers = (target: BackfillTriggerTarget): (() => void) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}

    const onOnline = (): void => {
        // 仅触发回传；不改变任何鉴权/放行状态
        target.handleOnline()
    }
    const onVisibilityChange = (): void => {
        if (document.visibilityState !== 'visible') return
        target.handleVisibility()
    }

    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
        window.removeEventListener('online', onOnline)
        document.removeEventListener('visibilitychange', onVisibilityChange)
    }
}