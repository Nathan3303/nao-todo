import { describe, expect, it, vi } from 'vite-plus/test'
import {
    CreateTaskValueObject,
    TaskDomain,
    TaskEntity,
    TaskErrorCode,
    TaskUseCase
} from '@nao-todo/domain-task'
import type { TaskRepository, TaskStore } from '@nao-todo/domain-task'
import { updateTaskViewObjectToValueObject } from '../converters'

/**
 * 构造任务实体（20 个位置参数，见 converters.test.ts 注释）
 */
const makeEntity = (
    overrides: Partial<{
        id: string
        parentTaskId: string
        name: string
        deletedAt: string | null
        archivedAt: string | null
    }> = {}
): TaskEntity =>
    new TaskEntity(
        overrides.id ?? 'task-1',
        '2024-01-01T00:00:00.000Z',
        '2024-01-01T00:00:00.000Z',
        overrides.deletedAt ?? null,
        overrides.parentTaskId ?? '',
        overrides.name ?? '任务',
        '',
        'todo',
        'medium',
        '',
        '',
        '',
        [],
        overrides.archivedAt ?? null,
        null,
        null,
        '',
        'none',
        '',
        []
    )

/**
 * 内存仓储 mock：list 仅按 parentTaskId 过滤（守卫的“被移动方已有子任务”检查依赖）
 * @description 不 implements TaskRepository：方法签名按实现推断，构造时以类型断言收敛（测试替身惯例）
 */
class MockTaskRepository {
    entities = new Map<string, TaskEntity>()

    add(entity: TaskEntity) {
        this.entities.set(entity.id, entity)
    }

    async get(id: string) {
        const entity = this.entities.get(id)
        return entity ? [entity, null] : [null, '任务不存在']
    }

    async create(createVO: CreateTaskValueObject) {
        const entity = makeEntity({
            id: `created-${this.entities.size}`,
            parentTaskId: createVO.parentTaskId ?? ''
        })
        this.entities.set(entity.id, entity)
        return [entity, null]
    }

    async update(id: string) {
        if (!this.entities.has(id)) return '任务不存在'
        return null
    }

    async remove(id: string) {
        this.entities.delete(id)
        return null
    }

    async restore() {
        return null
    }

    async list(queryString?: string) {
        const params = new URLSearchParams(queryString ?? '')
        const parentTaskId = params.get('parentTaskId') ?? ''
        const entities = [...this.entities.values()].filter((e) => e.parentTaskId === parentTaskId)
        return [{ taskEntities: entities }, null]
    }

    async copy() {
        return [makeEntity(), null]
    }

    async snooze() {
        return ['2024-01-01T00:00:00.000Z', null]
    }
}

/**
 * 构建被测 usecase（真实 TaskDomain + mock 仓储 + spy store）
 */
const setup = (repo: MockTaskRepository) => {
    const store: TaskStore = {
        tasks: [],
        setTasks: vi.fn(),
        updateTask: vi.fn(),
        addTask: vi.fn(),
        addTasks: vi.fn(),
        getTask: vi.fn(),
        removeTask: vi.fn()
    }
    const taskRepo = repo as unknown as TaskRepository
    const taskDomain = new TaskDomain(taskRepo)
    const useCase = new TaskUseCase(taskDomain, taskRepo, store)
    return { useCase, store }
}

