import { describe, expect, it, vi } from 'vite-plus/test'
import type { GoAsync } from '@nao-todo/shared/types'
import {
    CreateProjectValueObject,
    ProjectEntity,
    ProjectService,
    ProjectUseCase,
    type ProjectPreferenceEntity,
    type ProjectPreferenceRepository,
    type ProjectRepository,
    type ProjectStore,
    type ProjectViewObject,
    type UpdateProjectValueObject
} from '@nao-todo/domain-project'

/**
 * T178 用例先行 · 红基线（清单归档 —— 领域用例面）
 *
 * 真源：`docs/adr/2026-09-24-project-archive.md`（r1）
 *   - PA-3 / PA-4：`archive()` ⇒ `repo.archive()`；`unarchive()` ⇒ `repo.unarchive()`；
 *                  `deletedAt` 只由真删除写；归档路径**绝不**触碰 `deletedAt` / `deactivedAt`。
 *   - §7.3 / PA-10：取消归档 `sortId` 保留；碰撞 ⇒ 以恢复值作锚归一。
 *   - §7.2：内建清单（收集箱）不可归档。
 *
 * ⚠️ 本文件是**用例先行红基线**：断言的是 ADR 期望行为，当前实现（`archive`/`unarchive`
 *    均误调 `projectRepo.delete`）应 **红**。不改任何实现文件。
 */

// ---------------------------------------------------------------------------
// 测试替身：内存项目仓库（记录调用 + 真实字段语义）
// ---------------------------------------------------------------------------

class InMemoryProjectRepo implements ProjectRepository {
    readonly entities = new Map<string, ProjectEntity>()
    readonly calls: string[] = []

    async get(id: string): GoAsync<ProjectEntity> {
        const entity = this.entities.get(id)
        if (!entity) return [null, '项目不存在']
        return [entity, null]
    }

    async create(vo: CreateProjectValueObject): GoAsync<ProjectEntity> {
        const now = '2026-09-24T00:00:00.000Z'
        const entity = new ProjectEntity(
            `p-${this.entities.size + 1}`,
            now,
            now,
            null,
            vo.name,
            vo.icon,
            vo.description,
            null,
            null,
            (this.entities.size + 1) * 1000
        )
        this.entities.set(entity.id, entity)
        return [entity, null]
    }

    async update(vo: UpdateProjectValueObject): GoAsync<void> {
        this.calls.push('update')
        const entity = this.entities.get(vo.id)
        if (!entity) return '项目不存在'
        if (vo.name !== undefined) entity.name = vo.name
        if (vo.icon !== undefined) entity.icon = vo.icon
        if (vo.description !== undefined) entity.description = vo.description
        if (vo.sortId !== undefined) entity.sortId = vo.sortId
        return null
    }

    async delete(id: string): GoAsync<void> {
        this.calls.push('delete')
        const entity = this.entities.get(id)
        if (!entity) return '项目不存在'
        entity.deletedAt = '2026-09-24T01:00:00.000Z'
        return null
    }

    async restore(id: string): GoAsync<void> {
        this.calls.push('restore')
        const entity = this.entities.get(id)
        if (!entity) return '项目不存在'
        entity.deletedAt = null
        return null
    }

    async archive(id: string): GoAsync<void> {
        this.calls.push('archive')
        const entity = this.entities.get(id)
        if (!entity) return '项目不存在'
        entity.archivedAt = '2026-09-24T02:00:00.000Z'
        return null
    }

    async unarchive(id: string): GoAsync<void> {
        this.calls.push('unarchive')
        const entity = this.entities.get(id)
        if (!entity) return '项目不存在'
        entity.archivedAt = null
        return null
    }

    async list(): GoAsync<ProjectEntity[]> {
        return [[...this.entities.values()], null]
    }

