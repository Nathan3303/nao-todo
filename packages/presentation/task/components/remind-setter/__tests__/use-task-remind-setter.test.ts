import { describe, expect, it } from 'vite-plus/test'
import { remindDataToSetterVO } from '../use-task-remind-setter'

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