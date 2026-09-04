import type { Pagination } from '@nao-todo/shared/types/pagination'
import type { GoAsync } from '@nao-todo/shared'
import { unwrapError, type GetTasksOptions } from '@nao-todo/shared'
import { reactive } from 'vue'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { TaskUseCase } from '@nao-todo/domain-task'

/**
 * 任务加载器状态
 */
export type UseTasksLoaderStates = {
    taskIds: Set<TaskViewObject['id']>
    loading: boolean
    error: string
    pagination: Pagination
    isDone: boolean
    lastGetOptions: GetTasksOptions
    delay: number
    disabled: boolean
}

/**
 * 任务加载器
 */
export const useTasksLoader = (taskUseCase: TaskUseCase, originalGetOptions?: GetTasksOptions) => {
    // @states
    const states = reactive<UseTasksLoaderStates>({
        taskIds: new Set<TaskViewObject['id']>(),
        loading: true,
        error: '',
        pagination: { total: 0, page: 1, limit: originalGetOptions?.limit ?? 20, maxPage: 1 },
        isDone: false,
        lastGetOptions: originalGetOptions ?? {},
        delay: 0,
        disabled: false
    })

    /**
     * 加载任务数据
     * @param extraGetOptions 额外的选项
     * @returns 任务 ID 列表
     */
    const load = async (extraGetOptions?: GetTasksOptions): GoAsync<TaskViewObject['id'][]> => {
        states.loading = true
        states.error = ''
        const getOptions: GetTasksOptions = { ...originalGetOptions, ...extraGetOptions }
        getOptions.page = states.pagination.page
        getOptions.limit = extraGetOptions?.limit ?? states.pagination.limit
        const [res, err] = await taskUseCase.list(getOptions)
        if (err !== null) {
            states.error = unwrapError(err)
            states.loading = false
            return [null, err]
        }
        states.loading = false
        if (res.pagination) {
            states.pagination.maxPage = res.pagination.maxPage
            states.pagination.total = res.pagination.total
            states.isDone = res.taskIds.length < res.pagination?.limit
        }
        states.lastGetOptions = getOptions
        return [res.taskIds, null]
    }

    /**
     * 加载任务数据并追加到当前任务 ID 列表中
     * @param extraGetOptions 额外的选项
     * @returns 无
     */
    const loadAndPush = async (extraGetOptions?: GetTasksOptions) => {
        if (states.disabled) return
        states.disabled = true
        try {
            const [taskIds, err] = await load(extraGetOptions)
            if (err !== null) return
            taskIds.forEach((id) => states.taskIds.add(id))
        } finally {
            // 无论成功失败都重置 disabled，否则加载失败后"重试"会被 if (states.disabled) 拦截
            setTimeout(() => (states.disabled = false), states.delay)
        }
    }

    /**
     * 加载任务数据并替换当前任务 ID 列表
     * @param extraGetOptions 额外的选项
     * @returns 无
     */
    const loadAndReplace = async (extraGetOptions?: GetTasksOptions) => {
        if (states.disabled) return
        states.disabled = true
        try {
            const [taskIds, err] = await load(extraGetOptions)
            if (err !== null) return
            states.taskIds = new Set(taskIds)
        } finally {
            // 无论成功失败都重置 disabled，否则加载失败后"重试"会被 if (states.disabled) 拦截
            setTimeout(() => (states.disabled = false), states.delay)
        }
    }

    /**
     * 加载下一页
     * @param isReplace 是否替换当前任务 ID 列表
     * @returns 无
     */
    const loadNextPage = async (isReplace?: boolean) => {
        if (states.disabled) return
        if (states.isDone) return
        states.pagination.page += 1
        if (isReplace) {
            loadAndReplace()
            return
        }
        loadAndPush()
    }

    /**
     * 加载上一页
     * @param isReplace 是否替换当前任务 ID 列表
     * @returns 无
     */
    const loadPrevPage = async (isReplace?: boolean) => {
        if (states.disabled) return
        if (states.pagination.page === 1) return
        states.pagination.page -= 1
        if (isReplace) {
            loadAndReplace()
            return
        }
        loadAndPush()
    }

    /**
     * 加载第一页
     * @param isReplace 是否替换当前任务 ID 列表
     * @returns 无
     */
    const loadFirstPage = async (isReplace?: boolean) => {
        if (states.disabled) return
        if (states.pagination.page !== 1) states.pagination.page = 1
        if (isReplace) {
            await loadAndReplace()
            return
        }
        await loadAndPush()
    }

    /**
     * 加载最后一页
     * @param isReplace 是否替换当前任务 ID 列表
     * @returns 无
     */
    const loadLastPage = async (isReplace?: boolean) => {
        if (states.disabled) return
        if (states.isDone) return
        states.pagination.page = states.pagination.maxPage
        if (isReplace) {
            await loadAndReplace()
            return
        }
        await loadAndPush()
    }

    /**
     * 重置任务加载器状态
     * @returns 无
     */
    const reset = () => {
        states.taskIds.clear()
        states.loading = true
        states.error = ''
        states.pagination = { total: 0, page: 1, limit: 20, maxPage: 1 }
        states.isDone = false
        states.lastGetOptions = {}
    }

    // @returns
    return {
        states,
        load,
        loadAndPush,
        loadAndReplace,
        loadNextPage,
        loadPrevPage,
        loadFirstPage,
        loadLastPage,
        reset
    }
}