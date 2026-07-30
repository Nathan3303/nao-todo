import { POMODORO_VIEW_CONTEXT_KEY } from '@/views/index/pomodoro/context'
import type { GetPomodoroRecordsOptions } from '@nao-todo/domain-pomodoro'
import {
    usePomodoroRecordLoader,
    usePomodoroRecordsStats,
    usePomodoroRecordsStore,
    usePomodorosStore
} from '@nao-todo/presentation/pomodoro'
import { storeToRefs } from 'pinia'
import {
    computed,
    inject,
    onMounted,
    provide,
    reactive,
    readonly,
    ref,
    type InjectionKey
} from 'vue'
import type { PomodoroRecordsFilterState } from './types'

export const POMODORO_RECORDS_TABLE_CONTEXT_KEY: InjectionKey<
    ReturnType<typeof provideRecordsTableContext>
> = Symbol('POMODORO_RECORDS_TABLE_CONTEXT')

export const provideRecordsTableContext = () => {
    const { pomodoroRecordUseCase, pomodoroUseCase } = inject(POMODORO_VIEW_CONTEXT_KEY)!

    const recordsStore = usePomodoroRecordsStore()
    const pomodorosStore = usePomodorosStore()

    // ====================================
    // Filter State
    // ====================================
    const filters = reactive<PomodoroRecordsFilterState>({
        startTime: '',
        endTime: '',
        type: void 0,
        taskName: '',
        pomodoroId: ''
    })

    const applyFilters = (newFilters: Partial<PomodoroRecordsFilterState>) => {
        Object.assign(filters, newFilters)
    }

    const resetFilters = () => {
        filters.startTime = ''
        filters.endTime = ''
        filters.type = void 0
        filters.taskName = ''
        filters.pomodoroId = ''
    }

    // ====================================
    // Record Loader
    // ====================================
    const filterOptions = computed<GetPomodoroRecordsOptions>(() => ({
        startTime: filters.startTime || void 0,
        endTime: filters.endTime || void 0,
        type: filters.type,
        taskName: filters.taskName || void 0,
        pomodoroId: filters.pomodoroId || void 0
    }))

    const loader = usePomodoroRecordLoader(pomodoroRecordUseCase, { sort: 'startAt:desc' })

    // Wrapped loader methods that pass current filter options
    const loadFirstPage = () => loader.loadFirstPage(true, filterOptions.value)
    const loadNextPage = () => loader.loadNextPage(filterOptions.value)
    const goToPage = (page: number) => loader.goToPage(page, filterOptions.value)
    const setPageSize = (limit: number) => loader.setPageSize(limit, filterOptions.value)
    const changeSort = (field: string, order: 'asc' | 'desc') =>
        loader.changeSort(field, order, filterOptions.value)

    // ====================================
    // Statistics
    // ====================================
    const stats = usePomodoroRecordsStats(loader.records)

    // ====================================
    // Detail Panel State
    // ====================================
    const selectedRecordId = ref<string | null>(null)
    const detailVisible = ref(false)

    const showDetail = (recordId: string) => {
        selectedRecordId.value = recordId
        detailVisible.value = true
    }

    const hideDetail = () => {
        detailVisible.value = false
        selectedRecordId.value = null
    }

    const selectedRecord = computed(() => {
        if (!selectedRecordId.value) return null
        return recordsStore.getRecord(selectedRecordId.value) || null
    })

    // ====================================
    // Pomodoro Templates
    // ====================================
    const { pomodoros } = storeToRefs(pomodorosStore)

    const getPomodoroName = (pomodoroId: string | null) => {
        if (!pomodoroId) return '-'
        const pomodoro = pomodorosStore.getPomodoro(pomodoroId)
        return pomodoro?.name || '-'
    }

    // ====================================
    // Init on mount
    // ====================================
    onMounted(async () => {
        await pomodoroUseCase.loadPomodoros()
        await loadFirstPage()
    })

    const ctx = {
        records: loader.records,
        filters: readonly(filters),
        pagination: loader.states.pagination,
        filterOptions,
        loading: computed(() => loader.states.loading),
        isDone: computed(() => loader.states.isDone),
        stats,
        pomodoros,
        selectedRecord,
        selectedRecordId,
        detailVisible,

        // Methods
        applyFilters,
        resetFilters,
        changeSort,
        goToPage,
        setPageSize,
        showDetail,
        hideDetail,
        getPomodoroName,
        loadFirstPage,
        loadNextPage
    }

    provide(POMODORO_RECORDS_TABLE_CONTEXT_KEY, ctx)

    return ctx
}

export const useRecordsTable = () => inject(POMODORO_RECORDS_TABLE_CONTEXT_KEY)!