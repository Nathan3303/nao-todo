import { describe, it, expect } from 'vite-plus/test'
import { UpdateTaskValueObject } from '../update-task'
import { TaskErrorCode } from '../../errors'

// UpdateTaskValueObject 只有 id 为构造参数，其余字段可选赋值
const makeVO = (patch: Partial<UpdateTaskValueObject> = {}): UpdateTaskValueObject => {
    const vo = new UpdateTaskValueObject('task-1')
    Object.assign(vo, patch)
    return vo
}

describe('UpdateTaskValueObject.validate 合法输入', () => {
    it('未设置任何字段时通过校验', () => {
        expect(makeVO().validate()).toBe(null)
    })
})

describe('UpdateTaskValueObject.validate 名称校验', () => {
    it('名称显式设为空串返回 NAME_EMPTY', () => {
        expect(makeVO({ name: '' }).validate()).toBe(TaskErrorCode.NAME_EMPTY)
    })
    it('名称超长返回 NAME_TOO_LONG', () => {
        expect(makeVO({ name: 'a'.repeat(129) }).validate()).toBe(TaskErrorCode.NAME_TOO_LONG)
    })
    it('名称正好 128 字符通过', () => {
        expect(makeVO({ name: 'a'.repeat(128) }).validate()).toBe(null)
    })
})

describe('UpdateTaskValueObject.validate 描述校验', () => {
    it('描述超长返回 DESC_TOO_LONG', () => {
        expect(makeVO({ description: 'a'.repeat(257) }).validate()).toBe(
            TaskErrorCode.DESC_TOO_LONG
        )
    })
})

describe('UpdateTaskValueObject.validate 枚举校验', () => {
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

describe('UpdateTaskValueObject.validate 时间校验', () => {
    it('非法提醒时刻格式返回 REMIND_TIME_FORMAT_INVALID', () => {
        expect(makeVO({ remindTime: '9:5' }).validate()).toBe(
            TaskErrorCode.REMIND_TIME_FORMAT_INVALID
        )
    })
    it('非法提醒时间返回 REMIND_AT_INVALID', () => {
        expect(makeVO({ remindAt: 'not-a-date' }).validate()).toBe(TaskErrorCode.REMIND_AT_INVALID)
    })
    // 开始/结束时间的合法性及先后关系已委托实体行为方法 updateSchedule 裁决，UpdateVO 不再校验
})

describe('UpdateTaskValueObject.validate 放弃时间校验', () => {
    it('非法放弃时间返回 GIVEN_UP_AT_INVALID', () => {
        expect(makeVO({ givenUpAt: 'not-a-date' }).validate()).toBe(
            TaskErrorCode.GIVEN_UP_AT_INVALID
        )
    })
    it('放弃时间早于开始时间返回 GIVEN_UP_BEFORE_START', () => {
        expect(
            makeVO({
                startAt: '2024-01-05T00:00:00.000Z',
                givenUpAt: '2024-01-01T00:00:00.000Z'
            }).validate()
        ).toBe(TaskErrorCode.GIVEN_UP_BEFORE_START)
    })
    it('放弃时间为空串时跳过校验', () => {
        expect(makeVO({ givenUpAt: '' }).validate()).toBe(null)
    })
    it('放弃时间为 null 时跳过校验', () => {
        expect(makeVO({ givenUpAt: null }).validate()).toBe(null)
    })
})

describe('UpdateTaskValueObject.validate 星标时间校验', () => {
    it('非法星标时间返回 STAR_MARK_AT_INVALID', () => {
        expect(makeVO({ starMarkAt: 'not-a-date' }).validate()).toBe(
            TaskErrorCode.STAR_MARK_AT_INVALID
        )
    })
    it('合法星标时间通过校验并标准化为 ISO', () => {
        const vo = makeVO({ starMarkAt: '2024-01-05T00:00:00.000Z' })
        expect(vo.validate()).toBe(null)
        expect(vo.starMarkAt).toBe('2024-01-05T00:00:00.000Z')
    })
    it('星标时间为空串时跳过校验', () => {
        expect(makeVO({ starMarkAt: '' }).validate()).toBe(null)
    })
    it('星标时间为 null 时跳过校验（取消收藏）', () => {
        expect(makeVO({ starMarkAt: null }).validate()).toBe(null)
    })
})