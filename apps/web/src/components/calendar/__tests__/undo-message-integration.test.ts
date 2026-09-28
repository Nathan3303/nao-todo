// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { nextTick } from 'vue'
import { closeScheduleUndo, presentScheduleUndo } from '../undo-message'
import type { ScheduleUndoAction } from '../monthly/reschedule'

/**
 * T362 真实库集成（唯一使用**真实** `NueMessage` 的用例文件）
 * @description 其余用例 mock `nue-ui` 以获得确定性的呈现契约断言；本文件补上「真库集成」这一环：
 *              撤销入口确实落在库的消息容器内（`.nue-message-node-inner`）、扩展区渲染出原生
 *              `<button>`、点击打通到 `undo`。
 *              注意：库把消息容器缓存在模块级 ref，清空 body 会留下游离 wrapper ⇒
 *              本文件**只放一个用例**且不清 body（vitest `isolate` 保证模块态按文件隔离）。
 */
afterEach(() => {
    closeScheduleUndo()
})

const makeAction = (): ScheduleUndoAction => ({
    text: '已调整时间',
    tone: 'success',
    snapshots: [{ id: 't1', prevStartAt: null, prevEndAt: '' }]
})

describe('T362 撤销入口 · 真实 NueMessage 集成', () => {
    it('消息容器内渲染文案与扩展区撤销按钮，点击触发 undo', async () => {
        const undo = vi.fn()
        presentScheduleUndo({ action: makeAction(), busy: () => false, undo, dismiss: vi.fn() })
        await nextTick()

        const node = document.querySelector('.nue-message-node-inner')
        expect(node, '撤销入口应落在库消息容器内').toBeTruthy()
        expect(node!.className).toContain('nue-message-node-inner--success')
        expect(node!.textContent).toContain('已调整时间')
        expect(node!.querySelector('.nue-message-node-inner__extension')).toBeTruthy()

        const button = document.querySelector<HTMLButtonElement>(
            '[data-testid="schedule-undo-action"]'
        )
        expect(button, '扩展区应渲染撤销按钮').toBeTruthy()
        expect(button!.tagName).toBe('BUTTON')
        expect(button!.textContent).toBe('撤销')

        button!.click()
        expect(undo).toHaveBeenCalledTimes(1)
    })
})