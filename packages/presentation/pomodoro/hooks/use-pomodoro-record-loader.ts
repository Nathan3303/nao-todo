import {
    unwrapError,
    type GoAsync,
    type ResponseDataPagination,
    type Subscriber
} from '@nao-todo/shared'
import { computed, onUnmounted, reactive } from 'vue'
import { usePomodoroRecordsStore } from '../stores'
import type { GetPomodoroRecordsOptions, PomodoroRecordViewObject } from '@nao-todo/domain-pomodoro'
import type { PomodoroRecordUseCase } from '@nao-todo/domain-pomodoro'

export type UsePomodoroRecordLoaderStates = {
    recordIds: Set<string>
    loading: boolean
    error: string
    pagination: ResponseDataPagination
    isDone: boolean
    lastGetOptions: GetPomodoroRecordsOptions
    disabled: boolean
    sort: string
}

export const usePomodoroRecordLoader = (
    pomodoroRecordUseCase: PomodoroRecordUseCase,
    originalGetOptions?: GetPomodoroRecordsOptions,
    subscriber?: Subscriber
) => {
    const recordsStore = usePomodoroRecordsStore()

    // @states
    const states = reactive<UsePomodoroRecordLoaderStates>({
        recordIds: new Set<string>(),
        loading: true,
        error: '',
        pagination: { total: 0, page: 1, limit: originalGetOptions?.limit ?? 20, maxPage: 1 },
        isDone: false,
        lastGetOptions: originalGetOptions ?? {},
        disabled: false,
        sort: originalGetOptions?.sort ?? ''
    })

    // @computed 当前加载的数据（通过 ID 从 Store 映射）
    const records = computed(() =>
        [...states.recordIds].map((id) => recordsStore.getRecord(id)!).filter(Boolean)
    )

    /**
     * 加载 Pomodoro 记录数据
     * @param extraGetOptions 额外的查询选项
     * @returns 记录 ID 列表
     */
    const load = async (extraGetOptions?: GetPomodoroRecordsOptions): GoAsync<string[]> => {
        states.loading = true
        states.error = ''
        const getOptions: GetPomodoroRecordsOptions = {
            ...originalGetOptions,
            ...extraGetOptions
        }
        getOptions.page = states.pagination.page
        getOptions.limit = extraGetOptions?.limit ?? states.pagination.limit
        getOptions.sort = extraGetOptions?.sort ?? states.sort
        const [res, err] = await pomodoroRecordUseCase.getRecords(getOptions)
        if (err !== null) {
            states.error = unwrapError(err)
            states.loading = false
            return [null, err]
        }
        states.loading = false
        if (res.pagination) {
            states.pagination.maxPage = res.pagination.maxPage
            states.pagination.total = res.pagination.total
            states.isDone = res.recordIds.length < res.pagination.limit
        }
        states.lastGetOptions = getOptions
        return [res.recordIds, null]
    }

    /**
     * 加载并追加到当前 ID 列表
     */
    const loadAndPush = async (extraGetOptions?: GetPomodoroRecordsOptions) => {
        if (states.disabled) return
        states.disabled = true
        const [ids, err] = await load(extraGetOptions)
        if (err !== null) {
            states.disabled = false
            return
        }
        ids.forEach((id) => states.recordIds.add(id))
        states.disabled = false
    }

    /**
     * 加载并替换当前 ID 列表
     */
    const loadAndReplace = async (extraGetOptions?: GetPomodoroRecordsOptions) => {
        if (states.disabled) return
        states.disabled = true
        const [ids, err] = await load(extraGetOptions)
        if (err !== null) {
            states.disabled = false
            return
        }
        states.recordIds = new Set(ids)
        states.disabled = false
    }

    /**
     * 加载第一页
     * @param isReplace 是否替换已有数据（默认 true）
     * @param extraGetOptions 额外的查询选项（用于传递动态筛选条件）
     */
    const loadFirstPage = async (
        isReplace: boolean = true,
        extraGetOptions?: GetPomodoroRecordsOptions
    ) => {
        if (states.disabled) return
        if (states.pagination.page !== 1) states.pagination.page = 1
        if (isReplace) {
            await loadAndReplace(extraGetOptions)
        } else {
            await loadAndPush(extraGetOptions)
        }
    }

    /**
     * 加载下一页
     * @param extraGetOptions 额外的查询选项（用于传递动态筛选条件）
     */
    const loadNextPage = async (extraGetOptions?: GetPomodoroRecordsOptions) => {
        if (states.disabled) return
        if (states.isDone) return
        states.pagination.page += 1
        await loadAndPush(extraGetOptions)
    }

    /**
     * 跳转到指定页码
     * @param page 目标页码
     * @param extraGetOptions 额外的查询选项（用于传递动态筛选条件）
     */
    const goToPage = async (page: number, extraGetOptions?: GetPomodoroRecordsOptions) => {
        if (states.disabled) return
        states.pagination.page = page
        await loadAndReplace(extraGetOptions)
    }

    /**
     * 设置每页数量
     * @param limit 每页数量
     * @param extraGetOptions 额外的查询选项（用于传递动态筛选条件）
     */
    const setPageSize = async (limit: number, extraGetOptions?: GetPomodoroRecordsOptions) => {
        if (states.disabled) return
        states.pagination.limit = limit
        states.pagination.page = 1
        await loadAndReplace(extraGetOptions)
    }

    /**
     * 更改排序
     * @param field 排序字段
     * @param order 排序方向 'asc' | 'desc'
     * @param extraGetOptions 额外的查询选项（用于传递动态筛选条件）
     */
    const changeSort = async (
        field: string,
        order: 'asc' | 'desc',
        extraGetOptions?: GetPomodoroRecordsOptions
    ) => {
        if (states.disabled) return
        states.sort = `${field}:${order}`
        await loadAndReplace(extraGetOptions)
    }

    /**
     * 在记录列表头部插入一条记录 ID
     * @description 用于创建记录后，无需重新加载即可在列表中展示
     */
    const prependRecordId = (id: string) => {
        if (states.recordIds.has(id)) return
        // Set 按插入顺序迭代，新 ID 放最前（startAt:desc）
        states.recordIds = new Set([id, ...states.recordIds])
        states.pagination.total += 1
    }

    /**
     * 重置加载器状态
     */
    const reset = () => {
        states.recordIds.clear()
        states.loading = true
        states.error = ''
        states.pagination = { total: 0, page: 1, limit: 20, maxPage: 1 }
        states.isDone = false
        states.lastGetOptions = {}
        states.disabled = false
        states.sort = ''
    }

    // @subscriber 记录创建通知（Subscriber 模式）
    if (subscriber) {
        const handleNewRecordId = (id: string) => {
            prependRecordId(id)
        }
        subscriber.subscribe('AddNewRecordId', handleNewRecordId)
        recordsStore.setOnRecordCreated((record: PomodoroRecordViewObject) => {
            subscriber.emit('AddNewRecordId', record.id)
        })
        onUnmounted(() => {
            subscriber.unsubscribe('AddNewRecordId', handleNewRecordId)
            recordsStore.setOnRecordCreated(null)
        })
    }

    return {
        states,
        records,
        load,
        loadAndPush,
        loadAndReplace,
        loadFirstPage,
        loadNextPage,
        goToPage,
        setPageSize,
        changeSort,
        prependRecordId,
        reset
    }
}