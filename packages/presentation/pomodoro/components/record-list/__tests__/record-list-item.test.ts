// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { PomodoroRecordViewObject } from '@nao-todo/domain-pomodoro'
import RecordListItem from '../record-list-item.vue'

/**
 * T456 ② 侧栏记录条目紧凑态（additive：默认不变）
 * @description `compact=true` ⇒ 标题两行（任务/元信息各一行）+ 字号 `--nue-text-xs`；
 *              `compact` 默认 false ⇒ 观感与既有（常用专注页）一致。
 */

const record = {
    id: 'r1',
    type: 1,
    startAt: '2026-10-01T09:00:00',
    duration: 1500,
    pomodoroId: '',
    taskName: '任务 A',
    note: '笔记'
} as unknown as PomodoroRecordViewObject

beforeEach(() => setActivePinia(createPinia()))

const mountItem = (compact: boolean) =>
    mount(RecordListItem, { props: { record, ...(compact ? { compact: true } : {}) } })

describe('T456 ② 记录条目紧凑态', () => {
    it('默认（未传 compact）⇒ 无 is-compact 类（默认观感不变）', () => {
        const w = mountItem(false)
        expect(w.find('.is-compact').exists()).toBe(false)
        w.unmount()
    })

    it('compact=true ⇒ 根节点带 is-compact 类', () => {
        const w = mountItem(true)
        expect(w.find('[data-has-note="true"]').classes()).toContain('is-compact')
        w.unmount()
    })

    it('源级：紧凑态为两行（title-and-duration 列向）+ 字号 xs + note 对比度达标色', () => {
        const css = Object.values(
            import.meta.glob('../record-list-item.vue', {
                query: '?raw',
                import: 'default',
                eager: true
            }) as Record<string, string>
        ).join('\n')
        const flat = css.replace(/\s+/g, ' ')
        expect(flat).toContain('&.is-compact')
        expect(flat).toContain('flex-direction: column')
        expect(flat).toContain('font-size: var(--nue-text-xs)')
        // note 由 color-500（<4.5:1）改 color-600（达标）
        expect(flat).toContain('color: var(--nue-primary-color-600)')
    })
})