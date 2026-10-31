// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { VueWrapper } from '@vue/test-utils'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { t } from '@nao-todo/shared/locales'
import { cardNode, clickSegment, dragTaskTo, makeTask, mountKanban } from './t608-kanban-harness'

const message = vi.hoisted(() => ({
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
}))

// 真组件保留（看板链路要用），只接管消息提示
vi.mock('nue-ui', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>()
    return { ...actual, NueMessage: message }
})

/**
 * T608 AC5 —— 离线 / 只读态拖拽：沿用既有拦截与提示（PRD AC5 / R4）
 *
 * @description 既有拦截**不在 UI 层禁用**，而在写路径：仓储/usecase 返回错误码（不 reject）⇒
 *              `use-kanban.ts` 的 `notifyTaskError('task.updateFailed', err)` 弹出可见提示。
 *              ⇒ 断言「错误码路径必须产生一次可见提示」「卡片不能卡在 updating 态」
 *              「不得产生看起来成功的假象（无乐观写入）」。**不要**断言按钮/拖拽被禁用。
 *
 * 状态：
 *   - AC5①（状态分组离线）⇒ **绿**（回归护栏，锁既有行为）
 *   - AC5②（优先级分组离线）⇒ **红**（待接线；入口 + 写字段分支）
 */

let wrapper: VueWrapper | null = null

const OFFLINE_CODE = 'OFFLINE_READONLY: offline'

beforeEach(() => {
    Object.values(message).forEach((fn) => fn.mockClear())
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.clearAllMocks()
})

const messageText = (): string =>
    (message.error.mock.calls[0]?.[0] as string | undefined)?.replace(/\s+/g, '') ?? ''

/** 本地化前缀（`t('task.updateFailed')` 未插值时含 `{error}` 占位） */
const EXPECTED_PREFIX = t('task.updateFailed').replace('{error}', '').replace(/\s+/g, '')

describe('T608 AC5 · 离线/只读拖拽：有可见提示、无假成功、不卡更新态', () => {
    it('AC5① 状态分组离线拖拽 ⇒ 一次可见提示 + 卡片不卡 updating + 无乐观写入（回归护栏）', async () => {
        const tasks = [makeTask({ id: 't-todo', state: 'todo', priority: 'medium' })]
        const h = mountKanban(tasks, OFFLINE_CODE)
        wrapper = h.wrapper

        await dragTaskTo(h.wrapper, 't-todo', 'done')

        // ① 写路径被尝试且只尝试一次（不静默丢弃）
        expect(h.calls(), `实测写入 = ${JSON.stringify(h.calls())}`).toEqual([
            { taskId: 't-todo', payload: { state: 'done' } }
        ])
        // ② 有可见提示（不是「看着成功其实没写」）
        expect(message.error, '离线写失败必须弹可见提示').toHaveBeenCalledTimes(1)
        expect(message.error.mock.calls[0]?.[0]).toContain('更新任务失败')
        expect(messageText()).toContain(EXPECTED_PREFIX)
        // ③ 卡片不能卡在 updating 态（否则该卡片此后不可再拖）
        expect(
            cardNode(h.wrapper, 't-todo').classes(),
            `卡片 class 实测 = ${JSON.stringify(cardNode(h.wrapper, 't-todo').classes())}`
        ).not.toContain('todo-card--updating')
        // ④ 无乐观写入：props 里的 state 仍是原值
        expect((h.wrapper.props() as unknown as { tasks: TaskViewObject[] }).tasks[0]!.state).toBe(
            'todo'
        )
        // ⑤ 失败后仍可再次尝试（未并发放开的证据）
        await dragTaskTo(h.wrapper, 't-todo', 'done')
        expect(h.update, '失败后再次拖拽仍应发起写请求').toHaveBeenCalledTimes(2)
    })

    it('AC5② 优先级分组离线拖拽 ⇒ 同样沿用既有提示（不静默）', async () => {
        const h = mountKanban(
            [makeTask({ id: 't-mid', state: 'todo', priority: 'medium' })],
            OFFLINE_CODE
        )
        wrapper = h.wrapper

        await clickSegment(h.wrapper, 'priority')
        await dragTaskTo(h.wrapper, 't-mid', 'urgent')

        expect(h.calls()).toEqual([{ taskId: 't-mid', payload: { priority: 'urgent' } }])
        expect(message.error, '优先级分组下离线写失败同样必须提示').toHaveBeenCalledTimes(1)
        expect(cardNode(h.wrapper, 't-mid').classes()).not.toContain('todo-card--updating')
    })
})