/**
 * 任务内容视图就绪工具（SHELL-05 T5 / C-31 / C-32）
 * @description 与 `profile`（网络装饰数据）解耦的纯层：
 *              - `viewType` 自愈硬默认 `table`（本地 preference 优先，缺省不写远端）；
 *              - `loading` 有界：任何路径（成功/失败/异常）都在有限时间内退出 loading。
 *              零框架依赖，可单测。
 */

/** 任务内容视图硬默认视图类型（离线/无 preference 时） */
export const DEFAULT_TASKS_VIEW_TYPE = 'table'

/** 视图类型自愈：本地 preference 优先，缺省硬默认 table */
export const resolveTasksViewType = (preference?: { viewType?: string } | null): string =>
    preference?.viewType || DEFAULT_TASKS_VIEW_TYPE

/**
 * 有界初始化执行器（loading 总函数）
 * @description `setLoading(true)` → 执行 task → 无论成功/失败/异常 `setLoading(false)`；
 *              异常走 onError（结构化记录），不向调用方冒泡，避免 loading 永久 true。
 */
export const runBoundedTasksInitialize = async (
    task: () => Promise<void>,
    setLoading: (loading: boolean) => void,
    onError?: (error: unknown) => void
): Promise<void> => {
    setLoading(true)
    try {
        await task()
    } catch (error) {
        onError?.(error)
    } finally {
        setLoading(false)
    }
}