/**
 * 持久化存储抽象
 * @description Lynx 运行时无内置 localStorage / IndexedDB。优先使用 LynxExplorer 内置的
 *              NativeLocalStorageModule（原生持久化，callback 风格 API），
 *              不可用时降级为内存存储（应用重启后丢失）。
 *              统一为异步 API，调用方无需感知底层实现差异。
 */

interface NativeLocalStorageModule {
    setStorageItem(key: string, value: string): void
    getStorageItem(key: string, callback: (value: string) => void): void
    clearStorage(): void
}

const getNativeStorage = (): NativeLocalStorageModule | null => {
    const nativeModules = (
        globalThis as {
            NativeModules?: { NativeLocalStorageModule?: NativeLocalStorageModule }
        }
    ).NativeModules
    return nativeModules?.NativeLocalStorageModule ?? null
}

const memory = new Map<string, string>()

/**
 * 读取存储项
 * @param key 键
 * @returns 值或 null
 */
export const getStorageItem = async (key: string): Promise<string | null> => {
    const native = getNativeStorage()
    if (native === null) return memory.get(key) ?? null
    return await new Promise<string | null>((resolve) => {
        native.getStorageItem(key, (value) => resolve(value || null))
    })
}

/**
 * 写入存储项
 * @param key 键
 * @param value 值
 */
export const setStorageItem = async (key: string, value: string): Promise<void> => {
    const native = getNativeStorage()
    if (native === null) {
        memory.set(key, value)
        return
    }
    native.setStorageItem(key, value)
}

/**
 * 移除存储项
 * @description NativeLocalStorageModule 无 remove API，以写入空串近似
 * @param key 键
 */
export const removeStorageItem = async (key: string): Promise<void> => {
    const native = getNativeStorage()
    if (native === null) {
        memory.delete(key)
        return
    }
    native.setStorageItem(key, '')
}