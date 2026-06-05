import { inject, provide, Ref } from 'vue'
import {
    APP_CONTEXT_KEY,
    INDEX_VIEW_CONTEXT_KEY,
    POMODORO_VIEW_CONTEXT_KEY
} from '@/infrastructure/constants/context-keys'
import useResponsiveAside from '@/infrastructure/hooks/use-responsive-aside'
import useAsideWidth from '@nao-todo/infrastructure/hooks/use-aside-width'
import { responsiveTypes } from '@nao-todo/infrastructure/hooks/use-responsive-flag'
import type { AppContext } from '@/app'
import { TaskDetailsPreContext } from '@/layouts/app/task-details/types'
import { TASK_DETAILS_PRE_CONTEXT_KEY } from '@/layouts/app/task-details/constants'
import { IndexViewContext } from '../index-view'

/**
 * 番茄钟视图上下文
 */
export type PomodoroViewContext = {
    asideWidth: Ref<string>
    isDisplayAside: Ref<boolean>
    handleResizeAside: (width: number) => void
    switchDisplayAside: () => void
}

/**
 * 番茄钟视图上下文提供器
 * @description 提供番茄钟视图上下文，包括番茄钟视图的宽度、是否显示侧边栏、是否使用浮动侧边栏等
 */
export const usePomodoroView = () => {
    /**
     * 注入上下文
     * @inject APP_CONTEXT_KEY - 应用上下文
     * @inject INDEX_VIEW_CONTEXT_KEY - 主要视图上下文
     */
    const { responsiveFlag } = inject<AppContext>(APP_CONTEXT_KEY)!
    const { taskUseCase, dialogManager, subscriber, getProjectName } =
        inject<IndexViewContext>(INDEX_VIEW_CONTEXT_KEY)!

    /**
     * 响应式侧边栏
     * @description 应用响应式侧栏 Hook，提供响应式侧边栏上下文
     * @use useResponsiveAside(responsiveFlag, responsiveTypes.MOBILE) - 响应式侧边栏上下文
     */
    const { visible: isDisplayAside, switchVisible: switchDisplayAside } = useResponsiveAside(
        responsiveFlag,
        responsiveTypes.MOBILE
    )

    /**
     * 响应式任务详情面板
     * @description 应用响应式侧栏 Hook，提供响应式任务详情面板上下文
     * @use useResponsiveAside(responsiveFlag, responsiveTypes.MOBILE_TABLE) - 响应式任务详情面板上下文
     */
    const { visible: isDisplayOutline, isFloating: isUseFloatOutline } = useResponsiveAside(
        responsiveFlag,
        responsiveTypes.MOBILE_TABLE
    )

    /**
     * 响应式侧边栏宽度
     * @description 应用响应式侧栏宽度 Hook，提供响应式侧边栏宽度上下文
     * @use useAsideWidth(320, 'POMODORO_ASIDE_WIDTH') - 响应式侧边栏宽度上下文
     */
    const { width: asideWidth, updater: handleResizeAside } = useAsideWidth(
        320,
        'POMODORO_ASIDE_WIDTH'
    )

    /**
     * 响应式任务详情面板宽度
     * @description 应用响应式侧栏宽度 Hook，提供响应式任务详情面板宽度上下文
     * @use useAsideWidth(480, 'POMODORO_OUTLINE_WIDTH') - 响应式任务详情面板宽度上下文
     */
    const { width: outlineWidth, updater: handleResizeOutline } = useAsideWidth(
        480,
        'POMODORO_OUTLINE_WIDTH'
    )

    /**
     * 提供番茄钟视图上下文
     */
    provide<PomodoroViewContext>(POMODORO_VIEW_CONTEXT_KEY, {
        asideWidth,
        isDisplayAside,
        handleResizeAside,
        switchDisplayAside
    })

    /**
     * 提供任务详情适配器上下文
     */
    provide<TaskDetailsPreContext>(TASK_DETAILS_PRE_CONTEXT_KEY, {
        isDisplayOutline,
        isUseFloatOutline,
        outlineWidth,
        handleResizeOutline,
        taskUseCase,
        subscriber,
        dialogManager,
        getProjectName
    })
}

