import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { CreateProjectValueObject } from '@nao-todo/domain-project'
import { TaskDomain, TaskUseCase } from '@nao-todo/domain-task'
import type { TaskRepository, TaskStore } from '@nao-todo/domain-task'
import { messages } from '@nao-todo/shared/locales/messages'
import { localDatabase } from '../db/local-database'
import { LocalProjectRepoImpl } from '../repos/project-repo-impl'
import { LocalTaskRepoImpl } from '../repos/task-repo-impl'
import { makeTaskVO, setup } from './local-repos-test-helpers'

/**
 * T178b 用例先行 · 红基线（清单归档 —— 面9 脱归档：分支判定落点，行为级）
 *
 * 真源：`docs/adr/2026-09-24-project-archive.md` §15.1（`T175b` 冻结命名）+ §5 Q4：
 *   - `TaskUseCase.unarchive(id) ⇒ GoAsync<{ movedToInbox: boolean }>`；
 *   - **分支判定落点 = `LocalTaskRepoImpl.unarchive`（基础设施层）**：同一 Dexie `rw` 事务内
 *     读任务 → 读 `db.projects.get(task.projectId)` → 判归档位；
 *     ① 清单**仍归档** ⇒ `movedToInbox = true` + `archivedAt = null` + **`projectId = 'inbox'`**；
 *     ② 清单**已恢复** ⇒ `movedToInbox = false` + `projectId` 不变（回原清单）；
 *   - 收集箱哨兵为**字面 `'inbox'`**（**禁 `''`**，Q4 / PRD §12-C2）。
 *
 * ⚠️ 红基线：`TaskUseCase.unarchive` / `LocalTaskRepoImpl.unarchive` 尚未落地 ⇒ 本文件应 **红**
 *    （不改任何实现文件；`rd-fe-T180` 并行在制）。
 */

const ARCHIVED_AT = '2026-09-01T00:00:00.000Z'

/** ADR §15.1 冻结的用例层入口形态（实现落地前以窄接口承接） */
type UnarchiveApi = {
    unarchive: (id: string) => Promise<[{ movedToInbox: boolean } | null, string | null]>
}

const makeStore = (): TaskStore => ({
    tasks: [],
    setTasks: () => void 0,
    updateTask: () => void 0,
    addTask: () => void 0,
    addTasks: () => void 0,
    getTask: () => undefined,
    removeTask: () => void 0
})

const composeUseCase = (taskRepo: TaskRepository): UnarchiveApi =>
    new TaskUseCase(new TaskDomain(taskRepo), taskRepo, makeStore()) as unknown as UnarchiveApi

/** 建一条任务并直接打上归档位（脱归档分支与级联解耦：不依赖 `archiveByProjectId`） */
const seedArchivedTask = async (projectId: string): Promise<string> => {
    const repo = new LocalTaskRepoImpl()
    const [task, err] = await repo.create(makeTaskVO({ name: '归档任务', projectId }))
    expect(err).toBeNull()
    await localDatabase.tasks.put({
        ...(await localDatabase.tasks.get(task!.id))!,
        archivedAt: ARCHIVED_AT
    })
    return task!.id
}

describe('T178b · 面9 脱归档分支判定（LocalTaskRepoImpl 同事务，行为级）', () => {
    beforeEach(async () => {
        await setup()
    })

    it("① 清单仍归档 ⇒ movedToInbox=true + archivedAt=null + projectId='inbox'", async () => {
        const projectRepo = new LocalProjectRepoImpl()
        const [project, projectErr] = await projectRepo.create(
            new CreateProjectValueObject('归档清单', 'more2', '')
        )
        expect(projectErr).toBeNull()
        expect(await projectRepo.archive(project!.id)).toBeNull()

        const taskId = await seedArchivedTask(project!.id)
        const [payload, err] = await composeUseCase(new LocalTaskRepoImpl()).unarchive(taskId)

        expect(err).toBeNull()
        expect(payload).toEqual({ movedToInbox: true })
        const record = (await localDatabase.tasks.get(taskId))!
        expect(record.archivedAt).toBeNull()
        expect(record.projectId).toBe('inbox')
    })

    it('② 清单已恢复 ⇒ movedToInbox=false + projectId 不变（回原清单）', async () => {
        const projectRepo = new LocalProjectRepoImpl()
        const [project, projectErr] = await projectRepo.create(
            new CreateProjectValueObject('活动清单', 'more2', '')
        )
        expect(projectErr).toBeNull()

        const taskId = await seedArchivedTask(project!.id)
        const [payload, err] = await composeUseCase(new LocalTaskRepoImpl()).unarchive(taskId)

        expect(err).toBeNull()
        expect(payload).toEqual({ movedToInbox: false })
        const record = (await localDatabase.tasks.get(taskId))!
        expect(record.archivedAt).toBeNull()
        expect(record.projectId).toBe(project!.id)
    })
})

describe('T178b · 面9 i18n 提醒文案键（ADR §15.1 冻结名）', () => {
    const dict = (locale: 'zh-CN' | 'en-US'): Record<string, string> =>
        messages[locale] as unknown as Record<string, string>

    it.each(['task.unarchivedToInbox', 'task.unarchivedToInboxHint'])(
        '中/英均存在非空文案：%s',
        (key) => {
            expect(dict('zh-CN')[key] ?? '').not.toBe('')
            expect(dict('en-US')[key] ?? '').not.toBe('')
        }
    )
})