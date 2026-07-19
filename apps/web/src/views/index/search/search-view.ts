import { inject } from 'vue'
import { useResponsiveAside, useAsideWidth, responsiveTypes } from '@nao-todo/shared'
import { APP_CONTEXT_KEY } from '@/context'

/**
 * 搜索视图上下文提供器
 * @description 提供搜索视图上下文，包括搜索视图的宽度、是否显示侧边栏、是否使用浮动侧边栏等
 */
export const useSearchView = () => {
    /**
     * 注入应用上下文
     */
    const appContext = inject(APP_CONTEXT_KEY)!

    /**
     * 注入响应式侧边栏上下文
     * @description 提供搜索视图的响应式侧边栏上下文
     * @use useResponsiveAside(appContext.responsiveFlag, responsiveTypes.MOBILE) - 响应式侧边栏上下文
     */
    const { visible: isDisplayAside, switchVisible: switchDisplayAside } = useResponsiveAside(
        appContext.responsiveFlag,
        responsiveTypes.MOBILE
    )

    /**
     * 注入侧边栏宽度上下文
     * @description 提供搜索视图的侧边栏宽度上下文
     * @use useAsideWidth(256, 'SEARCH_ASIDE_WIDTH') - 侧边栏宽度上下文
     */
    const { width: asideWidth, updater: handleResizeAside } = useAsideWidth(
        256,
        'SEARCH_ASIDE_WIDTH'
    )

    /**
     * 返回搜索视图上下文
     */
    return {
        isDisplayAside,
        switchDisplayAside,
        asideWidth,
        handleResizeAside
    }
}
