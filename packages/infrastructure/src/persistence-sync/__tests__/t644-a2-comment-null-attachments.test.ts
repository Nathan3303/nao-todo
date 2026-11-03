// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { CreateTaskCommentValueObject } from '@nao-todo/domain-task'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { taskCommentRecordToEntity } from '../../persistence-local/converters/task'
import { LocalTaskCommentRepoImpl } from '../../persistence-local/repos/task-comment-repo-impl'
import { localSession } from '../../persistence-local/session/local-session'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'
import { appendConflict, loadConflictJournal, resolveConflictKeepServer } from '../conflict-journal'

/**
 * T644 / `DEF-132` 同族回归 —— 评论 `attachments: null` 也**不得**抛 `TypeError`
 *
 * 缺陷（修复前）：`taskCommentEntityToRecord` 的 `[...entity.attachments]` 对 `null` 直接抛
 * ``TypeError: entity.attachments is not iterable``（服务端可能返 `null`；与任务
 * `tags` / `remindWeekdays` 同族）。
 *
 * 期望：① 写回链先走 pull 同一套 `resToEntity`（`taskCommentRes2Entity` 把 `null` 归为 `[]`）；
 *      ② 转换器对 `null` 再兜一层（防其它入口直接喂实体快照）⇒ 不抛错、`attachments = []`、
 *      base 写回、条目清除。
 */

const USER_ID = 't644-a2-comment-null'
const SERVER_UPDATED_AT = '2026-11-03T10:00:00.789Z'

type RawRecord = Record<string, unknown>

const resetLocalState = async (): Promise<void> => {
    await localDatabase.projects.clear()
    await localDatabase.projectPreferences.clear()
    await localDatabase.tags.clear()
    await localDatabase.tagPreferences.clear()
    await localDatabase.tasks.clear()
    await localDatabase.taskCheckItems.clear()
    await localDatabase.taskComments.clear()
    await localDatabase.pomodoros.clear()
    await localDatabase.pomodoroRecords.clear()
    await localDatabase.users.clear()
    await localDatabase.userConfigs.clear()
    await localDatabase.meta.clear()
    await localDatabase.deletionSchedules.clear()
    await localDatabase.syncQueue.clear()
    await localDatabase.syncCursor.clear()
    localStorage.clear()
    cryptoService.lock()
    localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, 'jwt-t644-a2-comment')
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'test-password')
}

const makeComment = async (): Promise<string> => {
    const [comment, err] = await new LocalTaskCommentRepoImpl().create(
        new CreateTaskCommentValueObject('task-x', '本地评论', [], false)
    )
    expect(err).toBeNull()
    return (comment as { id: string }).id
}

/** 服务端真实的「评论 stale」`serverCurrent` 形状（`attachments: null` + 空串哨兵） */
const realCommentServerCurrent = (id: string): RawRecord => ({
    id,
    taskId: 'task-x',
    content: '云端评论',
    attachments: null,
    isTopUp: false,
    avatar: '',
    nickname: '',
    createdAt: '2026-11-03T09:00:00Z',
    updatedAt: SERVER_UPDATED_AT,
    deletedAt: ''
})

describe('T644 / DEF-132 同族：评论 attachments 为 null', () => {
    beforeEach(async () => {
        await resetLocalState()
    })

    it('「保留服务端」写回评论行（attachments: null）⇒ 不抛错 + attachments = [] + base + 清条目', async () => {
        const id = await makeComment()
        await appendConflict(USER_ID, {
            kind: 'stale',
            table: 'taskComments',
            entityId: id,
            loser: { id, content: '本地被拒评论' },
            winnerUpdatedAt: SERVER_UPDATED_AT,
            loserUpdatedAt: '2026-11-03T09:00:00.000Z',
            serverCurrent: realCommentServerCurrent(id)
        } as never)

        // 修复前：throws TypeError: entity.attachments is not iterable
        const result = await resolveConflictKeepServer(USER_ID, 'taskComments', id)
        expect(result.ok).toBe(true)

        const raw = (await localDatabase.taskComments.get(id)) as unknown as RawRecord | undefined
        expect(raw).toBeTruthy()
        expect(raw?.syncedServerUpdatedAt).toBe(SERVER_UPDATED_AT)
        const entity = await taskCommentRecordToEntity(raw as never)
        expect(entity.content).toBe('云端评论')
        expect(entity.attachments).toEqual([])
        expect(await loadConflictJournal(USER_ID)).toHaveLength(0)
    })
})