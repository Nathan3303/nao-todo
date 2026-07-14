import { reactive, computed, onUnmounted } from 'vue'
import type { GoAsync, ResponseDataPagination } from '@nao-todo/types'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import type {
    GetPomodoroRecordsOptions,
    PomodoroRecordUseCase,
    PomodoroRecordViewObject
} from '@nao-todo/usecases/pomodoro'
import type { Subscriber } from '@nao-todo/infrastructure/hooks/use-subscriber'
import { usePomodoroRecordsStore } from '@/stores'

/**
 * Pomodoro 记录加载器状态
 */
export type UsePomodoroRecordLoaderStates = {
    recordIds: Set<string>
    loading: boolean
    error: string
    pagination: ResponseDataPagination
    isDone: boolean
    lastGetOptions: GetPomodoroRecordsOptions
    disabled: boolean
}

/**
 * Pomodoro 记录加载器
 * @description 管理 Pomodoro 记录的分页加载、ID 集合和 Store 交互
 */
const usePomodoroRecordLoader = (
    pomodoroRecordUseCase: PomodoroRecordUseCase,
    originalGetOptions?: GetPomodoroRecordsOptions,
    subscriber?: Subscriber
) => {
    const pomodoroStore = usePomodoroRecordsStore()

    // @states
    const states = reactive<UsePomodoroRecordLoaderStates>({
        recordIds: new Set<string>(),
        loading: true,
        error: '',
        pagination: { total: 0, page: 1, limit: originalGetOptions?.limit ?? 20, maxPage: 1 },
        isDone: false,
        lastGetOptions: originalGetOptions ?? {},
        disabled: false
    })

    // @computed 当前加载的数据（通过 ID 从 Store 映射）
    const records = computed(() =>
        [...states.recordIds].map((id) => pomodoroStore.getRecord(id)!).filter(Boolean)
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
     */
    const loadFirstPage = async (isReplace: boolean = true) => {
        if (states.disabled) return
        if (states.pagination.page !== 1) states.pagination.page = 1
        if (isReplace) {
            await loadAndReplace()
        } else {
            await loadAndPush()
        }
    }

    /**
     * 加载下一页
     */
    const loadNextPage = async () => {
        if (states.disabled) return
        if (states.isDone) return
        states.pagination.page += 1
        await loadAndPush()
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
    }

    // @subscriber 记录创建通知（Subscriber 模式）
    if (subscriber) {
        const handleNewRecordId = (id: string) => {
            prependRecordId(id)
        }
        subscriber.subscribe('AddNewRecordId', handleNewRecordId)
        pomodoroStore.setOnRecordCreated((record: PomodoroRecordViewObject) => {
            subscriber.emit('AddNewRecordId', record.id)
        })
        onUnmounted(() => {
            subscriber.unsubscribe('AddNewRecordId', handleNewRecordId)
            pomodoroStore.setOnRecordCreated(null)
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
        prependRecordId,
        reset
    }
}

export default usePomodoroRecordLoader