    async batchUpdate(vos: UpdateProjectValueObject[]): GoAsync<ProjectEntity[]> {
        this.calls.push(`batchUpdate:${vos.length}`)
        const entities: ProjectEntity[] = []
        for (const vo of vos) {
            const entity = this.entities.get(vo.id)
            if (!entity) continue
            if (vo.sortId !== undefined) entity.sortId = vo.sortId
            entities.push(entity)
        }
        return [entities, null]
    }
}

class NoopProjectPreferenceRepo implements ProjectPreferenceRepository {
    async getByProjectId(): GoAsync<ProjectPreferenceEntity> {
        return [null, '未实现']
    }

    async save(): GoAsync<void> {
        return null
    }
}

const createStore = (projects: ProjectViewObject[]): ProjectStore => {
    let list = [...projects]
    const store: ProjectStore = {
        projects: list,
        getAllProjects: () => list,
        setProjects: (next) => {
            list = [...next]
        },
        addProject: (project) => {
            list = [...list, project]
        },
        getProject: (id) => list.find((p) => p.id === id),
        updateProjects: (next) => {
            for (const item of next) {
                list = list.map((p) => (p.id === item.id ? { ...p, ...item } : p))
            }
        },
        softDeleteProject: (id) => {
            list = list.map((p) => (p.id === id ? { ...p, isDeleted: true } : p))
        },
        deleteProject: (id) => {
            list = list.filter((p) => p.id !== id)
        },
        restoreProject: (id) => {
            list = list.map((p) => (p.id === id ? { ...p, isDeleted: false } : p))
        },
        updateProject: (id, update) => {
            list = list.map((p) => (p.id === id ? { ...p, ...update } : p))
        },
        projectPreference: undefined,
        setProjectPreference: () => void 0,
        getProjectPreference: () => undefined,
        updatePreferenceColumns: () => void 0,
        updatePreferenceGetTasksOptions: () => void 0,
        getPreferenceGetTasksOption: () => undefined,
        getPreferenceGetTasksOptions: () => ({})
    }
    return store
}

const makeViewObject = (overrides: Partial<ProjectViewObject> = {}): ProjectViewObject => ({
    id: 'p-1',
    createdAt: '2026-09-24T00:00:00.000Z',
    updatedAt: '2026-09-24T00:00:00.000Z',
    deletedAt: null,
    icon: 'more2',
    name: '测试清单',
    description: null,
    archivedAt: null,
    deactivedAt: null,
    sortId: 1000,
    taskCount: 0,
    isArchived: false,
    isDeleted: false,
    ...overrides
})

const seedProject = async (
    repo: InMemoryProjectRepo,
    id: string,
    overrides: Partial<ProjectEntity> = {}
) => {
    const entity = new ProjectEntity(
        id,
        '2026-09-24T00:00:00.000Z',
        '2026-09-24T00:00:00.000Z',
        null,
        '清单',
        'more2',
        null,
        null,
        null,
        overrides.sortId ?? 1000
    )
    Object.assign(entity, overrides)
    repo.entities.set(id, entity)
    return entity
}

const createUseCase = (repo: InMemoryProjectRepo, store: ProjectStore) => {
    const service = new ProjectService(repo, new NoopProjectPreferenceRepo())
    return new ProjectUseCase(service, repo, new NoopProjectPreferenceRepo(), store)
}

// ---------------------------------------------------------------------------
// 面 1：DEF-36 语义（归档 ≠ 删除）
// ---------------------------------------------------------------------------

