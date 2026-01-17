export interface Subscriber {
    emit: (eventName: string) => void
    subscribe: (eventName: string, callback: () => void) => void
    unsubscribe: (eventName: string, callback: () => void) => void
}

const useSubscriber = (): Subscriber => {
    // @state
    const callbackMap = new Map<string, Array<() => void>>()

    // @method 订阅事件
    const subscribe = (eventName: string, callback: () => void) => {
        if (!callbackMap.has(eventName)) {
            callbackMap.set(eventName, [])
        }
        callbackMap.get(eventName)?.push(callback)
    }

    // @method 取消订阅事件
    const unsubscribe = (eventName: string, callback: () => void) => {
        const callbacks = callbackMap.get(eventName)
        if (callbacks) {
            callbackMap.set(
                eventName,
                callbacks.filter((cb) => cb !== callback)
            )
        }
        if (callbackMap.get(eventName)?.length === 0) {
            callbackMap.delete(eventName)
        }
    }

    // @method 触发事件
    const emit = (eventName: string) => {
        callbackMap.get(eventName)?.forEach((callback) => callback())
    }

    // @returns
    return { subscribe, unsubscribe, emit }
}

export default useSubscriber
