/**
 * 节流函数
 * @param callback 回调函数
 * @param delay 延迟时间
 * @returns
 */
export const throttle = (callback: (...args: any[]) => void | Promise<any>, delay: number) => {
    let timer: number | null = null
    return async (...args: any[]) => {
        if (timer) return
        const result = await callback(...args)
        timer = setTimeout(() => (timer = null), delay) as unknown as number
        return result
    }
}

/**
 * 防抖函数
 * @param callback 回调函数
 * @param delay 延迟时间
 * @returns
 */
export const debounce = <T>(callback: (...args: T[]) => void, delay: number) => {
    let timer: number | null = null
    return (...args: T[]) => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
            callback(...(args as T[]))
            timer = null
        }, delay) as unknown as number
    }
}

/**
 * 生成随机ID
 * @param length ID长度
 * @returns 随机ID
 */
export function generateId(length: number = 6) {
    return Math.random()
        .toString(36)
        .slice(2, 2 + length)
}

