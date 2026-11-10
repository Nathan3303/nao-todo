// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import {
    createSyncedTask,
    makeServer,
    makeService,
    patchLocal,
    readJournal,
    readLocal,
    resetLocalState
} from './t675-field-merge-harness'

/**
 * T675 / 字段类型规则（ADR D4「提醒组按组原子」，PM 提醒项） —— 四个提醒字段
 * `remindAt` / `remindRepeat` / `remindTime` / `remindWeekdays` 语义耦合，必须**整组**裁决：
 * 逐字段合并会产出「我的时刻 + 对方的重复规则」这类非法组合。
 *
 * - 用例 A（现状必红）：组内只有对方改、我改的是**组外**字段 ⇒ 组整体取对方、0 记账；
 * - 用例 B（护栏）：组内双方都改 ⇒ 1 条 + 结果**整组**取一方（不得混搭）。
 */
describe('T675 / 提醒四字段按组原子', () => {
    beforeEach(resetLocalState)

    it('提醒组：我改组外字段、对方改整组 ⇒ 组整体取对方 + 0 条', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server, {
            remindRepeat: 'none',
            remindTime: '09:00',
            remindWeekdays: []
        })

        await patchLocal(id, { name: 'B-name' })
        server.setRemote(id, {
            remindRepeat: 'weekly',
            remindTime: '09:00',
            remindWeekdays: [1, 3, 5]
        })

        await makeService(server).pullAll()

        // 现状红：A1 本地胜不合并 ⇒ 记 1 条 + 对方的整组提醒丢失
        expect(await readJournal()).toHaveLength(0)
        const after = await readLocal(id)
        expect(after.name).toBe('B-name')
        expect({
            remindRepeat: after.remindRepeat,
            remindTime: after.remindTime,
            remindWeekdays: after.remindWeekdays
        }).toEqual({ remindRepeat: 'weekly', remindTime: '09:00', remindWeekdays: [1, 3, 5] })
    })

    it('提醒组：组内双方都改 ⇒ 1 条 + 整组取一方（不得混搭）（护栏）', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server, {
            remindRepeat: 'none',
            remindTime: '09:00',
            remindWeekdays: []
        })

        await patchLocal(id, {
            remindRepeat: 'daily',
            remindTime: '08:00',
            remindWeekdays: [1]
        })
        server.setRemote(id, {
            remindRepeat: 'weekly',
            remindTime: '09:00',
            remindWeekdays: [1, 3, 5]
        })

        await makeService(server).pullAll()

        expect(await readJournal()).toHaveLength(1)
        const after = await readLocal(id)
        // 既有裁决（pull-local-wins）= 整组取本地 ⇒ 断言「整组 == 我这一侧」，⛔ 不接受混合组合
        expect({
            remindRepeat: after.remindRepeat,
            remindTime: after.remindTime,
            remindWeekdays: after.remindWeekdays
        }).toEqual({ remindRepeat: 'daily', remindTime: '08:00', remindWeekdays: [1] })
    })
})