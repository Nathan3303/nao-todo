/**
 * 同步状态 hook（Phase 3 可观测）
 * @description 订阅 SyncStatus，返回响应式同步状态；组件卸载时自动取消订阅。
 */
import { onMounted, onUnmounted, ref } from 'vue'
import { syncStatus, type SyncStatusState } from '@nao-todo/infrastructure'

export const useSyncStatus = () => {
    // 组件挂载时取值（避免模块级快照副作用，见审查报告建议 N4）
    const status = ref<SyncStatusState>(syncStatus.get())

    let unsubscribe: (() => void) | null = null

    onMounted(() => {
        status.value = syncStatus.get()
        unsubscribe = syncStatus.subscribe(() => {
            status.value = syncStatus.get()
        })
    })

    onUnmounted(() => {
        unsubscribe?.()
        unsubscribe = null
    })

    return { status }
}