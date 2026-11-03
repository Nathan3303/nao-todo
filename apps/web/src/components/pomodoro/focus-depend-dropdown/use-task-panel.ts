import { POMODORO_VIEW_CONTEXT_KEY } from '@/views/index/pomodoro/context'
import { useTagsStore } from '@nao-todo/presentation/tag'
import { ViewAdapterNoTaskError } from '@nao-todo/presentation/task'
import { debounce } from '@nao-todo/shared/utils/commons'
import { assetUrl } from '@nao-todo/shared/utils/asset-url'
import { storeToRefs } from 'pinia'
import { inject, reactive, watch } from 'vue'

/**
 * 任务专注面板 composable
 */
export const useTaskPanel = () => {
    /**
     * 注入上下文
     * @inject POMODORO_VIEW_CONTEXT_KEY - 番茄钟视图上下文
     */
    const { taskUseCase, subscriber, getProjectName, showTaskDetails } =
        inject(POMODORO_VIEW_CONTEXT_KEY)!

    /**
     * 标签列表
     * @description 用于显示任务的标签列表
     */
    const tagsStore = useTagsStore()
    const { tags } = storeToRefs(tagsStore)

    /**
     * 任务视图 Preference
     */
    const viewPreference = reactive({
        projectId: 'PomodoroTaskSelector',
        viewType: 'table',
        columns: {
            name: true,
            description: false,
            state: false,
            priority: false,
            startAt: false,
            endAt: false,
            project: false,
            tags: false,
            givenUpAt: false,
            starMarkAt: false,
            archivedAt: false,
            createdAt: false,
            updatedAt: false,
            deletedAt: false
        },
        getTasksOptions: {
            name: '',
            // DEF-131：本面板用途是「选一个任务来专注」⇒ 列出**全部未完成**任务，
            // **不得**按截止时间过滤（逾期任务最需要专注；今天 date-only 的任务 endAt=当日 00:00，
            // 会被 `relativeDate: '-overdue'` 判为已逾期而全部隐藏 ⇒ 用户看到「暂无待办任务」）。
            // 不要再加回 relativeDate；如需「只看未逾期」请另开筛选视图。
            state: 'todo,in-progress',
            limit: 10,
            isDeleted: false,
            isArchived: false,
            isGivenUp: false,
            sort: { field: 'priority', order: 'desc' }
        }
    })

    /**
     * 空状态返回处理
     */
    const getNoTaskError = (): ViewAdapterNoTaskError => {
        return {
            image: assetUrl('/images/notaskhere.webp'),
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