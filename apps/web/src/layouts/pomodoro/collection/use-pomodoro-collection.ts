import { computed, inject, onMounted, ref } from 'vue'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import type { PomodoroViewObject } from '@nao-todo/usecases/pomodoro'
import usePomodorosStore from '@/stores/pomodoros-store'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/views/index/pomodoro/context'

/**
 * 常用专注页面 composable
 * @description 加载用户创建的常用专注列表，提供主从（列表 + 详情）交互
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
                selectedId.value = pomodoros.value[0].id
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

    onMounted(loadData)

    return {
        loading,
        selectedId,
        pomodoros,
        selectedPomodoro,
        loadData,
        handleSelect
    }
}
