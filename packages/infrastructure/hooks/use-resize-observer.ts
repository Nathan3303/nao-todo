import { ref } from 'vue'

export const useResizeObserver = (tableId: string) => {
    const isOnMobile = ref(false)
    let resizeObserver: ResizeObserver | null = null

    // 监听元素宽度
    const observe = () => {
        if (!window.ResizeObserver) return
        const todoTable = document.getElementById(tableId)
        if (!todoTable) return
        resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                isOnMobile.value = entry.target.clientWidth < 800
            }
        })
        resizeObserver.observe(todoTable)
    }

    // 取消监听元素宽度
    const unobserve = () => {
        if (!resizeObserver) return
        const todoTable = document.getElementById(tableId)
        if (!todoTable) return
        resizeObserver.unobserve(todoTable)
        resizeObserver = null
    }

    return { isOnMobile, observe, unobserve }
}
