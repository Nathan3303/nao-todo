export const debounce = (callback: (...args: any) => void | Promise<any>, delay: number) => {
    let timer: number | null = null
    return (...args: any[]) => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
            callback(...args)
            timer = null
        }, delay)
    }
}
