import { inject, reactive, watch } from 'vue'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import { useTagsStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { ViewAdapterNoTaskError } from '@/layouts/app'
import { debounce } from '@nao-todo/infrastructure/utils'
import type { PomodoroViewContext } from '@/views/index/pomodoro/pomodoro-view'
import type { BuiltInProjectPreferenceViewObject } from '@nao-todo/types'

/**
 * 任务选择下拉菜单组件 Hook
 */
export const useTaskSelectDropdown = () => {
    /**
     * 注入上下文
     * @inject INDEX_VIEW_CONTEXT_KEY - 主要视图上下文
     * @inject POMODORO_VIEW_CONTEXT_KEY - 番茄钟视图上下文
     */
    const { taskUseCase, subscriber, getProjectName, showTaskDetails } =
        inject<PomodoroViewContext>(POMODORO_VIEW_CONTEXT_KEY)!

    /**
     * 标签列表
     * @description 用于显示任务的标签列表
     */
    const tagsStore = useTagsStore()
    const { tags } = storeToRefs(tagsStore)

    /**
     * 任务视图 Preference
     */
    const viewPreference = reactive<BuiltInProjectPreferenceViewObject>({
        userId: '',
        projectId: 'PomodoroTaskSelector',
        viewType: 'table',
        columns: {
            name: true,
            description: false,
            state: true,
            priority: true,
            startAt: false,
            endAt: true,
            project: false,
            tags: true,
            givenUpAt: false,
            starMarkAt: false,
            archivedAt: false,
            createdAt: false,
            updatedAt: false,
            deletedAt: false
        },
        getTasksOptions: {
            name: '',
            state: 'todo,in-progress',
            limit: 10,
            isDeleted: false,
            isArchived: false,
            isGivenUp: false,
            sort: { field: 'priority', order: 'desc' },
            relativeDate: '-overdue'
        }
    })

    /**
     * 空状态返回处理
     */
    const getNoTaskError = (): ViewAdapterNoTaskError => {
        return {
            image: '/images/notaskhere.webp',
            imageSize: '8rem',
            message: 'task.noTasks',
            isShowTaskCreateButton: false
        }
    }

    /**
     * 刷新数据
     * @description 带有三秒的冷却时间，防止频繁刷新
     */
    let timer: number | null = null
    const refreshData = () => {
        if (timer) return
        subscriber.emit('RefreshData')
        timer = setTimeout(() => (timer = null), 3000)
    }

    /**
     * 监听任务名称搜索变化，刷新数据
     */
    const debouncedRefreshData = debounce(() => subscriber.emit('RefreshData'), 360)
    watch(
        () => viewPreference.getTasksOptions,
        () => debouncedRefreshData(),
        { deep: true }
    )

    // @returns
    return {
        tags,
        viewPreference,
        taskUseCase,
        subscriber,
        getProjectName,
        showTaskDetails,
        getNoTaskError,
        refreshData
    }
}

