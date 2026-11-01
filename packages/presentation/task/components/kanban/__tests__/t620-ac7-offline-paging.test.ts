// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { VueWrapper } from '@vue/test-utils'
import type { TaskViewObject } from '@nao-todo/domain-task'
import {
    columnNode,
    makeTask,
    mountKanban,
    scrollToBottom,
    settle,
    taskIdsIn
} from './t608-kanban-harness'

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
 * `T620` AC7 —— **离线反证**（PRD R-E / AC7）
 *
 * @description 分页必须走**本地仓储**（`taskUseCase.list` → 本地 Dexie）⇒ 「断网」时表现应与在线一致：
 *              照常翻页、**零网络请求**、**无错误提示**。用 `fetch` 桩做反证（不 mock 仓储）。
 *
 * 状态（`T620` 红基线，2026-11-01 HEAD `29cbe4c0` 实测）：AC7① ⇒ **红**
 *   （触底不翻页 ⇒ 45 条始终只有首屏那一份；离线与否无关）
 */

let wrapper: VueWrapper | null = null
const fetchMock = vi.fn(async () => {
    throw new TypeError('Failed to fetch（AC7：断网用例里不应出现任何网络请求）')
})

beforeEach(() => {
    Object.values(message).forEach((fn) => fn.mockClear())
    fetchMock.mockClear()
    vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    vi.clearAllMocks()
})

const pad = (value: number): string => String(value).padStart(2, '0')

const makeTodoTasks = (count: number): TaskViewObject[] =>
    Array.from({ length: count }, (_, index) =>
        makeTask({ id: `todo-${pad(index + 1)}`, state: 'todo', priority: 'medium' })
    )

describe('T620 AC7 · 离线（无网络）下照常翻页', () => {
    it('AC7① 断网时触底照常翻页（20 → 40 → 45），且零 `fetch`、零错误提示', async () => {
        const h = mountKanban(makeTodoTasks(45))
        wrapper = h.wrapper
        await settle()

        expect(taskIdsIn(columnNode(h.wrapper, 'todo')), '首屏第 1 页').toHaveLength(20)
        await scrollToBottom(h.wrapper, 'todo')
        await scrollToBottom(h.wrapper, 'todo')

        expect(
            taskIdsIn(columnNode(h.wrapper, 'todo')),
            '离线不应影响本地分页：应加载完 45 条'
        ).toHaveLength(45)
        expect(fetchMock, '分页不得产生任何网络请求（本地优先 R-E）').not.toHaveBeenCalled()
        expect(message.error, '离线翻页不得弹错误提示').not.toHaveBeenCalled()

        const text = (columnNode(h.wrapper, 'todo').element.textContent ?? '').replace(/\s+/g, '')
        expect(text, `列内不得出现加载失败文案；实测「${text}」`).not.toContain('加载失败')
    })
})