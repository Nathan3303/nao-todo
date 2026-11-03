// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import { t } from '@nao-todo/shared/locales'
import date2RelativeDate from '@nao-todo/shared/utils/relative-date-parser'
import { formatConflictValue, isUnsetValue } from '../conflict-value-format'

/**
 * DEF-133 —— 冲突值格式化层（纯函数）
 * 覆盖：① 空值 ⇒「未设置」② tags/projectId 引用类 ③ 枚举复用既有 i18n
 * ④ 日期本地化 ⑤ 布尔 / 星期数组 ⑥ 未知值不崩、原样返回。
 */

const tagName = (id: string): string | undefined => ({ t1: '工作', t2: '生活' })[id as 't1' | 't2']

describe('DEF-133 冲突值格式化', () => {
    it('空值（null / undefined / "" / []）⇒「未设置」，不空白', () => {
        for (const value of [null, undefined, '', []]) {
            expect(isUnsetValue(value)).toBe(true)
            expect(formatConflictValue('name', value)).toBe(t('sync.conflict.value.unset'))
        }
        expect(isUnsetValue('未设置')).toBe(false)
        expect(isUnsetValue(['a'])).toBe(false)
    })

    it('tags ⇒ 标签名称列表（查不到 ⇒「未知标签」，不崩）', () => {
        expect(formatConflictValue('tags', ['t1', 't2'], { tagName })).toBe('工作、生活')
        expect(formatConflictValue('tags', ['t1', 'gone'], { tagName })).toBe('工作、未知标签')
        expect(formatConflictValue('tags', ['t1'])).toBe('未知标签')
    })

    it('projectId ⇒ 清单名 / 收集箱 / 未知清单', () => {
        expect(formatConflictValue('projectId', 'p1', { projectName: () => '学习' })).toBe('学习')
        expect(formatConflictValue('projectId', 'inbox')).toBe(t('sync.conflict.value.inbox'))
        expect(formatConflictValue('projectId', 'p-gone')).toBe(
            t('sync.conflict.value.unknownProject')
        )
        // 空串 ⇒「未选择清单」（清单字段特有语义）；其余空值口径不变
        expect(formatConflictValue('projectId', '')).toBe(t('sync.conflict.value.noProject'))
        expect(formatConflictValue('projectId', null)).toBe(t('sync.conflict.value.unset'))
    })

    it('state / priority / remindRepeat ⇒ 既有 i18n 标签（禁裸枚举）', () => {
        expect(formatConflictValue('state', 'todo')).toBe(t('task.state.todo'))
        expect(formatConflictValue('state', 'in-progress')).toBe(t('task.state.inProgress'))
        expect(formatConflictValue('state', 'done')).toBe(t('task.state.done'))
        expect(formatConflictValue('priority', 'high')).toBe(t('task.priority.high'))
        expect(formatConflictValue('priority', 'none')).toBe(t('task.priority.none'))
        expect(formatConflictValue('remindRepeat', 'daily')).toBe(
            t('sync.conflict.value.remindRepeat.daily')
        )
        expect(formatConflictValue('remindRepeat', 'weekly')).toBe(
            t('sync.conflict.value.remindRepeat.weekly')
        )
    })

    it('日期字段 ⇒ 复用既有相对日期工具；无效日期原样返回', () => {
        const iso = '2024-03-05T09:30:00.000Z'
        expect(formatConflictValue('startAt', iso)).toBe(date2RelativeDate(iso)[0])
        expect(formatConflictValue('updatedAt', 'not-a-date')).toBe('not-a-date')
        // 非日期字段不误判
        expect(formatConflictValue('remindTime', '09:30')).toBe('09:30')
    })

    it('布尔 ⇒ 是 / 否', () => {
        expect(formatConflictValue('isDone', true)).toBe(t('sync.conflict.value.yes'))
        expect(formatConflictValue('isDone', false)).toBe(t('sync.conflict.value.no'))
    })

    it('remindWeekdays / 普通数组 ⇒ 可读列表', () => {
        expect(formatConflictValue('remindWeekdays', [1, 7])).toBe('周一、周日')
        expect(formatConflictValue('remindWeekdays', [1, 2, 3])).toBe('周一、周二、周三')
        expect(formatConflictValue('something', ['甲', '乙'])).toBe('甲、乙')
    })

    it('未知枚举 / 未知结构 ⇒ 原样返回，不崩', () => {
        expect(formatConflictValue('state', 'weird')).toBe('weird')
        expect(formatConflictValue('priority', 'p9')).toBe('p9')
        expect(formatConflictValue('name', 42)).toBe('42')
        expect(formatConflictValue('name', { a: 1 })).toBe('{"a":1}')
    })
})