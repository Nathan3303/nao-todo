import { describe, expect, it, vi } from 'vite-plus/test'
import { TaskDomain, TaskUseCase } from '@nao-todo/domain-task'
import type { TaskRepository, TaskStore, TaskViewObject } from '@nao-todo/domain-task'
import { TaskErrorCode } from '@nao-todo/domain-task'

/**
 * `T768` 单任务归档（用例层）
 *
 * 口径（用户已定）：
 *   - 入口 = 任务详情「更多」菜单；归档后**只在搜索页**（「包含已归档」）找回；
 *   - 清单已归档 ⇒ 其内任务只读 ⇒ `archive` **硬拒**（可读错误码，不依赖 UI 禁用）；
 *   - `unarchive` **语义零改动**（ADR `2026-09-24-project-archive.md` §15.1 的
 *     「清单仍归档 ⇒ 移入收集箱」逃生口保留）⇒ 用例里同时锁住这条，防后人误加只读守卫；
 *   - 子任务不提供归档（父任务归档即覆盖其可见性）；
 *   - 已归档再归档 = 幂等（不报错、不重复写库）；
 *   - 仓储方法为**可选**（远端 / mobile 不实现）⇒ 缺失返回「当前环境不支持归档」。
 */

type ArchiveResult = string | null
type UnarchiveResult = [{ movedToInbox: boolean } | null, string | null]

/** 归档判据所需的实体最小面（`archive` 只读 parentTaskId / isArchived / archivedAt） */
const makeEntity = (
    overrides: { parentTaskId?: string; archivedAt?: string | null } = {}
): unknown => {
    const archivedAt = overrides.archivedAt ?? null
    return {
        id: 't-1',
        parentTaskId: overrides.parentTaskId ?? '',
        archivedAt,
        isArchived: archivedAt !== null
    }
}

const makeStore = () => {
    const updateTask = vi.fn((_id: string, _patch: Partial<TaskViewObject>) => void 0)
    const store: TaskStore = {
        tasks: [],
        setTasks: () => void 0,
        updateTask: (id, patch) => updateTask(id, patch),
        addTask: () => void 0,
        addTasks: () => void 0,
        getTask: () => undefined,
        removeTask: () => void 0
    }
    return { store, updateTask }
}

type RepoHarness = {
    repo: TaskRepository
    /** 归档调用（仓储可选方法）；`withArchive: false` 时为 `undefined`（远端 / 移动端） */
    archive?: ReturnType<typeof vi.fn>
}

const makeRepo = (
    options: {
        withArchive?: boolean
        entity?: unknown
        archiveError?: string | null
        unarchiveResolvedToInbox?: boolean
    } = {}
): RepoHarness => {
    const repo: Record<string, unknown> = {
        get: vi.fn(async () => [options.entity ?? makeEntity(), null]),
        create: vi.fn(async () => [null, '未实现']),
        update: vi.fn(async () => null),
        remove: vi.fn(async () => null),
        restore: vi.fn(async () => null),
        list: vi.fn(async () => [{ taskEntities: [] }, null]),
        copy: vi.fn(async () => [null, '未实现']),
        snooze: vi.fn(async () => [null, '未实现']),
        unarchive: vi.fn(
            async (): Promise<UnarchiveResult> => [
                { movedToInbox: options.unarchiveResolvedToInbox ?? false },
                null
            ]
        )
    }
    const archive =
        options.withArchive === false
            ? undefined
            : vi.fn(async (): Promise<ArchiveResult> => options.archiveError ?? null)
    if (archive) repo.archive = archive
    return { repo: repo as unknown as TaskRepository, archive }
}

const setup = (repo: TaskRepository) => {
    const { store, updateTask } = makeStore()
    return { useCase: new TaskUseCase(new TaskDomain(repo), repo, store), updateTask }
}

describe('T768 · 单任务归档（用例层）', () => {
    it('① 归档成功 ⇒ 调仓储 + 同步内存 store（archivedAt / isArchived）⇒ 列表不再包含它', async () => {
        const { repo, archive } = makeRepo()
        const { useCase, updateTask } = setup(repo)

        await expect(useCase.archive('t-1')).resolves.toBeNull()

        expect(archive).toHaveBeenCalledWith('t-1')
        expect(updateTask).toHaveBeenCalledTimes(1)
        const [id, patch] = updateTask.mock.calls[0] as [
            string,
            { archivedAt: string; isArchived: boolean }
        ]
        expect(id).toBe('t-1')
        expect(patch.isArchived).toBe(true)
        expect(typeof patch.archivedAt).toBe('string')
        expect(Number.isNaN(Date.parse(patch.archivedAt))).toBe(false)
    })

    it('② 已归档再归档 ⇒ 幂等（不报错、不重复写库）', async () => {
        const { repo, archive } = makeRepo({
            entity: makeEntity({ archivedAt: '2026-11-01T00:00:00.000Z' })
        })
        const { useCase } = setup(repo)

        await expect(useCase.archive('t-1')).resolves.toBeNull()

        expect(archive).not.toHaveBeenCalled()
    })

    it('③ 子任务归档被拒 ⇒ 可读错误码（不依赖 UI 禁用）', async () => {
        const { repo, archive } = makeRepo({ entity: makeEntity({ parentTaskId: 'parent-1' }) })
        const { useCase, updateTask } = setup(repo)

        await expect(useCase.archive('t-1')).resolves.toBe(TaskErrorCode.ARCHIVE_SUBTASK_FORBIDDEN)

        expect(archive).not.toHaveBeenCalled()
        expect(updateTask).not.toHaveBeenCalled()
    })

    it('④ 清单已归档 ⇒ 归档被拒（仓储可读码原样透出）+ store 不动', async () => {
        const { repo } = makeRepo({ archiveError: TaskErrorCode.ARCHIVE_PROJECT_ARCHIVED })
        const { useCase, updateTask } = setup(repo)

        await expect(useCase.archive('t-1')).resolves.toBe(TaskErrorCode.ARCHIVE_PROJECT_ARCHIVED)

        expect(updateTask).not.toHaveBeenCalled()
    })

    it('⑤ 清单已归档时**取消归档仍可用**（ADR §15.1 逃生口语义零改动）', async () => {
        const { repo } = makeRepo({ unarchiveResolvedToInbox: true })
        const { useCase, updateTask } = setup(repo)

        const [payload, err] = await useCase.unarchive('t-1')

        expect(err).toBeNull()
        expect(payload).toEqual({ movedToInbox: true })
        expect(updateTask).toHaveBeenCalledWith('t-1', {
            archivedAt: null,
            isArchived: false,
            projectId: 'inbox'
        })
    })

    it('⑥ 仓储缺失可选方法 archive（远端 / 移动端）⇒ 「当前环境不支持归档」，不抛异常', async () => {
        const { repo, archive } = makeRepo({ withArchive: false })
        const { useCase, updateTask } = setup(repo)
        expect(archive).toBeUndefined()

        await expect(useCase.archive('t-1')).resolves.toBe('当前环境不支持归档')

        expect(updateTask).not.toHaveBeenCalled()
    })
})