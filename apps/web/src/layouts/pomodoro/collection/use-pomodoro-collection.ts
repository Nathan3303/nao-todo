import { computed, inject, onMounted, ref, watch } from 'vue'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import {
    newPomodoroRecordUseCase,
    type PomodoroRecordViewObject,
    type PomodoroViewObject
} from '@nao-todo/usecases/pomodoro'
import { usePomodorosStore } from '@/stores/pomodoro-view'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/views/index/pomodoro/context'

/**
 * 常用专注页面 composable
 * @description 加载用户创建的常用专注列表，提供主从（列表 + 详情）交互；
 *              选中某条常用专注时，按 pomodoroId 分页加载其专注记录。
 */
export const usePomodoroCollection = () => {
    /**
     * 注入番茄视图上下文
     */
    const { pomodoroUseCase } = inject(POMODORO_VIEW_CONTEXT_KEY)!

    /**
     * 常用专注 store
     */
    const store = usePomodorosStore()

    /**
     * 加载中状态
     */
    const loading = ref(false)

    /**
     * 当前选中的常用专注 ID
     */
    const selectedId = ref<string | null>(null)

    /**
     * 常用专注列表（数据源自 store）
     */
    const pomodoros = computed(() => store.pomodoros)

    /**
     * 当前选中的常用专注
     */
    const selectedPomodoro = computed<PomodoroViewObject | undefined>(() => {
        if (!selectedId.value) return void 0
        return store.getPomodoro(selectedId.value)
    })

    // ========================================================================
    // 专注记录（按 pomodoroId 分页查询）
    // ========================================================================

    /**
     * 记录视图对象缓存（承接 usecase 写入）
     */
    const recordsMap = ref(new Map<string, PomodoroRecordViewObject>())

    /**
     * 专注记录用例
     */
    const recordUseCase = newPomodoroRecordUseCase({
        addRecord: (r) => {
            recordsMap.value.set(r.id, r)
        },
        addRecords: (rs) => {
            rs.forEach((r) => recordsMap.value.set(r.id, r))
        }
    })

    /**
     * 记录加载状态
     */
    const recordLoading = ref(false)

    /**
     * 记录分页状态
     */
    const recordPage = ref(1)
    const recordLimit = ref(20)
    const recordTotal = ref(0)
    const recordTotalPages = ref(1)

    /**
     * 当前页记录 ID 列表
     */
    const currentRecordIds = ref<string[]>([])

    /**
     * 当前页记录（按 ID 从缓存映射）
     */
    const records = computed(() =>
        currentRecordIds.value
            .map((id) => recordsMap.value.get(id))
            .filter((r): r is PomodoroRecordViewObject => Boolean(r))
    )

    /**
     * 加载专注记录（每页替换）
     */
    const loadRecords = async () => {
        if (!selectedId.value) return
        recordLoading.value = true
        try {
            const [res, err] = await recordUseCase.getRecords({
                pomodoroId: selectedId.value,
                page: recordPage.value,
                limit: recordLimit.value,
                sort: 'startAt:desc'
            })
            if (err !== null) {
                console.warn(unwrapError(err))
                return
            }
            currentRecordIds.value = res.recordIds
            if (res.pagination) {
                recordTotal.value = res.pagination.total
                recordTotalPages.value = Math.max(res.pagination.maxPage || 0, 1)
                // 若当前页超出范围，收敛到末页
                if (recordPage.value > recordTotalPages.value) {
                    recordPage.value = recordTotalPages.value
                }
            }
        } finally {
            recordLoading.value = false
        }
    }

    /**
     * 切换记录页码
     * @param page 目标页码
     */
    const handleRecordPageChange = (page: number) => {
        recordPage.value = page
        loadRecords()
    }

    /**
     * 切换每页条数
     * @param limit 每页条数
     */
    const handleRecordPerPageChange = (limit: number) => {
        recordLimit.value = limit
        recordPage.value = 1
        loadRecords()
    }

    /**
     * 加载常用专注列表
     */
    const loadData = async () => {
        loading.value = true
        try {
            const error = await pomodoroUseCase.loadPomodoros()
            if (error !== null) {
                console.warn(unwrapError(error))
                return
            }
            // 默认选中第一项
            if (!selectedId.value && pomodoros.value.length > 0) {
                selectedId.value = pomodoros.value[0]!.id || null
            }
        } finally {
            loading.value = false
        }
    }

    /**
     * 选中常用专注
     * @param id 常用专注 ID
     */
    const handleSelect = (id: string) => {
        selectedId.value = id
    }

    // 选中项变化时重置分页并重新加载记录
    watch(selectedId, (id) => {
        if (!id) return
        recordPage.value = 1
        currentRecordIds.value = []
        loadRecords()
    })

    onMounted(loadData)

    return {
        loading,
        selectedId,
        pomodoros,
        selectedPomodoro,
        loadData,
        handleSelect,
        // 专注记录
        records,
        recordLoading,
        recordPage,
        recordLimit,
        recordTotal,
        recordTotalPages,
        handleRecordPageChange,
        handleRecordPerPageChange
    }
}