describe('T178 · 面1 DEF-36：archive/unarchive 委托仓储归档方法，绝不写 deletedAt', () => {
    it('archive(id) ⇒ 调 repo.archive；不调 repo.delete；deletedAt 保持 null', async () => {
        const repo = new InMemoryProjectRepo()
        await seedProject(repo, 'p-1')
        const usecase = createUseCase(repo, createStore([makeViewObject({ id: 'p-1' })]))

        const err = await usecase.archive('p-1')

        expect(err).toBeNull()
        expect(repo.calls).toContain('archive')
        expect(repo.calls).not.toContain('delete')
        const entity = repo.entities.get('p-1')!
        expect(entity.archivedAt).not.toBeNull()
        // PA-4 红线：归档路径绝不写 deletedAt / deactivedAt
        expect(entity.deletedAt).toBeNull()
        expect(entity.deactivedAt).toBeNull()
    })

    it('unarchive(id) ⇒ 调 repo.unarchive；不调 repo.delete；清 archivedAt 且 deletedAt 保持 null', async () => {
        const repo = new InMemoryProjectRepo()
        await seedProject(repo, 'p-1', { archivedAt: '2026-09-24T02:00:00.000Z' })
        const usecase = createUseCase(
            repo,
            createStore([makeViewObject({ id: 'p-1', isArchived: true })])
        )

        const err = await usecase.unarchive('p-1')

        expect(err).toBeNull()
        expect(repo.calls).toContain('unarchive')
        expect(repo.calls).not.toContain('delete')
        const entity = repo.entities.get('p-1')!
        expect(entity.archivedAt).toBeNull()
        expect(entity.deletedAt).toBeNull()
    })

    it('归档路径不得触碰 deactivedAt（三态边界 §2）', async () => {
        const repo = new InMemoryProjectRepo()
        await seedProject(repo, 'p-1')
        const usecase = createUseCase(repo, createStore([makeViewObject({ id: 'p-1' })]))

        await usecase.archive('p-1')
        await usecase.unarchive('p-1')

        const entity = repo.entities.get('p-1')!
        expect(entity.deactivedAt).toBeNull()
        expect(entity.deletedAt).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// 面 10：内建清单（收集箱）不可归档
// ---------------------------------------------------------------------------

describe('T178 · 面10 内建清单不可归档', () => {
    it("archive('inbox') 被拒（返回错误）且不调用 repo.archive / repo.delete", async () => {
        const repo = new InMemoryProjectRepo()
        await seedProject(repo, 'inbox')
        const usecase = createUseCase(repo, createStore([makeViewObject({ id: 'inbox' })]))

        const err = await usecase.archive('inbox')

        expect(err).not.toBeNull()
        expect(repo.calls).not.toContain('archive')
        expect(repo.calls).not.toContain('delete')
    })
})

// ---------------------------------------------------------------------------
// 面 11：复位（sortId 保留 + 碰撞归一，PA-10）
// ---------------------------------------------------------------------------

describe('T178 · 面11 复位（sortId）', () => {
    it('取消归档后 sortId 保留（不因归档丢失）', async () => {
        const repo = new InMemoryProjectRepo()
        await seedProject(repo, 'p-1', { sortId: 4200, archivedAt: '2026-09-24T02:00:00.000Z' })
        const usecase = createUseCase(
            repo,
            createStore([makeViewObject({ id: 'p-1', sortId: 4200, isArchived: true })])
        )

        await usecase.unarchive('p-1')

        expect(repo.entities.get('p-1')!.sortId).toBe(4200)
    })

    it('恢复项 sortId 与活动项碰撞 ⇒ 触发归一（PA-10「回最近位置」）', async () => {
        const repo = new InMemoryProjectRepo()
        await seedProject(repo, 'archived', {
            sortId: 1000,
            archivedAt: '2026-09-24T02:00:00.000Z'
        })
        await seedProject(repo, 'active', { sortId: 1000 })
        const store = createStore([
            makeViewObject({ id: 'archived', sortId: 1000, isArchived: true }),
            makeViewObject({ id: 'active', sortId: 1000 })
        ])
        const batchUpdateSpy = vi.spyOn(repo, 'batchUpdate')
        const usecase = createUseCase(repo, store)

        await usecase.unarchive('archived')

        // 归一口径：以恢复项 sortId 为锚重排，活动项与恢复项不得共用同一 sortId
        const archivedSort = repo.entities.get('archived')!.sortId
        const activeSort = repo.entities.get('active')!.sortId
        expect(archivedSort).not.toBe(activeSort)
        expect(batchUpdateSpy).toHaveBeenCalled()
    })
})