describe('TaskUseCase 父任务赋值守卫（深度限制：仅一级子任务）', () => {
    it('禁止将任务设为自己的父任务（PARENT_SELF）', async () => {
        const repo = new MockTaskRepository()
        repo.add(makeEntity({ id: 'a' }))
        const { useCase } = setup(repo)

        const err = await useCase.update('a', { parentTaskId: 'a' })
        expect(err).toBe(TaskErrorCode.PARENT_SELF)
    })

    it('父任务不存在时拒绝（PARENT_NOT_FOUND）', async () => {
        const repo = new MockTaskRepository()
        repo.add(makeEntity({ id: 'a' }))
        const { useCase } = setup(repo)

        const err = await useCase.update('a', { parentTaskId: 'ghost' })
        expect(err).toBe(TaskErrorCode.PARENT_NOT_FOUND)
    })

    it('父任务为子任务时拒绝（PARENT_MUST_BE_TOP_LEVEL）：子任务不能作为父', async () => {
        const repo = new MockTaskRepository()
        repo.add(makeEntity({ id: 'top' }))
        repo.add(makeEntity({ id: 'sub', parentTaskId: 'top' }))
        const { useCase } = setup(repo)

        // 把另一个任务挂到子任务 sub 之下 → 深度 2
        const err = await useCase.update('a', { parentTaskId: 'sub' })
        expect(err).toBe(TaskErrorCode.PARENT_MUST_BE_TOP_LEVEL)
    })

    it('顶层父任务 + 目标无子任务 → 放行并落库', async () => {
        const repo = new MockTaskRepository()
        repo.add(makeEntity({ id: 'a' }))
        repo.add(makeEntity({ id: 'parent', name: '父任务' }))
        const { useCase, store } = setup(repo)
        const repoUpdate = vi.spyOn(repo, 'update')

        const err = await useCase.update('a', { parentTaskId: 'parent' })
        expect(err).toBeNull()
        expect(repoUpdate).toHaveBeenCalled()
        expect(store.updateTask).toHaveBeenCalledWith(
            'a',
            expect.objectContaining({ parentTaskId: 'parent' })
        )
    })

    it('目标已有子任务时拒绝（PARENT_HAS_SUBTASKS）：移动会造出第二层', async () => {
        const repo = new MockTaskRepository()
        repo.add(makeEntity({ id: 'x' }))
        repo.add(makeEntity({ id: 'x-sub', parentTaskId: 'x' }))
        repo.add(makeEntity({ id: 'y', name: '新父' }))
        const { useCase } = setup(repo)

        const err = await useCase.update('x', { parentTaskId: 'y' })
        expect(err).toBe(TaskErrorCode.PARENT_HAS_SUBTASKS)
    })

    it('parentTaskId 置空串（脱离父任务）始终放行', async () => {
        const repo = new MockTaskRepository()
        repo.add(makeEntity({ id: 'top' }))
        repo.add(makeEntity({ id: 'sub', parentTaskId: 'top' }))
        const { useCase } = setup(repo)
        const repoUpdate = vi.spyOn(repo, 'update')

        const err = await useCase.update('sub', { parentTaskId: '' })
        expect(err).toBeNull()
        expect(repoUpdate).toHaveBeenCalled()
    })

    it('create 携带父任务为子任务时拒绝（PARENT_MUST_BE_TOP_LEVEL）', async () => {
        const repo = new MockTaskRepository()
        repo.add(makeEntity({ id: 'top' }))
        repo.add(makeEntity({ id: 'sub', parentTaskId: 'top' }))
        const { useCase } = setup(repo)
        const repoCreate = vi.spyOn(repo, 'create')

        const [created, err] = await useCase.create({
            parentTaskId: 'sub',
            name: '新任务',
            description: '',
            state: 'todo',
            priority: 'low',
            projectId: null,
            tags: [],
            startAt: null,
            endAt: null,
            remindAt: null,
            remindRepeat: 'none',
            remindTime: null,
            remindWeekdays: []
        })
        expect(err).toBe(TaskErrorCode.PARENT_MUST_BE_TOP_LEVEL)
        expect(created).toBeNull()
        expect(repoCreate).not.toHaveBeenCalled()
    })

    it('create 携带顶层父任务 → 放行', async () => {
        const repo = new MockTaskRepository()
        repo.add(makeEntity({ id: 'top' }))
        const { useCase } = setup(repo)
        const repoCreate = vi.spyOn(repo, 'create')

        const [created, err] = await useCase.create({
            parentTaskId: 'top',
            name: '新子任务',
            description: '',
            state: 'todo',
            priority: 'low',
            projectId: null,
            tags: [],
            startAt: null,
            endAt: null,
            remindAt: null,
            remindRepeat: 'none',
            remindTime: null,
            remindWeekdays: []
        })
        expect(err).toBeNull()
        expect(created).not.toBeNull()
        expect(repoCreate).toHaveBeenCalled()
    })
})

describe('converter parentTaskId 透传（脱离父任务通路）', () => {
    it('parentTaskId 为空串时仍写入值对象（此前 truthy 判断会吞掉 ""）', () => {
        const vo = updateTaskViewObjectToValueObject('sub', { parentTaskId: '' })
        expect(vo.parentTaskId).toBe('')
    })

    it('未携带 parentTaskId 时不写入（undefined 保持）', () => {
        const vo = updateTaskViewObjectToValueObject('sub', { name: '改名' })
        expect(vo.parentTaskId).toBeUndefined()
    })
})