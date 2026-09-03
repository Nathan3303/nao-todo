/**
 * 轻量页面导航 core（Lynx 无 vue-router）
 * @description 两级路由语义：页面级（bottom links）替换当前页面；子页级（middle links）入栈。
 *              订阅式（useSyncExternalStore 驱动），组件只读 current 快照、调用 push/replace/back。
 */

// 页面名
export type AppScreenName =
    | 'task-list'
    | 'task-detail'
    | 'task-create'
    | 'project-manage'
    | 'tag-manage'
    | 'settings'

// 页面参数（按 screen 类型收窄）
export type AppScreenParams =
    | { name: 'task-list'; builtinId?: string; projectId?: string; tagId?: string }
    | { name: 'task-detail'; taskId: string }
    | { name: 'task-create'; builtinId?: string; projectId?: string; tagId?: string }
    | { name: 'project-manage' }
    | { name: 'tag-manage' }
    | { name: 'settings' }

export type AppRoute = { screen: AppScreenName; params: Record<string, string | undefined> }

class NavCore {
    private stack: AppRoute[] = []
    private listeners = new Set<() => void>()

    /** 兜底路由：栈空时返回（登录成功首帧渲染先于 useEffect 的 reset，必须永不返回 undefined） */
    private static readonly DEFAULT_ROUTE: AppRoute = {
        screen: 'task-list',
        params: { builtinId: 'today' }
    }

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    private notify = (): void => {
        this.listeners.forEach((listener) => listener())
    }

    /** 当前路由（栈空时返回兜底「今日任务」，杜绝渲染期读取 undefined） */
    getCurrent = (): AppRoute => this.stack[this.stack.length - 1] ?? NavCore.DEFAULT_ROUTE

    /** 页面级切换：替换当前页面（保留栈底语义） */
    replace = (screen: AppScreenName, params: Record<string, string | undefined> = {}): void => {
        if (this.stack.length === 0) {
            this.stack = [{ screen, params }]
        } else {
            this.stack[this.stack.length - 1] = { screen, params }
        }
        this.notify()
    }

    /** 子页级导航：入栈 */
    push = (screen: AppScreenName, params: Record<string, string | undefined> = {}): void => {
        this.stack.push({ screen, params })
        this.notify()
    }

    /** 返回上一页（栈底不可再退，由 App 层处理登出） */
    back = (): void => {
        if (this.stack.length > 1) {
            this.stack.pop()
            this.notify()
        }
    }

    /** 重置为指定页面（登录成功/登出时调用） */
    reset = (screen: AppScreenName, params: Record<string, string | undefined> = {}): void => {
        this.stack = [{ screen, params }]
        this.notify()
    }
}

/** 导航单例（应用级） */
export const navCore = new NavCore()