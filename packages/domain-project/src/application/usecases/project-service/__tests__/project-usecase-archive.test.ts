import { describe, expect, it, vi } from 'vite-plus/test'
import { ProjectEntity, ProjectUseCase } from '@nao-todo/domain-project'
import type {
    ProjectPreferenceRepository,
    ProjectRepository,
    ProjectService,
    ProjectStore
} from '@nao-todo/domain-project'

const NOW = '2026-09-24T02:00:00.000Z'

/**
 * T179 · DEF-36 修复单测（P0 前置）
 * @description 真源：ADR `docs/adr/2026-09-24-project-archive.md` r1 §2。
 *   `archive()` 必须委托 `projectRepo.archive()`（写 `archivedAt`）；
 *   `unarchive()` 必须委托 `projectRepo.unarchive()`（清 `archivedAt`）；
 *   两者**绝不**走 `projectRepo.delete()`（PA-3），归档路径**绝不**写
 *   `deletedAt` / `deactivedAt`（PA-4 数据零丢失红线）。
 *
 * 修复前本文件为红：`archive()`/`unarchive()` 均误调 `projectRepo.delete()`，
 * 于是 `delete` 被调用且 `deletedAt` 被置位。
 */

const createStatefulRepo = () => {
    const entity = new ProjectEntity(
        'p-1',
        '2026-09-24T00:00:00.000Z',
        '2026-09-24T00:00:00.000Z',
        null,
        '清单',
        'more2',
        null,
        null,
        null,
        1000
    )
    const archive = vi.fn(async () => {
        entity.archivedAt = NOW
        return null
    })
    const unarchive = vi.fn(async () => {
        entity.archivedAt = null
        return null
    })
    const del = vi.fn(async () => {
        entity.deletedAt = NOW
        return null
    })
    const repo = { archive, unarchive, delete: del } as unknown as ProjectRepository
    return { repo, entity, archive, unarchive, del }
}

const makeUseCase = (repo: ProjectRepository) =>
    new ProjectUseCase(
        {} as ProjectService,
        repo,
        {} as ProjectPreferenceRepository,
        {} as ProjectStore
    )

describe('ProjectUseCase.archive / unarchive —— DEF-36（归档 ≠ 删除）', () => {
    it('archive(id) ⇒ 调 repo.archive；不调 repo.delete；archivedAt 置位 ∧ deletedAt 为空', async () => {
        const { repo, entity, archive, del } = createStatefulRepo()

        const err = await makeUseCase(repo).archive('p-1')

        expect(err).toBeNull()
        expect(archive).toHaveBeenCalledWith('p-1')
        expect(del).not.toHaveBeenCalled()
        expect(entity.archivedAt).toBe(NOW)
        expect(entity.deletedAt).toBeNull()
        expect(entity.deactivedAt).toBeNull()
    })

    it('unarchive(id) ⇒ 调 repo.unarchive；不调 repo.delete；archivedAt 清空 ∧ deletedAt 为空', async () => {
        const { repo, entity, unarchive, del } = createStatefulRepo()
        entity.archivedAt = NOW

        const err = await makeUseCase(repo).unarchive('p-1')

        expect(err).toBeNull()
        expect(unarchive).toHaveBeenCalledWith('p-1')
        expect(del).not.toHaveBeenCalled()
        expect(entity.archivedAt).toBeNull()
        expect(entity.deletedAt).toBeNull()
        expect(entity.deactivedAt).toBeNull()
    })

    it('archive 错误透传（仓储返回错误时原样返回，不吞错）', async () => {
        const repo = {
            archive: vi.fn(async () => '项目不存在')
        } as unknown as ProjectRepository

        expect(await makeUseCase(repo).archive('missing')).toBe('项目不存在')
    })
})