/**
 * T549 记录页页面级夹具（**非测试文件**）：`use-records-table` 的可控替身
 *
 * 为什么需要：`records/index.vue` 通过 `provideRecordsTableContext()` 直接消费 pinia store +
 * usecase（jsdom 无 IndexedDB、且不是本需求的被测面）。本夹具只替换**数据来源**，
 * `index.vue` 及其子组件（StatsCards / FilterPanel / TableMain / LoadingError / Pager / DetailPanel）
 * 全部走真实实现 ⇒ 页面结构、三态、分页的真实渲染仍被测。
 *
 * 单一数据源（R1）也由此保证：卡片与表格都从同一个 `records` ref 取值。
 */
import { reactive, ref, type Ref } from 'vue'

export type RecordLike = {
    id: string
    sessionId: string
    type: number
    startAt: string
    endAt: string
    duration: number
    pomodoroId: string | null
    taskId: string
    taskName: string
    description: string
    note: string
    createdAt: string
    updatedAt: string
    deletedAt: null
}

export const makeRecord = (index: number, overrides: Partial<RecordLike> = {}): RecordLike => ({
    id: `r${index}`,
    sessionId: `s${index}`,
    type: index % 2 === 1 ? 1 : 2,
    startAt: `2026-10-0${(index % 9) + 1}T0${index % 10}:00:00.000Z`,
    endAt: `2026-10-0${(index % 9) + 1}T0${index % 10}:25:00.000Z`,
    duration: 1500,
    pomodoroId: 'p1',
    taskId: `t${index}`,
    taskName: `任务 ${index}`,
    description: '',
    note: '',
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    ...overrides
})

export const POMODOROS = [
    { id: 'p1', name: '模板A' },
    { id: 'p2', name: '模板B' }
]

export type MockRecordsContext = {
    resetFilters: () => void
    loadFirstPage: () => void
    stats: {
        totalDuration: Ref<string>
        totalRecords: Ref<number>
        sessionCount: Ref<number>
        pomodoroPercentage: Ref<number>
    }
    filters: Record<string, unknown>
    pomodoros: Ref<typeof POMODOROS>
    applyFilters: () => void
    loading: Ref<boolean>
    error: Ref<string>
    records: Ref<RecordLike[]>
    showDetail: (recordId: string) => void
    pagination: { page: number; limit: number; total: number; maxPage: number }
    goToPage: (page: number) => void
    setPageSize: (limit: number) => void
    selectedRecord: Ref<RecordLike | null>
    detailVisible: Ref<boolean>
}

export const createMockRecordsContext = (): MockRecordsContext => ({
    resetFilters: () => {},
    loadFirstPage: () => {},
    stats: {
        totalDuration: ref('2小时30分'),
        totalRecords: ref(10),
        sessionCount: ref(4),
        pomodoroPercentage: ref(60)
    },
    filters: reactive({
        startTime: '',
        endTime: '',
        type: undefined,
        taskName: '',
        pomodoroId: ''
    }),
    pomodoros: ref(POMODOROS),
    applyFilters: () => {},
    loading: ref(false),
    error: ref(''),
    records: ref<RecordLike[]>([]),
    showDetail: () => {},
    pagination: { page: 1, limit: 20, total: 40, maxPage: 2 },
    goToPage: () => {},
    setPageSize: () => {},
    selectedRecord: ref<RecordLike | null>(null),
    detailVisible: ref(false)
})