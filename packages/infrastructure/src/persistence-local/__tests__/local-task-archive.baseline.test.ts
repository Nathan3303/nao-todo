import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { CreateProjectValueObject } from '@nao-todo/domain-project'
import { TaskDomain, TaskErrorCode, TaskUseCase } from '@nao-todo/domain-task'
import type { TaskRepository, TaskStore, TaskViewObject } from '@nao-todo/domain-task'
import { messages } from '@nao-todo/shared/locales/messages'
import { localDatabase } from '../db/local-database'
import { LocalProjectRepoImpl } from '../repos/project-repo-impl'
import { LocalTaskRepoImpl } from '../repos/task-repo-impl'
import { makeTaskVO, setup } from './local-repos-test-helpers'

/**
 * `T768` 单任务归档（本地仓储 + 用例，行为级）
 *
 * 真源 = 用户已定口径：
 *   - 归档 = 写 `archivedAt`（`updatedAt` 同步推进），**`projectId` 不变**（归档 ≠ 移入收集箱）；
 *   - **清单已归档 ⇒ 其内任务只读**：`archive` 硬拒（`TASK_ARCHIVE_PROJECT_ARCHIVED`），记录零改动；
 *   - 找回路径 = 搜索页「包含已归档」（`includeArchived=true`）—— 这也是唯一找回入口。
 *
 * 变异自证：去掉仓储里的「清单已归档 ⇒ 拒绝」判据 ⇒ 第 ② 例红。
 */

/** 记录用例层派生的内存 store（判据 = 归档后视图能把它移除） */
const makeStore = (): TaskStore & { updated: Array<{ id: string; patch: object }> } => {
    const updated: Array<{ id: string; patch: object }> = []
    return {
        tasks: [],
        setTasks: () => void 0,
        updateTask: (id: string, patch: Partial<TaskViewObject>) => {
            updated.push({ id, patch })
        },
        addTask: () => void 0,
        addTasks: () => void 0,
        getTask: () => undefined,
        removeTask: () => void 0,
        updated
    }
}

const composeUseCase = (taskRepo: TaskRepository, store: TaskStore) =>
    new TaskUseCase(new TaskDomain(taskRepo), taskRepo, store)

const createTask = async (projectId: string): Promise<string> => {
    const repo = new LocalTaskRepoImpl()
    const [task, err] = await repo.create(makeTaskVO({ name: '要归档的任务', projectId }))
    expect(err).toBeNull()
    return task!.id
}

