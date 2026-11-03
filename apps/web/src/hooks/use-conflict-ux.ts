/**
 * 冲突解决 UX（T165 / W3 · ADR §9.2）—— 组件与基础设施数据面的 DI 唯一入口
 *
 * @description 把 `conflict-journal` 的列表/只读对比/两种恢复动作包成响应式状态与动作，
 *              组件只消费本 hook（不在组件内直接编排仓储/数据面）。
 *              会话缺失（未登录）⇒ 不查库，退空面。
 * @see docs/adr/2026-09-24-stage2-both-ends-local-first.md §9.2
 */
import { ref, type Ref } from 'vue'
import { useProjectsStore } from '@nao-todo/presentation/project'
import { useTagsStore } from '@nao-todo/presentation/tag'
import { localSession } from '@nao-todo/infrastructure/src/persistence-local/session/local-session'
import {
    compareConflict,
    listConflicts,
    resolveConflictKeepServer,
    resolveConflictRetryLocal,
    type ConflictComparison,
    type ConflictListItem,
    type ConflictResolutionResult
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
    /** 动作 A 两态（A2）：旧服务端 ⇒ 「将在下次同步后生效」（不得假装成功） */
    keepServerPending: Ref<boolean>
    /** 动作 A 失败（新编辑 / 快照过期 / 解密失败 / 不支持）⇒ 可见失败，条目保留 */
    keepServerFailed: Ref<boolean>
    refresh: () => Promise<void>
    compare: (item: ConflictListItem) => Promise<void>
    keepServer: (item: ConflictListItem) => Promise<ConflictResolutionResult>
    retryLocal: (item: ConflictListItem) => Promise<void>
    /** DEF-133：`tags` 字段的标签 ID ⇒ 名称（解析不到 ⇒ undefined ⇒ UI 回退「未知标签」） */
    resolveTagName: (id: string) => string | undefined
    /** DEF-133：`projectId` ⇒ 清单名称（解析不到 ⇒ undefined ⇒ UI 回退「未知清单」） */
    resolveProjectName: (id: string) => string | undefined
}

export const useConflictUx = (): ConflictUx => {
    const tagsStore = useTagsStore()
    const projectsStore = useProjectsStore()
    const items = ref<ConflictListItem[]>([])
    const folded = ref(false)
    const foldedReason = ref<'limit' | 'evicted' | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)
    const comparison = ref<ConflictComparison | null>(null)
    const retryFailed = ref(false)
    const keepServerPending = ref(false)
    const keepServerFailed = ref(false)

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

    const keepServer = async (item: ConflictListItem): Promise<ConflictResolutionResult> => {
        const userId = currentUserId()
        if (!userId) return { ok: false, remaining: 0 }
        retryFailed.value = false
        keepServerPending.value = false
        keepServerFailed.value = false
        const result = await resolveConflictKeepServer(userId, item.table, item.entityId)
        // A2 两态：待下次同步 / 失败（条目保留 ⇒ 不静默）
        keepServerPending.value = result.pendingNextSync === true
        keepServerFailed.value = !result.ok && !keepServerPending.value
        if (result.ok) {
            comparison.value = null
            await refresh()
        }
        return result
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

    return {
        items,
        folded,
        foldedReason,
        loading,
        error,
        comparison,
        retryFailed,
        keepServerPending,
        keepServerFailed,
        refresh,
        compare,
        keepServer,
        retryLocal,
        resolveTagName: (id) => tagsStore.getTag(id)?.name,
        resolveProjectName: (id) => projectsStore.getProject(id)?.name
    }
}