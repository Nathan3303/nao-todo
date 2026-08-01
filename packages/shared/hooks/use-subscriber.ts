/**
 * 事件回调函数
 * @description 订阅器为无类型事件总线，各订阅方按自身事件约定声明具体形参，
 *              故此处形参用 never[] 以保持对任意回调签名的兼容（逆变位置）。
 */
type cbFunc = (...args: never[]) => void

/**
 * 事件订阅器接口
 * @description 事件订阅器接口，用于订阅和触发事件
 */
export interface Subscriber {
    emit: (eventName: string, ...args: unknown[]) => void
    subscribe: (eventName: string, callback: cbFunc) => void
    unsubscribe: (eventName: string, callback: cbFunc) => void
}

/**
 * 事件订阅器实现
 * @returns 事件订阅器
 */
export const useSubscriber = (): Subscriber => {
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