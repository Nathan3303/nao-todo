import { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import type { GetTasksOptions, GoAsync, ResponseDataPagination, Task } from '@nao-todo/types'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import { reactive } from 'vue'

export type UseTasksLoaderStates = {
    taskIds: Set<Task['id']>
    loading: boolean
    error: string
    pagination: ResponseDataPagination
    isDone: boolean
    lastGetOptions: GetTasksOptions
    delay: number
    disabled: boolean
}

const useTasksLoader = (taskUseCase: TaskUseCase, originalGetOptions?: GetTasksOptions) => {
    // @states
    const states = reactive<UseTasksLoaderStates>({
        taskIds: new Set<Task['id']>(),
        loading: true,
        error: '',
        pagination: { total: 0, page: 1, limit: originalGetOptions?.limit ?? 20, maxPage: 1 },
        isDone: false,
        lastGetOptions: originalGetOptions ?? {},
        delay: 0,
        disabled: false
    })

    // @method 加载函数
    const load = async (extraGetOptions?: GetTasksOptions): GoAsync<Task['id'][]> => {
        states.loading = true
        states.error = ''
        const getOptions: GetTasksOptions = { ...originalGetOptions, ...extraGetOptions }
        getOptions.page = states.pagination.page
        getOptions.limit = extraGetOptions?.limit ?? states.pagination.limit
        const [res, err] = await taskUseCase.loadTasks(getOptions)
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

    // @method 加载数据并追加
    const loadAndPush = async (extraGetOptions?: GetTasksOptions) => {
        if (states.disabled) return
        states.disabled = true
        const [taskIds, err] = await load(extraGetOptions)
        if (err !== null) return
        taskIds.forEach((id) => states.taskIds.add(id))
        // fill(taskVOs, 0, 20)
        setTimeout(() => (states.disabled = false), states.delay)
    }

    // @method 加载数据并替换
    const loadAndReplace = async (extraGetOptions?: GetTasksOptions) => {
        if (states.disabled) return
        states.disabled = true
        const [taskIds, err] = await load(extraGetOptions)
        if (err !== null) return
        states.taskIds = new Set(taskIds)
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
