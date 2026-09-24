// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { NueMessage } from 'nue-ui'
import {
    ARCHIVED_READONLY_ERROR,
    PROJECT_ARCHIVE_WRITE_METHODS,
    createProjectArchivedTargetJudge,
    resetArchiveGateForTest,
    withArchivedReadOnlyGuard
} from '@nao-todo/presentation/task/archive-gate'
import { useCaseBinding as desktopBinding } from '@nao-todo/desktopapp/src/renderer/src/hooks/usecases/binding'
import { useCaseBinding as webBinding } from '../binding'

/**
 * T186 · 项目域（清单自身）归档态只读守卫接线（ADR `2026-09-24-project-archive.md` §7.2 / T184 §7②）
 *
 * 背景：P3 的归档守卫**只注入任务域** ⇒ 项目域无守卫：URL 直达归档清单后头部「编辑/删除清单」仍可写。
 * ADR §7.2 明列「**清单自身** `update/delete/resort/archive`（幂等）亦应拦截（除 `unarchive`）」。
 *
 * 断言面：
 *  - web / desktop 两端 binding 均对 `kind==='project'` 注入守卫（同一 `archive-gate` 实现）；
 *  - 归档清单 ⇒ `update/delete/archive/restore/resort` 被拒（`ARCHIVED_READONLY`，原方法零调用）+ 可见提示；
 *  - `unarchive` 放行（唯一例外）；非归档清单写方法正常执行（不误伤）；
 *  - `useProjectUseCase` 工厂返回值即被守卫包裹 ⇒ **URL 直达**场景下头部（同一实例）写操作被拒。
 *
 * 说明（返回形态）：项目域写方法均为 `GoAsync<void>` = `'error'` 形态 ⇒ **本域无 `'tuple'` 落点**；
 * `'tuple'` 分支由 qa 基线（`archive-gate.baseline.test.ts`）与下方「判据级」用例以同型守卫覆盖。
 */

type RepoGet = (id: string) => Promise<[{ archivedAt: string | null } | null, string | null]>

/** 判据替身仓储：仅 `archivedIds` 内清单视为归档 */
const makeProjectRepo = (archivedIds: readonly string[]) => ({
    get: vi.fn<RepoGet>(async (id) =>
        archivedIds.includes(id)
            ? [{ archivedAt: '2026-09-24T00:00:00.000Z' }, null]
            : [{ archivedAt: null }, null]
    )
})

const fakeProjectUseCase = () => ({
    update: vi.fn(async (_id: string, _vo?: unknown) => null as string | null),
    delete: vi.fn(async (_id: string) => null as string | null),
    restore: vi.fn(async (_id: string) => null as string | null),
    archive: vi.fn(async (_id: string) => null as string | null),
    unarchive: vi.fn(async (_id: string) => null as string | null),
    resort: vi.fn(async (_id: string, _bound: string, _before: boolean) => null as string | null),
    loadProjects: vi.fn(async () => null as string | null)
})

const stubProjectRepo = (binding: typeof webBinding, repo: unknown): void => {
    vi.spyOn(binding, 'createProjectRepository').mockReturnValue(repo as never)
}

beforeEach(() => {
    resetArchiveGateForTest()
})

afterEach(() => {
    resetArchiveGateForTest()
    vi.restoreAllMocks()
})

