import type { TaskApp } from '@nao-todo/application/task'
import type { GetTasksOptions, GoAsync, ResponseDataPagination, TaskVO } from '@nao-todo/types'
import { unwrapError } from '@nao-todo/utils'
import { reactive } from 'vue'

export type UseTasksLoaderStates = {
    loading: boolean
    error: string
    pagination: ResponseDataPagination
    isDone: boolean
    lastGetOptions: GetTasksOptions
    delay: number
    disabled: boolean
}

const useTasksLoader = (taskApp: TaskApp, originalGetOptions?: GetTasksOptions) => {
    // @states
    const states = reactive<UseTasksLoaderStates>({
        loading: true,
        error: '',
        pagination: { total: 0, page: 1, limit: originalGetOptions?.limit ?? 20, maxPage: 1 },
        isDone: false,
        lastGetOptions: originalGetOptions ?? {},
        delay: 0,
        disabled: false
    })

    // @method 加载函数
    const load = async (extraGetOptions?: GetTasksOptions): GoAsync<TaskVO[]> => {
        states.loading = true
        states.error = ''
        const getOptions: GetTasksOptions = { ...extraGetOptions }
        getOptions.page = states.pagination.page
        getOptions.limit = extraGetOptions?.limit ?? states.pagination.limit
        const [res, err] = await taskApp.list(getOptions)
        if (err !== null) {
            states.error = unwrapError(err)
            states.loading = false
            return [null, err]
        }
        states.loading = false
        if (res.pagination) {
            states.pagination.maxPage = res.pagination.maxPage
            states.pagination.total = res.pagination.total
            states.isDone = res.taskVOs.length < res.pagination?.limit
        }
        states.lastGetOptions = getOptions
        return [res.taskVOs, null]
    }

    // @method 填充数据
    // 通过批量填充缓解渲染压力
    // const fill = (taskVOs: TaskVO[], startAt: number, limit: number) => {
    //     const _f = () => {
    //         let i = startAt
    //         while (i < startAt + limit && i < taskVOs.length) {
    //             taskApp.states.tasks.push(taskVOs[i])
    //             i++
    //         }
    //         if (i < taskVOs.length) fill(taskVOs, i, limit)
    //     }
    //     if (typeof window.requestIdleCallback === 'function') {
    //         return window.requestIdleCallback(() => _f())
    //     }
    //     return nextTick(() => _f())
    // }

    // @method 加载数据并追加
    const loadAndPush = async (extraGetOptions?: GetTasksOptions) => {
        if (states.disabled) return
        states.disabled = true
        const [taskVOs, err] = await load(extraGetOptions)
        if (err !== null) return
        taskApp.states.tasks.push(...taskVOs)
        // fill(taskVOs, 0, 20)
        setTimeout(() => (states.disabled = false), states.delay)
    }

    // @method 加载数据并替换
    const loadAndReplace = async (extraGetOptions?: GetTasksOptions) => {
        if (states.disabled) return
        states.disabled = true
        const [taskVOs, err] = await load(extraGetOptions)
        if (err !== null) return
        taskApp.states.tasks = taskVOs
        // fill(taskVOs, 0, 20)
        setTimeout(() => (states.disabled = false), states.delay)
    }

    // @method 加载下一页
    const loadNextPage = async (isReplace?: boolean) => {
        if (states.disabled) return
        if (states.isDone) return
        states.pagination.page += 1
        if (isReplace) {
            loadAndReplace()
        } else {
            loadAndPush()
        }
    }

    // @method 加载上一页
    const loadPrevPage = async (isReplace?: boolean) => {
        if (states.disabled) return
        if (states.pagination.page === 1) return
        states.pagination.page -= 1
        if (isReplace) {
            loadAndReplace()
        } else {
            loadAndPush()
        }
    }

    // @method 加载第一页
    const loadFirstPage = async (isReplace?: boolean) => {
        if (states.disabled) return
        if (states.pagination.page !== 1) states.pagination.page = 1
        if (isReplace) {
            loadAndReplace()
        } else {
            loadAndPush()
        }
    }

    // @method 加载最后一页
    const loadLastPage = async (isReplace?: boolean) => {
        if (states.disabled) return
        if (states.isDone) return
        states.pagination.page = states.pagination.maxPage
        if (isReplace) {
            loadAndReplace()
        } else {
            loadAndPush()
        }
    }

    // @method 重置状态
    const reset = () => {
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
        // updatePage,
        // updateLimit,
        reset
    }
}

export default useTasksLoader
