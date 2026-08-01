import { describe, it, expect } from 'vite-plus/test'
import { CreateTaskValueObject } from '../create-task'
import { TaskErrorCode } from '../../errors'

/**
 * CreateTaskValueObject 构造函数参数顺序（14 个位置参数）：
 * userId, parentTaskId, name, description, state, priority, startAt, endAt,
 * projectId, tags, remindAt, remindRepeat, remindTime, remindWeekdays
 */
const makeVO = (overrides: Record<string, unknown> = {}): CreateTaskValueObject => {
    const base = {
        userId: null as string | null,
        parentTaskId: null as string | null,
        name: '测试任务',
        description: '描述',
        state: 'todo',
        priority: 'low',
        startAt: null as string | null,
        endAt: null as string | null,
        projectId: 'project-1',
        tags: [] as string[],
        remindAt: null as string | null,
        remindRepeat: 'none',
        remindTime: null as string | null,
        remindWeekdays: [] as number[]
    }
    const v = { ...base, ...overrides }
    return new CreateTaskValueObject(
        v.userId as string | null,
        v.parentTaskId as string | null,
        v.name as string,
        v.description as string,
        v.state as string,
        v.priority as string,
        v.startAt as string | null,
        v.endAt as string | null,
        v.projectId as string,
        v.tags as string[],
        v.remindAt as string | null,
        v.remindRepeat as string,
        v.remindTime as string | null,
        v.remindWeekdays as number[]
    )
}

describe('CreateTaskValueObject.validate 合法输入', () => {
    it('默认构造通过校验', () => {
        expect(makeVO().validate()).toBe(null)
    })
})

describe('CreateTaskValueObject.validate 名称校验', () => {
    it('名称为空返回 NAME_EMPTY', () => {
        expect(makeVO({ name: '' }).validate()).toBe(TaskErrorCode.NAME_EMPTY)
    })
    it('名称超长返回 NAME_TOO_LONG', () => {
        expect(makeVO({ name: 'a'.repeat(129) }).validate()).toBe(TaskErrorCode.NAME_TOO_LONG)
    })
    it('名称正好 128 字符通过', () => {
        expect(makeVO({ name: 'a'.repeat(128) }).validate()).toBe(null)
    })
})

describe('CreateTaskValueObject.validate 描述校验', () => {
    it('描述超长返回 DESC_TOO_LONG', () => {
        expect(makeVO({ description: 'a'.repeat(257) }).validate()).toBe(
            TaskErrorCode.DESC_TOO_LONG
        )
    })
})

describe('CreateTaskValueObject.validate 枚举校验', () => {
    it('非法状态返回 STATE_INVALID', () => {
        expect(makeVO({ state: 'unknown' }).validate()).toBe(TaskErrorCode.STATE_INVALID)
    })
    it('非法优先级返回 PRIORITY_INVALID', () => {
        expect(makeVO({ priority: 'urgent' }).validate()).toBe(TaskErrorCode.PRIORITY_INVALID)
    })
    it('非法提醒重复类型返回 REMIND_REPEAT_INVALID', () => {
        expect(makeVO({ remindRepeat: 'hourly' }).validate()).toBe(
            TaskErrorCode.REMIND_REPEAT_INVALID
        )
    })
})

describe('CreateTaskValueObject.validate 时间校验', () => {
    it('非法提醒时刻格式返回 REMIND_TIME_FORMAT_INVALID', () => {
        expect(makeVO({ remindTime: '9:5' }).validate()).toBe(
            TaskErrorCode.REMIND_TIME_FORMAT_INVALID
        )
    })
    it('合法提醒时刻格式通过', () => {
        expect(makeVO({ remindTime: '09:05' }).validate()).toBe(null)
    })
    it('非法提醒时间返回 REMIND_AT_INVALID', () => {
        expect(makeVO({ remindAt: 'not-a-date' }).validate()).toBe(TaskErrorCode.REMIND_AT_INVALID)
    })
    it('非法结束时间返回 END_AT_INVALID', () => {
        expect(makeVO({ endAt: 'not-a-date' }).validate()).toBe(TaskErrorCode.END_AT_INVALID)
    })
    it('非法开始时间返回 START_AT_INVALID', () => {
        expect(
            makeVO({ startAt: 'not-a-date', endAt: '2024-01-03T00:00:00.000Z' }).validate()
        ).toBe(TaskErrorCode.START_AT_INVALID)
    })
    it('开始时间晚于结束时间返回 START_AFTER_END', () => {
        expect(
            makeVO({
                startAt: '2024-01-05T00:00:00.000Z',
                endAt: '2024-01-03T00:00:00.000Z'
            }).validate()
        ).toBe(TaskErrorCode.START_AFTER_END)
    })
})