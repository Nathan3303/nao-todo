import { describe, expect, it } from 'vite-plus/test'
import dayjs from 'dayjs'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { isTaskOverdue } from './overdue'

/**
 * 逾期判定纯逻辑（天级口径）
 * @description endAt < 今日 0 点且未完成；done / 无 endAt / 非法 endAt 一律不判逾期。
 */
const makeTask = (overrides: Partial<TaskViewObject> = {}): TaskViewObject =>
    ({
        id: 't1',
        name: '任务',
        state: 'todo',
        priority: 'low',
        startAt: null,
        endAt: '',
        createdAt: '2026-10-01T00:00:00',
        ...overrides
    }) as unknown as TaskViewObject

describe('isTaskOverdue - 天级逾期口径', () => {
    it('endAt 早于今日 0 点且未完成 → 逾期', () => {
        const yesterday = dayjs().subtract(1, 'day').startOf('day').toISOString()
        expect(isTaskOverdue(makeTask({ endAt: yesterday }))).toBe(true)
    })

    it('今日内/未来 endAt → 不逾期', () => {
        const now = new Date().toISOString()
        const tomorrow = dayjs().add(1, 'day').toISOString()
        expect(isTaskOverdue(makeTask({ endAt: now }))).toBe(false)
        expect(isTaskOverdue(makeTask({ endAt: tomorrow }))).toBe(false)
    })

    it('已完成（done）即使 endAt 已过 → 不逾期', () => {
        const yesterday = dayjs().subtract(1, 'day').startOf('day').toISOString()
        expect(isTaskOverdue(makeTask({ state: 'done', endAt: yesterday }))).toBe(false)
    })

    it('endAt 为空/非法 → 不逾期', () => {
        expect(isTaskOverdue(makeTask({ endAt: '' }))).toBe(false)
        expect(isTaskOverdue(makeTask({ endAt: 'not-a-date' }))).toBe(false)
    })
})