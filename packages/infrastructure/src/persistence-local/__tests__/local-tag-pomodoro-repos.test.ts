import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { TagEntity } from '@nao-todo/domain-tag'
import {
    CreatePomodoroRecordValueObject,
    CreatePomodoroValueObject
} from '@nao-todo/domain-pomodoro'
import { localDatabase } from '../db/local-database'
import { LocalPomodoroRecordRepoImpl } from '../repos/pomodoro-record-repo-impl'
import { LocalPomodoroRepoImpl } from '../repos/pomodoro-repo-impl'
import { LocalTagRepoImpl } from '../repos/tag-repo-impl'
import { setup, switchUser } from './local-repos-test-helpers'

describe('LocalTagRepoImpl 创建与列表', () => {
    beforeEach(async () => {
        await setup()
    })

    const makeTagEntity = (name: string) =>
        // 模拟调用方：create 传入 id 为空串的实体（TagEntity._createWithEmpty 语义）
        new TagEntity(
            '',
            new Date().toISOString(),
            new Date().toISOString(),
            null,
            'more2',
            name,
            '',
            '#666666',
            1
        )

    it('创建后自动生成唯一 id，list 可正常展示（名称解密正确）', async () => {
        const repo = new LocalTagRepoImpl()
        const [first, err1] = await repo.create(makeTagEntity('工作'))
        expect(err1).toBeNull()
        expect(first!.id).not.toBe('')
        const [second, err2] = await repo.create(makeTagEntity('生活'))
        expect(err2).toBeNull()
        expect(second!.id).not.toBe(first!.id)

        const [listResult, listErr] = await repo.list()
        expect(listErr).toBeNull()
        expect(listResult!.map((tag) => tag.name).sort()).toEqual(['工作', '生活'])
        expect(listResult!.every((tag) => tag.id !== '')).toBe(true)
    })

    it('删除标签后 list 不再返回（默认排除已删，防侧边栏 TagSmartList 展示）', async () => {
        const repo = new LocalTagRepoImpl()
        const [tag, createErr] = await repo.create(makeTagEntity('临时标签'))
        expect(createErr).toBeNull()
        const [before] = await repo.list()
        expect(before!.length).toBe(1)

        const delErr = await repo.deleteById(tag!.id)
        expect(delErr).toBeNull()

        const [after] = await repo.list()
        expect(after!.length).toBe(0)
        // getById 仍可取回已删标签（供删除反悔/恢复场景）；任务关联渲染走 list 过滤后的 store，
        // 已删标签关联不再展示（与远程 GET /tags/ 不返回已删语义一致）
        const [byId, byIdErr] = await repo.getById(tag!.id)
        expect(byIdErr).toBeNull()
        expect(byId!.deletedAt).not.toBeNull()
    })

    it('deletedAt 为空串（远程拉取未删记录）时 list 正常展示', async () => {
        const repo = new LocalTagRepoImpl()
        const [tag, createErr] = await repo.create(makeTagEntity('远程标签'))
        expect(createErr).toBeNull()
        // 模拟远程同步拉取写入：deletedAt 为 ''（后端空串表示未删）
        const record = await localDatabase.tags.get(tag!.id)
        expect(record).toBeDefined()
        await localDatabase.tags.put({ ...record!, deletedAt: '' })

        const [listResult] = await repo.list()
        expect(listResult!.map((t) => t.name)).toContain('远程标签')
    })

    it('getById 按生成的 id 可取回', async () => {
        const repo = new LocalTagRepoImpl()
        const [created] = await repo.create(makeTagEntity('重要'))
        const [fetched, err] = await repo.getById(created!.id)
        expect(err).toBeNull()
        expect(fetched!.name).toBe('重要')
    })
})