describe('T768 · 单任务归档（LocalTaskRepoImpl / TaskUseCase 行为级）', () => {
    beforeEach(async () => {
        await setup()
    })

    it('① 归档成功 ⇒ archivedAt 非空 + updatedAt 同步推进 + projectId 不变 + 同步队列有脏项', async () => {
        const projectRepo = new LocalProjectRepoImpl()
        const [project, projectErr] = await projectRepo.create(
            new CreateProjectValueObject('活动清单', 'more2', '')
        )
        expect(projectErr).toBeNull()

        const taskId = await createTask(project!.id)
        const before = (await localDatabase.tasks.get(taskId))!
        expect(before.archivedAt).toBeNull()

        const repo = new LocalTaskRepoImpl()
        await expect(repo.archive(taskId)).resolves.toBeNull()

        const after = (await localDatabase.tasks.get(taskId))!
        expect(after.archivedAt).not.toBeNull()
        expect(after.updatedAt).toBe(after.archivedAt!)
        expect(after.projectId).toBe(project!.id)

        // 同步队列：本任务有一条 upsert 脏项（否则云端永远拿不到归档态）
        const queue = await localDatabase.syncQueue.toArray()
        const entry = queue.find((item) => item.entityId === taskId)
        expect(entry).toBeTruthy()
        expect(entry!.action).toBe('upsert')
        expect(entry!.table).toBe('tasks')
    })

    it('② 清单已归档 ⇒ 归档被拒（可读错误码），记录零改动（变异点：删掉该判据即红）', async () => {
        const projectRepo = new LocalProjectRepoImpl()
        const [project, projectErr] = await projectRepo.create(
            new CreateProjectValueObject('归档清单', 'more2', '')
        )
        expect(projectErr).toBeNull()
        expect(await projectRepo.archive(project!.id)).toBeNull()

        const taskId = await createTask(project!.id)
        const before = (await localDatabase.tasks.get(taskId))!

        const repo = new LocalTaskRepoImpl()
        await expect(repo.archive(taskId)).resolves.toBe(TaskErrorCode.ARCHIVE_PROJECT_ARCHIVED)

        const after = (await localDatabase.tasks.get(taskId))!
        expect(after.archivedAt).toBe(before.archivedAt)
        expect(after.updatedAt).toBe(before.updatedAt)
    })

    it('③ 清单已归档 ⇒ 用例层归档同样被拒（用户可见路径，非仅仓储）', async () => {
        const projectRepo = new LocalProjectRepoImpl()
        const [project] = await projectRepo.create(
            new CreateProjectValueObject('归档清单', 'more2', '')
        )
        expect(await projectRepo.archive(project!.id)).toBeNull()
        const taskId = await createTask(project!.id)

        const store = makeStore()
        const useCase = composeUseCase(new LocalTaskRepoImpl(), store)

        await expect(useCase.archive(taskId)).resolves.toBe(TaskErrorCode.ARCHIVE_PROJECT_ARCHIVED)
        expect(store.updated).toHaveLength(0)
    })

    it('④ 归档后默认列表查不到，搜索页「包含已归档」查得到（唯一找回路径）', async () => {
        const projectRepo = new LocalProjectRepoImpl()
        const [project] = await projectRepo.create(
            new CreateProjectValueObject('活动清单', 'more2', '')
        )
        const taskId = await createTask(project!.id)

        const repo = new LocalTaskRepoImpl()
        await expect(repo.archive(taskId)).resolves.toBeNull()

        const [defaultList, defaultErr] = await repo.list()
        expect(defaultErr).toBeNull()
        expect(defaultList!.taskEntities.map((t) => t.id)).not.toContain(taskId)

        const [archiveAware] = await repo.list('includeArchived=true')
        expect(archiveAware!.taskEntities.map((t) => t.id)).toContain(taskId)
    })

    it('⑤ 有子任务的任务先归档父任务后，子任务可见性由父任务覆盖（子任务自身不单独归档）', async () => {
        const projectRepo = new LocalProjectRepoImpl()
        const [project] = await projectRepo.create(
            new CreateProjectValueObject('活动清单', 'more2', '')
        )
        const repo = new LocalTaskRepoImpl()
        const [parent, parentErr] = await repo.create(
            makeTaskVO({ name: '父任务', projectId: project!.id })
        )
        expect(parentErr).toBeNull()
        const [child, childErr] = await repo.create(
            makeTaskVO({ name: '子任务', projectId: project!.id, parentTaskId: parent!.id })
        )
        expect(childErr).toBeNull()

        const store = makeStore()
        const useCase = composeUseCase(repo, store)

        // 子任务 ⇒ 用例层拒绝（父任务归档即覆盖其可见性）
        await expect(useCase.archive(child!.id)).resolves.toBe(
            TaskErrorCode.ARCHIVE_SUBTASK_FORBIDDEN
        )
        // 父任务 ⇒ 正常归档，子任务记录本身不受影响
        await expect(useCase.archive(parent!.id)).resolves.toBeNull()
        const childRecord = (await localDatabase.tasks.get(child!.id))!
        expect(childRecord.archivedAt).toBeNull()
    })

    it('⑥ i18n：归档相关文案中/英均存在且非空（说人话，不裸露内部键名）', () => {
        const dict = (locale: 'zh-CN' | 'en-US'): Record<string, string> =>
            messages[locale] as unknown as Record<string, string>

        for (const key of [
            'task.details.archive',
            'task.archiveSuccess',
            'task.archiveFailed',
            'task.error.archiveProjectArchived',
            'task.error.archiveSubtaskForbidden'
        ]) {
            expect(dict('zh-CN')[key] ?? '').not.toBe('')
            expect(dict('en-US')[key] ?? '').not.toBe('')
        }
    })
})