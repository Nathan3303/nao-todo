import { inject } from 'vue'
import { APP_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import useResponsiveAside from '@/infrastructure/hooks/use-responsive-aside'
import useAsideWidth from '@nao-todo/infrastructure/hooks/use-aside-width'
import { responsiveTypes } from '@nao-todo/infrastructure/hooks/use-responsive-flag'
import type { AppContext } from '@/app'

/**
 * 番茄钟视图上下文提供器
 * @description 提供番茄钟视图上下文，包括番茄钟视图的宽度、是否显示侧边栏、是否使用浮动侧边栏等
 */
export const usePomodoroView = () => {
    /**
     * 注入应用上下文
     */
    const appContext = inject<AppContext>(APP_CONTEXT_KEY)!

    /**
     * 注入响应式侧边栏上下文
     * @description 提供番茄钟视图的响应式侧边栏上下文
     * @use useResponsiveAside(appContext.responsiveFlag, responsiveTypes.MOBILE) - 响应式侧边栏上下文
     */
    const { visible: isDisplayAside, switchVisible: switchDisplayAside } = useResponsiveAside(
        appContext.responsiveFlag,
        responsiveTypes.MOBILE
    )

    /**
     * 注入侧边栏宽度上下文
     * @description 提供番茄钟视图的侧边栏宽度上下文
     * @use useAsideWidth(256, 'POMODORO_ASIDE_WIDTH') - 侧边栏宽度上下文
     */
    const { width: asideWidth, updater: handleResizeAside } = useAsideWidth(
        256,
        'POMODORO_ASIDE_WIDTH'
    )

    /**
     * 返回番茄钟视图上下文
     */
    return {
        isDisplayAside,
        switchDisplayAside,
        asideWidth,
        handleResizeAside
    }
}

