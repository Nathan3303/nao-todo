type cbFunc = (...args: any[]) => void

export interface Subscriber {
    emit: (eventName: string, ...args: any[]) => void
    subscribe: (eventName: string, callback: cbFunc) => void
    unsubscribe: (eventName: string, callback: cbFunc) => void
}

const useSubscriber = (): Subscriber => {
    // @state
    const callbackMap = new Map<string, Set<cbFunc>>()

    // @method 订阅事件
    const subscribe = (eventName: string, callback: cbFunc) => {
        if (!callbackMap.has(eventName)) {
            callbackMap.set(eventName, new Set())
        }
        callbackMap.get(eventName)?.add(callback)
    }

    // @method 取消订阅事件
    const unsubscribe = (eventName: string, callback: cbFunc) => {
        const callbacks = callbackMap.get(eventName)
        if (callbacks) {
            callbackMap.set(eventName, new Set([...callbacks].filter((cb) => cb !== callback)))
        }
        if (callbackMap.get(eventName)?.size === 0) {
            callbackMap.delete(eventName)
        }
    }

    // @method 触发事件
    const emit = (eventName: string, ...args: any[]) => {
        callbackMap.get(eventName)?.forEach((callback) => {
            // console.log('触发事件', eventName, ...args)
            callback(...args)
        })
    }

    // @returns
    return { subscribe, unsubscribe, emit }
}

export default useSubscriber
