/**
 * 冲突解决 UX（T165 / W3 · ADR §9.2）—— 组件与基础设施数据面的 DI 唯一入口
 *
 * @description 把 `conflict-journal` 的列表/只读对比/两种恢复动作包成响应式状态与动作，
 *              组件只消费本 hook（不在组件内直接编排仓储/数据面）。
 *              会话缺失（未登录）⇒ 不查库，退空面。
 * @see docs/adr/2026-09-24-stage2-both-ends-local-first.md §9.2
 */
import { ref, type Ref } from 'vue'
import { localSession } from '@nao-todo/infrastructure/src/persistence-local/session/local-session'
import {
    compareConflict,
    listConflicts,
    resolveConflictKeepServer,
    resolveConflictRetryLocal,
    type ConflictComparison,
    type ConflictListItem
} from '@nao-todo/infrastructure/src/persistence-sync/conflict-journal'

export interface ConflictUx {
    items: Ref<ConflictListItem[]>
    folded: Ref<boolean>
    foldedReason: Ref<'limit' | 'evicted' | null>
    loading: Ref<boolean>
    error: Ref<string | null>
    comparison: Ref<ConflictComparison | null>
    /** 动作 B 显式失败（无映射/无快照）⇒ 供 UI 提示，不静默 */
    retryFailed: Ref<boolean>
    refresh: () => Promise<void>
    compare: (item: ConflictListItem) => Promise<void>
    keepServer: (item: ConflictListItem) => Promise<void>
    retryLocal: (item: ConflictListItem) => Promise<void>
    closeComparison: () => void
}

export const useConflictUx = (): ConflictUx => {
    const items = ref<ConflictListItem[]>([])
    const folded = ref(false)
    const foldedReason = ref<'limit' | 'evicted' | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)
    const comparison = ref<ConflictComparison | null>(null)
    const retryFailed = ref(false)

    const currentUserId = (): string => localSession.getCurrentUserId() ?? ''

    const refresh = async (): Promise<void> => {
        const userId = currentUserId()
        if (!userId) {
            items.value = []
            folded.value = false
            foldedReason.value = null
            return
        }
        loading.value = true
        error.value = null
        try {
            const result = await listConflicts(userId)
            items.value = result.items
            folded.value = result.folded
            foldedReason.value = result.foldedReason
        } catch (err) {
            error.value = err instanceof Error ? err.message : String(err)
        } finally {
            loading.value = false
        }
    }

    const compare = async (item: ConflictListItem): Promise<void> => {
        const userId = currentUserId()
        if (!userId) return
        retryFailed.value = false
        comparison.value = await compareConflict(userId, item.table, item.entityId)
    }

    const keepServer = async (item: ConflictListItem): Promise<void> => {
        const userId = currentUserId()
        if (!userId) return
        retryFailed.value = false
        await resolveConflictKeepServer(userId, item.table, item.entityId)
        comparison.value = null
        await refresh()
    }

    const retryLocal = async (item: ConflictListItem): Promise<void> => {
        const userId = currentUserId()
        if (!userId) return
        const result = await resolveConflictRetryLocal(userId, item.table, item.entityId)
        if (!result.ok) {
            retryFailed.value = true
            return
        }
        retryFailed.value = false
        comparison.value = null
        await refresh()
    }

    const closeComparison = (): void => {
        comparison.value = null
        retryFailed.value = false
    }

    return {
        items,
        folded,
        foldedReason,
        loading,
        error,
        comparison,
        retryFailed,
        refresh,
        compare,
        keepServer,
        retryLocal,
        closeComparison
    }
}