/** 两端 binding 共用一组断言（ADR §7.2「两端一致」） */
const runBindingCases = (label: string, binding: typeof webBinding): void => {
    describe(`${label} binding · 项目域归档守卫`, () => {
        it('归档清单 ⇒ update/delete 被拒（ARCHIVED_READONLY）+ 原方法零调用 + 可见提示', async () => {
            const warn = vi.spyOn(NueMessage, 'warn').mockImplementation(() => {})
            stubProjectRepo(binding, makeProjectRepo(['archived-1']))
            const useCase = fakeProjectUseCase()
            const guarded = binding.decorateUseCase!(useCase, 'project')

            await expect(guarded.update('archived-1', { name: 'x' })).resolves.toBe(
                ARCHIVED_READONLY_ERROR
            )
            await expect(guarded.delete('archived-1')).resolves.toBe(ARCHIVED_READONLY_ERROR)

            expect(useCase.update).not.toHaveBeenCalled()
            expect(useCase.delete).not.toHaveBeenCalled()
            expect(warn).toHaveBeenCalled()
            expect(ARCHIVED_READONLY_ERROR).toBe('ARCHIVED_READONLY')
        })

        it('归档清单 ⇒ restore/resort/archive（幂等）同被拦截（唯一放行口 = unarchive）', async () => {
            stubProjectRepo(binding, makeProjectRepo(['archived-1']))
            const useCase = fakeProjectUseCase()
            const guarded = binding.decorateUseCase!(useCase, 'project')

            await expect(guarded.restore('archived-1')).resolves.toBe(ARCHIVED_READONLY_ERROR)
            await expect(guarded.resort('archived-1', 'other', true)).resolves.toBe(
                ARCHIVED_READONLY_ERROR
            )
            await expect(guarded.archive('archived-1')).resolves.toBe(ARCHIVED_READONLY_ERROR)

            expect(useCase.restore).not.toHaveBeenCalled()
            expect(useCase.resort).not.toHaveBeenCalled()
            expect(useCase.archive).not.toHaveBeenCalled()
        })

        it('归档清单 ⇒ unarchive 放行（取消归档必须可写）', async () => {
            stubProjectRepo(binding, makeProjectRepo(['archived-1']))
            const useCase = fakeProjectUseCase()
            const guarded = binding.decorateUseCase!(useCase, 'project')

            await expect(guarded.unarchive('archived-1')).resolves.toBeNull()
            expect(useCase.unarchive).toHaveBeenCalledWith('archived-1')
        })

        it('非归档清单 ⇒ 写方法正常执行（判据驱动，不误伤）', async () => {
            const warn = vi.spyOn(NueMessage, 'warn').mockImplementation(() => {})
            stubProjectRepo(binding, makeProjectRepo([]))
            const useCase = fakeProjectUseCase()
            const guarded = binding.decorateUseCase!(useCase, 'project')

            await expect(guarded.update('active-1', { name: 'y' })).resolves.toBeNull()
            await expect(guarded.delete('active-1')).resolves.toBeNull()

            expect(useCase.update).toHaveBeenCalledWith('active-1', { name: 'y' })
            expect(useCase.delete).toHaveBeenCalledWith('active-1')
            expect(warn).not.toHaveBeenCalled()
        })

        it('读方法在归档清单上照常透传', async () => {
            stubProjectRepo(binding, makeProjectRepo(['archived-1']))
            const useCase = fakeProjectUseCase()
            const guarded = binding.decorateUseCase!(useCase, 'project')

            await expect(guarded.loadProjects()).resolves.toBeNull()
            expect(useCase.loadProjects).toHaveBeenCalledTimes(1)
        })
    })
}

runBindingCases('web', webBinding)
runBindingCases('desktop', desktopBinding)

describe('T186 · 项目域守卫形态（判据级）', () => {
    it("项目写方法清单全为 'error' 形态（`GoAsync<void>`）⇒ 本域无 'tuple' 落点", () => {
        expect(Object.values(PROJECT_ARCHIVE_WRITE_METHODS)).toEqual(
            Object.values(PROJECT_ARCHIVE_WRITE_METHODS).map(() => 'error')
        )
        // 默认 allow = ['unarchive']：unarchive 列於清单但被例外集放行（与任务域同构）
        expect(PROJECT_ARCHIVE_WRITE_METHODS.unarchive).toBe('error')
    })

    it("同型守卫 + 项目判据：'tuple' 形态返回 [null, ARCHIVED_READONLY]（与任务域同语义）", async () => {
        const tupleUseCase = { createSomething: vi.fn(async (_id: string) => [null, null]) }
        const guarded = withArchivedReadOnlyGuard(
            tupleUseCase,
            { createSomething: 'tuple' },
            {
                isArchivedTarget: createProjectArchivedTargetJudge({
                    isProjectArchived: async (id) => id === 'archived-1'
                })
            }
        )

        await expect(guarded.createSomething('archived-1')).resolves.toEqual([
            null,
            ARCHIVED_READONLY_ERROR
        ])
        expect(tupleUseCase.createSomething).not.toHaveBeenCalled()
    })
})

describe('T186 · useProjectUseCase 接线（URL 直达归档清单 ⇒ 头部写操作被拒）', () => {
    it('工厂返回实例已被守卫包裹：update/delete 在归档清单上被拒且仓储零调用', async () => {
        const repo = makeProjectRepo(['archived-1'])
        stubProjectRepo(webBinding, repo)
        vi.spyOn(webBinding, 'createTaskRepository').mockReturnValue({} as never)
        vi.spyOn(webBinding, 'createProjectPreferenceRepository').mockReturnValue({} as never)

        const { useProjectUseCase } = await import('../use-project-usecase')
        const useCase = useProjectUseCase({} as never)

        await expect(useCase.update('archived-1', { name: 'x' })).resolves.toBe(
            ARCHIVED_READONLY_ERROR
        )
        await expect(useCase.delete('archived-1')).resolves.toBe(ARCHIVED_READONLY_ERROR)
        // 判据读清单；写方法未被触达（零写入）
        expect(repo.get).toHaveBeenCalledWith('archived-1')
    })
})