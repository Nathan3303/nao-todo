import type { TaskApp } from '@nao-todo/application/task'
import type { GetTasksOptions, GoAsync, ResponseDataPagination, TaskVO } from '@nao-todo/types'
import { unwrapError } from '@nao-todo/utils'
import { reactive } from 'vue'

export type UseTasksLoaderStates = {
    loading: boolean
    error: string
    tasks: TaskVO[]
    pagination: ResponseDataPagination
    isDone: boolean
    getOptions: GetTasksOptions
}

const useTasksLoader = (lister: TaskApp['list']) => {
    // @states
    const states = reactive<UseTasksLoaderStates>({
        loading: true,
        error: '',
        tasks: [],
        pagination: { total: 0, page: 1, limit: 20, maxPage: 1 },
        isDone: false,
        getOptions: {}
    })

    // @method 加载函数
    const load = async (extraGetOptions?: GetTasksOptions): GoAsync<TaskVO[]> => {
        states.loading = true
        states.error = ''
        const getOptions: GetTasksOptions = { ...states.getOptions, ...extraGetOptions }
        getOptions.page = states.pagination.page
        getOptions.limit = states.pagination.limit
        const [res, err] = await lister(getOptions)
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
        states.getOptions = getOptions
        return [res.taskVOs, null]
    }

    // @method 加载数据并追加
    const loadAndPush = async (extraGetOptions?: GetTasksOptions) => {
        const [taskVOs, err] = await load(extraGetOptions)
        if (err !== null) return
        states.tasks.push(...taskVOs)
    }

    // @method 加载数据并替换
    const loadAndReplace = async (extraGetOptions?: GetTasksOptions) => {
        const [taskVOs, err] = await load(extraGetOptions)
        if (err !== null) return
        states.tasks = taskVOs
    }

    // @method 更新页码
    const handleUpdatePage = (page: number) => {
        states.pagination.page = page
        load()
    }

    // @method 更新每页显示数量
    const handleUpdatePerPage = (limit: number) => {
        states.pagination.limit = limit
        handleUpdatePage(1)
    }

    // @method 加载下一页
    const loadNextPage = async (isReplace?: boolean) => {
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
        if (states.pagination.page === 1) return
        states.pagination.page = 1
        if (isReplace) {
            loadAndReplace()
        } else {
            loadAndPush()
        }
    }

    // @method 加载最后一页
    const loadLastPage = async (isReplace?: boolean) => {
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
        states.tasks = []
        states.pagination = { total: 0, page: 1, limit: 20, maxPage: 1 }
        states.isDone = false
        states.getOptions = {}
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
        handleUpdatePage,
        handleUpdatePerPage,
        reset
    }
}

export default useTasksLoader