describe('LocalPomodoroRecordRepoImpl 记录列表', () => {
    beforeEach(async () => {
        await setup()
    })

    const makeRecord = (overrides: Partial<CreatePomodoroRecordValueObject> = {}) =>
        new CreatePomodoroRecordValueObject(
            overrides.sessionId ?? `session-${crypto.randomUUID()}`,
            overrides.type ?? 1,
            overrides.startAt ?? new Date().toISOString(),
            overrides.endAt ?? new Date().toISOString(),
            overrides.duration ?? 1500,
            overrides.pomodoroId ?? 'pomodoro-a',
            overrides.taskId ?? '',
            overrides.taskName ?? '',
            overrides.description ?? '',
            overrides.note ?? ''
        )

    it('按 pomodoroId 过滤：只返回该模板的记录', async () => {
        const repo = new LocalPomodoroRecordRepoImpl()
        await repo.create(makeRecord({ pomodoroId: 'pomodoro-a' }))
        await repo.create(makeRecord({ pomodoroId: 'pomodoro-a' }))
        await repo.create(makeRecord({ pomodoroId: 'pomodoro-b' }))

        const [result, err] = await repo.list('pomodoroId=pomodoro-a')
        expect(err).toBeNull()
        expect(result!.entities).toHaveLength(2)
        expect(result!.entities.every((r) => r.pomodoroId === 'pomodoro-a')).toBe(true)
    })

    it('分页：limit/page 切片与 pagination 正确', async () => {
        const repo = new LocalPomodoroRecordRepoImpl()
        for (let i = 0; i < 5; i++) {
            await repo.create(
                makeRecord({ startAt: new Date(Date.now() - i * 1000).toISOString() })
            )
        }

        const [page1, err1] = await repo.list('page=1&limit=2')
        expect(err1).toBeNull()
        expect(page1!.entities).toHaveLength(2)
        expect(page1!.pagination).toEqual({ total: 5, page: 1, limit: 2, maxPage: 3 })

        const [page3, err3] = await repo.list('page=3&limit=2')
        expect(err3).toBeNull()
        expect(page3!.entities).toHaveLength(1)
        expect(page3!.pagination!.maxPage).toBe(3)
    })

    it('切换 pomodoroId 返回不同记录（常用专注切换刷新）', async () => {
        const repo = new LocalPomodoroRecordRepoImpl()
        await repo.create(makeRecord({ pomodoroId: 'pomodoro-a' }))
        await repo.create(makeRecord({ pomodoroId: 'pomodoro-b' }))

        const [forA] = await repo.list('pomodoroId=pomodoro-a')
        const [forB] = await repo.list('pomodoroId=pomodoro-b')

        expect(forA!.entities.map((r) => r.pomodoroId)).toEqual(['pomodoro-a'])
        expect(forB!.entities.map((r) => r.pomodoroId)).toEqual(['pomodoro-b'])
    })

    it('startTime/endTime 过滤：只返回 startAt 落在区间内的记录', async () => {
        const repo = new LocalPomodoroRecordRepoImpl()
        const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
        const todayEnd = new Date(new Date().setHours(23, 59, 59, 999)).toISOString()
        const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
        const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString()

        await repo.create(makeRecord({ startAt: todayStart, endAt: todayStart }))
        await repo.create(makeRecord({ startAt: yesterday, endAt: yesterday }))
        await repo.create(makeRecord({ startAt: tomorrow, endAt: tomorrow }))

        const [result, err] = await repo.list(
            `startTime=${encodeURIComponent(todayStart)}&endTime=${encodeURIComponent(todayEnd)}`
        )
        expect(err).toBeNull()
        expect(result!.entities).toHaveLength(1)
        expect(result!.entities[0]!.startAt).toBe(todayStart)
    })

    it('仅 startTime 或仅 endTime 时边界正确', async () => {
        const repo = new LocalPomodoroRecordRepoImpl()
        const before = '2023-12-31T23:00:00.000Z'
        const after = '2024-01-02T01:00:00.000Z'
        const boundary = '2024-01-01T00:00:00.000Z'

        await repo.create(makeRecord({ startAt: before, endAt: before }))
        await repo.create(makeRecord({ startAt: after, endAt: after }))

        const [afterOnly] = await repo.list(`startTime=${encodeURIComponent(boundary)}`)
        expect(afterOnly!.entities.map((r) => r.startAt)).toEqual([after])

        const [beforeOnly] = await repo.list(`endTime=${encodeURIComponent(boundary)}`)
        expect(beforeOnly!.entities.map((r) => r.startAt)).toEqual([before])
    })
})

