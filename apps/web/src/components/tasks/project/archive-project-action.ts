import { t } from '@nao-todo/shared/locales'
import { unwrapError } from '@nao-todo/shared/utils/user-facing-go-error'
import { NueConfirm, NueMessage } from 'nue-ui'
import type { TaskUseCase } from '@nao-todo/domain-task'
import type { GoAsync } from '@nao-todo/shared/types'

/**
 * 清单归档二次确认与执行（web 入口统一实现）
 * 真源：ADR `docs/adr/2026-09-24-project-archive.md` r1 §4.2 / PRD §5-7
 *   - 二次确认的 **N = 「未归档且未删除」任务数**（**不得**用 `taskCount`，其口径含归档）；
 *     N 取本地任务仓储 `list()` 默认口径（L1 默认排除归档 + 默认排除已删除）；
 *   - 取消 ⇒ 不归档（无副作用）；失败 ⇒ 可见错误提示。
 */

/**
 * 统计「将一并归档」的任务数（N）
 * @description 口径 = 本地任务仓储 `list()` 默认：排除归档 + 排除删除 + **排除已放弃（givenUp）**
 *              （ADR §4.2 / DP-3）。⚠️ 级联 `archiveByProjectId` 会归档已放弃任务
 *              （PA-6 仅跳过已归档/已删除）⇒ **N 可能略小于实际归档数**（差值 = 该清单已放弃任务数），
 *              已由 PM 裁定接受并登记为已知微差。
 */
export const countArchivableTasks = async (
    taskUseCase: Pick<TaskUseCase, 'list'>,
    projectId: string
): Promise<number> => {
    const [result] = await taskUseCase.list({ projectId, limit: 1 })
    return result?.pagination?.total ?? 0
}

export type RunProjectArchiveOptions = {
    taskUseCase: Pick<TaskUseCase, 'list'>
    projectId: string
    /** 归档执行器（由调用方注入，保留各入口的用例/装饰语义） */
    archive: (projectId: string) => GoAsync<void>
}

/** 归档清单：二次确认（含 N）⇒ 执行 ⇒ 可见反馈 */
export const runProjectArchive = async (options: RunProjectArchiveOptions): Promise<void> => {
    const count = await countArchivableTasks(options.taskUseCase, options.projectId)
    const [isByCancel] = await NueConfirm({
        title: t('dialog.projectArchiveConfirmTitle'),
        content: t('dialog.projectArchiveConfirmContent', { count }),
        confirmButtonText: t('dialog.confirmArchive'),
        cancelButtonText: t('common.cancel')
    })
    if (isByCancel) return
    const err = await options.archive(options.projectId)
    if (err !== null) {
        NueMessage.error(t('dialog.projectArchiveFailed', { error: unwrapError(err) }))
        return
    }
    NueMessage.success(t('dialog.projectArchiveSuccess'))
}