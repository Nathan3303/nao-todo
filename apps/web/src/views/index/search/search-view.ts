import { inject, onMounted } from 'vue'
import { INDEX_VIEW_CONTEXT_KEY } from '../context'

/**
 * 搜索视图上下文提供器
 * @description 提供搜索视图上下文，包括搜索视图的宽度、是否显示侧边栏、是否使用浮动侧边栏等
 */
export const useSearchView = () => {
    // @contexts
    const { isUseFloatAside, isDisplayAside } = inject(INDEX_VIEW_CONTEXT_KEY)!

    // @mounted 处理侧边栏的显示问题
    onMounted(() => {
        if (isUseFloatAside.value) return
        isDisplayAside.value = false
    })

    // @returns
    // return {}
}