describe('LocalPomodoroRecordRepoImpl 累计时长累加', () => {
    beforeEach(async () => {
        await setup('user-1')
    })

    const makeRecord = (overrides: Partial<CreatePomodoroRecordValueObject> = {}) =>
        new CreatePomodoroRecordValueObject(
            overrides.sessionId ?? `session-${crypto.randomUUID()}`,
            overrides.type ?? 1,
            overrides.startAt ?? new Date().toISOString(),
            overrides.endAt ?? new Date().toISOString(),
            overrides.duration ?? 1500,
            overrides.pomodoroId ?? 'pomodoro-a',
            overrides.taskId ?? '',
            overrides.taskName ?? '',
            overrides.description ?? '',
            overrides.note ?? ''
        )

    const createPomodoro = async (name = '模板') => {
        const [entity, err] = await new LocalPomodoroRepoImpl().create(
            new CreatePomodoroValueObject(1, name, '描述', 1500)
        )
        expect(err).toBeNull()
        return entity!
    }

    it('完成专注后 totalDuration 累加本次时长', async () => {
        const pomodoro = await createPomodoro()
        // 初始 totalDuration = 单次时长（1500）
        expect(pomodoro.totalDuration).toBe(1500)

        const repo = new LocalPomodoroRecordRepoImpl()
        await repo.create(makeRecord({ pomodoroId: pomodoro.id, duration: 1500 }))

        const [updated] = await new LocalPomodoroRepoImpl().get(pomodoro.id)
        expect(updated!.totalDuration).toBe(3000)
    })

    it('多次完成专注逐次累加', async () => {
        const pomodoro = await createPomodoro()
        const repo = new LocalPomodoroRecordRepoImpl()
        await repo.create(makeRecord({ pomodoroId: pomodoro.id, duration: 1500 }))
        await repo.create(makeRecord({ pomodoroId: pomodoro.id, duration: 1500 }))
        await repo.create(makeRecord({ pomodoroId: pomodoro.id, duration: 1200 }))

        const [updated] = await new LocalPomodoroRepoImpl().get(pomodoro.id)
        expect(updated!.totalDuration).toBe(1500 + 1500 + 1500 + 1200)
    })

    it('pomodoroId 为空时不影响累计时长', async () => {
        const pomodoro = await createPomodoro()
        const repo = new LocalPomodoroRecordRepoImpl()
        await repo.create(makeRecord({ pomodoroId: null as unknown as string }))

        const [updated] = await new LocalPomodoroRepoImpl().get(pomodoro.id)
        expect(updated!.totalDuration).toBe(1500)
    })

    it('多用户隔离：他人记录不累加本用户常用专注', async () => {
        const pomodoro = await createPomodoro()
        const recordRepo = new LocalPomodoroRecordRepoImpl()

        // user-2 用 user-1 的 pomodoroId 创建记录：应跳过累加
        await switchUser('user-2')
        await recordRepo.create(makeRecord({ pomodoroId: pomodoro.id, duration: 999 }))
        await switchUser('user-1')

        const [updated] = await new LocalPomodoroRepoImpl().get(pomodoro.id)
        expect(updated!.totalDuration).toBe(1500)
    })
})

describe('LocalPomodoroRepoImpl 空串归档过滤', () => {
    beforeEach(async () => {
        await setup('user-1')
    })

    it('archivedAt 为空串（远程拉取未归档记录）时 isArchived=false 仍命中', async () => {
        const repo = new LocalPomodoroRepoImpl()
        const [blank] = await repo.create(
            new CreatePomodoroValueObject(1, '空串归档', '描述', 1500)
        )
        await repo.create(new CreatePomodoroValueObject(1, '正常归档', '描述', 1500))
        // 模拟远程同步拉取写入：未归档 archivedAt 为 ''（后端空串惯例）
        const record = await localDatabase.pomodoros.get(blank!.id)
        await localDatabase.pomodoros.put({ ...record!, archivedAt: '' })

        const [result, err] = await repo.list('isDeleted=false&isArchived=false')
        expect(err).toBeNull()
        expect(result!.pomodoroEntities.map((p) => p.name).sort()).toEqual(['正常归档', '空串归档'])
        const [archived] = await repo.list('isDeleted=false&isArchived=true')
        expect(archived!.pomodoroEntities).toHaveLength(0)

        // 读边界归一：空串在实体层表现为 null
        const [entity] = await repo.get(blank!.id)
        expect(entity!.archivedAt).toBeNull()
    })
})