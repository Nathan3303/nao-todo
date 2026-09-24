import { describe, expect, it, vi } from 'vite-plus/test'
import { nextTick } from 'vue'
import type { TaskViewObject } from '@nao-todo/domain-task'
import useTaskRemindSetter, { remindDataToSetterVO } from '../use-task-remind-setter'
import type { TaskRemindSetterEmits, TaskRemindSetterUpdateVO } from '../types'

describe('remindDataToSetterVO - 提醒数据转换为设置器初始值', () => {
    it('无提醒（null）时返回默认关闭状态', () => {
        const vo = remindDataToSetterVO({
            remindAt: null,
            remindRepeat: 'none',
            remindTime: null,
            remindWeekdays: []
        })
        expect(vo.enabled).toBe(false)
        expect(vo.hour).toBe(0)
        expect(vo.minute).toBe(0)
        expect(vo.repeatWay).toBe(0)
        expect(vo.repeatDays).toEqual([false, false, false, false, false, false, false])
    })

    it("空串视为无提醒（infrastructure 层 '' 兜底 null 路径）", () => {
        const vo = remindDataToSetterVO({
            remindAt: '',
            remindRepeat: 'daily',
            remindTime: '',
            remindWeekdays: []
        })
        expect(vo.enabled).toBe(false)
    })

    it('字段缺失（undefined）时视为无提醒', () => {
        const vo = remindDataToSetterVO({})
        expect(vo.enabled).toBe(false)
    })

    it('设置提醒时间与每天重复', () => {
        const vo = remindDataToSetterVO({
            remindAt: '2026-01-01T00:00:00.000Z',
            remindRepeat: 'daily',
            remindTime: '09:30',
            remindWeekdays: []
        })
        expect(vo.enabled).toBe(true)
        expect(vo.hour).toBe(9)
        expect(vo.minute).toBe(30)
        expect(vo.repeatWay).toBe(1)
    })

    it('每周重复 + 重复天（7 周日映射到下标 6）', () => {
        const vo = remindDataToSetterVO({
            remindAt: '2026-01-01T00:00:00.000Z',
            remindRepeat: 'weekly',
            remindTime: '18:00',
            remindWeekdays: [1, 7]
        })
        expect(vo.enabled).toBe(true)
        expect(vo.repeatWay).toBe(2)
        expect(vo.repeatDays).toEqual([true, false, false, false, false, false, true])
    })

    it('每月重复映射 repeatWay=3（兼容历史数据）', () => {
        const vo = remindDataToSetterVO({
            remindAt: '2026-01-01T00:00:00.000Z',
            remindRepeat: 'monthly',
            remindTime: '08:00',
            remindWeekdays: []
        })
        expect(vo.repeatWay).toBe(3)
    })

    it('非法提醒时间时保留默认 0:0', () => {
        const vo = remindDataToSetterVO({
            remindAt: '2026-01-01T00:00:00.000Z',
            remindRepeat: 'none',
            remindTime: 'abc',
            remindWeekdays: []
        })
        expect(vo.enabled).toBe(true)
        expect(vo.hour).toBe(0)
        expect(vo.minute).toBe(0)
    })
})

/**
 * 关闭提醒的清空载荷语义（T34：对齐服务端同步契约）
 * @description `nil`/JSON `null` = 缺省不写列、`''` = 清空置 NULL；
 *              故关闭提醒必须以空串表达清空（原 `null` 在 Web 端 `PUT /tasks/{id}` 会被按「缺省」处理
 *              ⇒ `remind_at` 残留旧值，而 `remindRepeat='none'` 照写 ⇒ 状态自相矛盾）。
 */

/** 构造最小 task props（composable 仅读取提醒四件套） */
const makeTask = (remind: {
    remindAt: string | null
    remindTime: string | null
    remindRepeat?: TaskRemindSetterUpdateVO['remindRepeat']
    remindWeekdays?: number[]
}): TaskViewObject =>
    ({
        remindAt: remind.remindAt,
        remindRepeat: remind.remindRepeat ?? 'none',
        remindTime: remind.remindTime,
        remindWeekdays: remind.remindWeekdays ?? []
    }) as unknown as TaskViewObject

/** 装配被测 composable，返回设置器状态与 update 事件捕获 */
const setup = (task: TaskViewObject) => {
    const onUpdate = vi.fn()
    const { vo } = useTaskRemindSetter({ task }, onUpdate as unknown as TaskRemindSetterEmits)
    return { vo, onUpdate }
}

const lastPayload = (onUpdate: ReturnType<typeof vi.fn>): TaskRemindSetterUpdateVO => {
    const call = onUpdate.mock.calls.at(-1)
    if (!call) throw new Error('未捕获到 update 事件')
    // emits('update', vo) ⇒ calls[i] = ['update', vo]
    return call[1] as TaskRemindSetterUpdateVO
}

describe('useTaskRemindSetter.buildUpdateVO - 关闭提醒的清空载荷', () => {
    it('关闭提醒时以空串表达清空（而非 null）', async () => {
        const { vo, onUpdate } = setup(
            makeTask({
                remindAt: '2026-01-01T09:00:00.000Z',
                remindTime: '09:00',
                remindRepeat: 'daily'
            })
        )
        await nextTick()
        onUpdate.mockClear()

        vo.enabled = false
        await nextTick()

        expect(onUpdate).toHaveBeenCalledTimes(1)
        const payload = lastPayload(onUpdate)
        expect(payload.remindAt).toBe('')
        expect(payload.remindTime).toBe('')
        expect(typeof payload.remindAt).toBe('string')
        expect(typeof payload.remindTime).toBe('string')
        // 既有清空语义保持不变
        expect(payload.remindRepeat).toBe('none')
        expect(payload.remindWeekdays).toEqual([])
    })

    it('设值路径不受影响：启用后仍为合法时间与 HH:mm 时刻', async () => {
        const { vo, onUpdate } = setup(makeTask({ remindAt: null, remindTime: null }))
        await nextTick()
        onUpdate.mockClear()

        vo.enabled = true
        vo.hour = 10
        vo.minute = 30
        await nextTick()

        expect(onUpdate).toHaveBeenCalledTimes(1)
        const payload = lastPayload(onUpdate)
        expect(payload.remindTime).toBe('10:30')
        expect(payload.remindAt).not.toBe('')
        expect(new Date(payload.remindAt).getTime()).toBeGreaterThan(0)
    })

    it('当前已无提醒时，关-开-关不产生冗余更新事件（空串与 null 同义归一）', async () => {
        const { vo, onUpdate } = setup(makeTask({ remindAt: null, remindTime: null }))
        await nextTick()
        onUpdate.mockClear()

        vo.enabled = true
        await nextTick()
        expect(onUpdate).toHaveBeenCalledTimes(1) // 启用 = 真实变更

        vo.enabled = false
        await nextTick()
        expect(onUpdate).toHaveBeenCalledTimes(1) // 关闭回原状 = 无变更，不触发
    })
})