/**
 * 「变更历史」数据源（A 档审计日志 · `T704`）—— 组件与基础设施数据面的 DI 唯一入口
 *
 * @description `packages/presentation` 对 `@nao-todo/infrastructure` **零 import**（全仓事实）
 *              ⇒ 在端侧经 `provide(TASK_HISTORY_CONTEXT_KEY, provider)` 注入（`apps/web/src/app.ts`
 *              一处 provide，web + desktop 共用）；本 hook 是唯一实现（与 `use-conflict-ux` 同姿态）。
 *              会话缺失 / 表不可用 ⇒ 返回 `unavailable: true`（面板走「暂无变更记录」空态）。
 * @see docs/prds/2026-11-10-audit-log.md（AC3 / AC5）
 */
import { localSession } from '@nao-todo/infrastructure/src/persistence-local/session/local-session'
import { loadAudit } from '@nao-todo/infrastructure/src/persistence-sync/audit-log'
import type {
    TaskHistoryPage,
    TaskHistoryProvider
} from '@nao-todo/presentation/task/components/task-details/context'

/** 变更历史数据源（缺省分页 = `loadAudit` 的默认页大小，「更早」按 keyset 游标续页） */
export const useTaskHistory = (): TaskHistoryProvider => ({
    load: async (taskId: string, beforeSeq?: number): Promise<TaskHistoryPage> => {
        if (!taskId || !localSession.getCurrentUserId()) {
            return { items: [], hasMore: false, unavailable: true }
        }
        return loadAudit(taskId, beforeSeq)
    }
})