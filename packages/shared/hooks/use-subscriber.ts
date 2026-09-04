/**
 * 事件回调函数
 * @description 订阅器为无类型事件总线，各订阅方按自身事件约定声明具体形参，
 *              故此处形参用 never[] 以保持对任意回调签名的兼容（逆变位置）。
 */
type cbFunc = (...args: never[]) => void

/**
 * 事件订阅器接口
 * @description 订阅器接口，用于订阅和触发事件
 */
export interface Subscriber {
    emit: (eventName: string, ...args: unknown[]) => void
    subscribe: (eventName: string, callback: cbFunc) => void
    unsubscribe: (eventName: string, callback: cbFunc) => void
}

/**
 * 创建事件订阅器实例
 * @returns 事件订阅器
 */
const createSubscriber = (): Subscriber => {
    /**
     * 事件回调映射表
     */
    const callbackMap = new Map<string, Set<cbFunc>>()

    /**
     * 订阅事件
     * @param eventName 事件名称
     * @param callback 回调函数
     */
    const subscribe = (eventName: string, callback: cbFunc) => {
        if (!callbackMap.has(eventName)) {
            callbackMap.set(eventName, new Set())
        }
        callbackMap.get(eventName)?.add(callback)
    }

    /**
     * 取消订阅事件
     * @param eventName 事件名称
     * @param callback 回调函数
     */
    const unsubscribe = (eventName: string, callback: cbFunc) => {
        const callbacks = callbackMap.get(eventName)
        if (callbacks) {
            callbackMap.set(eventName, new Set([...callbacks].filter((cb) => cb !== callback)))
        }
        if (callbackMap.get(eventName)?.size === 0) {
            callbackMap.delete(eventName)
        }
    }

    /**
     * 触发事件
     * @param eventName 事件名称
     * @param args 事件参数
     */
    const emit = (eventName: string, ...args: unknown[]) => {
        const callbacks = callbackMap.get(eventName)
        if (!callbacks || callbacks.size === 0) {
            console.warn(`[Subscriber/emit] 事件 ${eventName} 未订阅`)
            return
        }
        callbacks.forEach((callback) => {
            console.log('[Subscriber/emit]', eventName, ...args)
            ;(callback as (...args: unknown[]) => void)(...args)
        })
    }

    /**
     * @returns 事件订阅器实现
     */
    return { subscribe, unsubscribe, emit }
}

/**
 * 应用级事件总线（单例）
 * @description 同一应用内所有视图/组件共享同一实例，保证跨视图事件（如数据变更、
 *              任务新建后刷新）可互达；handlers 等业务对象由此总线与各组件联动。
 */
const appSubscriber: Subscriber = createSubscriber()

export const useSubscriber = (): Subscriber => appSubscriber