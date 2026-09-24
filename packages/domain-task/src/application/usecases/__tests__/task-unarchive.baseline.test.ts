import { describe, expect, it, vi } from 'vite-plus/test'
import { TaskDomain, TaskUseCase } from '@nao-todo/domain-task'
import type { TaskRepository, TaskStore } from '@nao-todo/domain-task'

/**
 * T178b 用例先行 · 红基线（清单归档 —— 面9 任务级脱归档：用例层 API 形态）
 *
 * 真源：`docs/adr/2026-09-24-project-archive.md` §15.1（`T175b` 冻结命名）：
 *   - 用例层入口 = **`TaskUseCase.unarchive(id): GoAsync<{ movedToInbox: boolean }>`**
 *     （与 `ProjectUseCase.unarchive(id)` 对称；**不放 `ProjectUseCase`** ⇒ 避免跨域依赖）；
 *   - 仓储接口 `TaskRepository.unarchive?(id)` 为**可选方法** ⇒ 远端（`persistence-go`）**不必实现**；
 *     用例内 `typeof === 'function'` 守卫，缺失 ⇒ 返回「当前环境不支持」。
 *
 * ⚠️ 红基线：`TaskUseCase.unarchive` 尚未落地 ⇒ 本文件 3 例应 **红**（不改任何实现文件）。
 *    分支判定（`projectId === 'inbox'` / `archivedAt = null`）落在**本地仓储同事务**，
 *    由 `packages/infrastructure/.../local-task-unarchive.baseline.test.ts` 行为级覆盖。
 */

type UnarchiveResult = [{ movedToInbox: boolean } | null, string | null]

/** ADR §15.1 冻结的用例层入口形态（实现落地前以窄接口承接） */
type UnarchiveApi = {
    unarchive: (id: string) => Promise<UnarchiveResult>
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

/**
 * 内存任务仓储替身
 * @description 仅覆盖本面所需：`unarchive` **可选**（缺席 = 远端/移动端未实现）。
 */
const makeRepo = (
    options: { withUnarchive?: boolean; movedToInbox?: boolean } = {}
): TaskRepository & { unarchive?: (id: string) => Promise<UnarchiveResult> } => {
    const repo: Record<string, unknown> = {
        get: vi.fn(async () => [null, '任务不存在']),
        create: vi.fn(async () => [null, '未实现']),
        update: vi.fn(async () => null),
        remove: vi.fn(async () => null),
        restore: vi.fn(async () => null),
        list: vi.fn(async () => [{ taskEntities: [] }, null]),
        copy: vi.fn(async () => [null, '未实现']),
        snooze: vi.fn(async () => [null, '未实现'])
    }
    if (options.withUnarchive !== false) {
        repo.unarchive = vi.fn(async () => [{ movedToInbox: options.movedToInbox ?? true }, null])
    }
    return repo as unknown as TaskRepository & {
        unarchive?: (id: string) => Promise<UnarchiveResult>
    }
}

const setup = (repo: TaskRepository) => {
    const useCase = new TaskUseCase(new TaskDomain(repo), repo, makeStore())
    return useCase as unknown as UnarchiveApi
}

describe('T178b · 面9 脱归档（用例层 API 形态，ADR §15.1）', () => {
    it('unarchive(id) ⇒ [{ movedToInbox: true }, null]（清单仍归档 ⇒ 移入收集箱）', async () => {
        const repo = makeRepo({ movedToInbox: true })
        const api = setup(repo)

        const [payload, err] = await api.unarchive('t-1')

        expect(err).toBeNull()
        expect(payload).toEqual({ movedToInbox: true })
        expect(repo.unarchive).toHaveBeenCalledWith('t-1')
    })

    it('unarchive(id) ⇒ [{ movedToInbox: false }, null]（清单已恢复 ⇒ 回原清单）', async () => {
        const repo = makeRepo({ movedToInbox: false })
        const api = setup(repo)

        const [payload, err] = await api.unarchive('t-2')

        expect(err).toBeNull()
        expect(payload).toEqual({ movedToInbox: false })
    })

    it('仓储未实现可选方法 unarchive（远端/移动端）⇒ 报「当前环境不支持」且不抛异常', async () => {
        const repo = makeRepo({ withUnarchive: false })
        const api = setup(repo)
        expect(typeof repo.unarchive).not.toBe('function')

        const [payload, err] = await api.unarchive('t-3')

        expect(payload).toBeNull()
        expect(err).not.toBeNull()
    })
})