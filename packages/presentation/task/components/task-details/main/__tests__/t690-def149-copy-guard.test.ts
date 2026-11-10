// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { computed, nextTick, ref } from 'vue'
import { NueButton, NueContainer, NueDiv, NueEmpty, NueIcon, NueText } from 'nue-ui'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { TASK_DETAILS_CONTEXT_KEY } from '../../context'
import DetailsSubTasks from '../subtasks.vue'

/**
 * T690 / F3 —— `DEF-149` 刷新失败提示的**文案护栏**（永久）
 *
 * 背景：`t663-def145-editor-probe` 的契约变更只校验「含『刷新失败』」，未校验文案是否**说人话**。
 * 本文件补两条永久护栏（`T690` 批末复验 F3，PM 裁定「现在就落」）：
 * - 可见文案必须是面向用户的人话：**不含内部字段名 / 异常类名 / 裸错误码 / `Error:` 前缀**；
 * - 空原因（两态编码 `''`）走兜底句式，仍可见且同样不泄露内部信息。
 *
 * ⛔ 本文件只加护栏，不改 `t663` / 不改任何生产代码。
 */

const makeSubTask = (id: string): TaskViewObject =>
    ({
        id,
        name: `子任务 ${id}`,
        description: '',
        state: 'todo',
        priority: 'low',
        startAt: null,
        endAt: null,
        projectId: null,
        checkItemCount: 0,
        subtaskCount: 0
    }) as TaskViewObject

/** 内部标识/技术痕迹：渲染面出现任一即视为「不说人话」 */
const INTERNAL_TRACES = [
    'subTasksRefreshError',
    'subTasksError',
    'Error:',
    'TypeError',
    'RangeError',
    'ECONN',
    '[object Object]',
    'code:',
    'status:'
]

let wrapper: VueWrapper | null = null
afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

const mountArea = (options: {
    subTasks?: TaskViewObject[]
    subTasksError?: string
    refreshError?: string | null
}): VueWrapper => {
    const ctx = {
        subTasks: computed(() => options.subTasks ?? []),
        subTasksLoading: computed(() => false),
        subTasksError: computed(() => options.subTasksError ?? ''),
        subTasksRefreshError: computed(() =>
            options.refreshError === undefined ? null : options.refreshError
        ),
        retrySubTasks: vi.fn(async () => {}),
        switchTaskDetails: vi.fn(),
        subTaskHandler: { updateTaskState: vi.fn(async () => null) },
        createSubTask: vi.fn(async () => {}),
        resortSubTasks: vi.fn(async () => null),
        tags: ref([])
    }
    return mount(DetailsSubTasks, {
        global: {
            provide: { [TASK_DETAILS_CONTEXT_KEY]: ctx as never },
            components: { NueButton, NueContainer, NueDiv, NueEmpty, NueIcon, NueText },
            stubs: { 'task-tag-bar': true, 'input-button': true }
        }
    })
}

describe('T690 / F3：DEF-149 刷新失败提示的文案护栏', () => {
    it('带原因 ⇒ 人话句式 + 原因可见，且不泄露内部字段名/异常类名/裸错误码', async () => {
        wrapper = mountArea({
            subTasks: [makeSubTask('s1'), makeSubTask('s2')],
            refreshError: '网络错误'
        })
        await nextTick()

        const text = wrapper.text()
        // 说人话：完整句式（含「正在显示上次加载的内容」这一安抚说明）+ 原因
        expect(text).toContain('刷新失败')
        expect(text).toContain('网络错误')
        expect(text).toContain('正在显示上次加载的内容')
        // 不泄露内部信息（内部字段名 / 异常类名 / 裸码 / Error: 前缀）
        for (const trace of INTERNAL_TRACES) {
            expect(text, `渲染面不应出现技术痕迹「${trace}」`).not.toContain(trace)
        }
        // 内容未被破坏（本缺陷原报障点）
        expect(wrapper.findAll('.subtask-row').length).toBe(2)
        expect(wrapper.find('.subtask-row__create-bar').exists()).toBe(true)
    })

    it("空原因（两态 `''`）⇒ 走兜底句式仍可见，同样不泄露内部信息", async () => {
        wrapper = mountArea({ subTasks: [makeSubTask('s1')], refreshError: '' })
        await nextTick()

        const text = wrapper.text()
        expect(text).toContain('刷新失败')
        expect(text).toContain('正在显示上次加载的内容') // 兜底句（task.refreshFailedGeneric）
        for (const trace of INTERNAL_TRACES) {
            expect(text, `渲染面不应出现技术痕迹「${trace}」`).not.toContain(trace)
        }
        expect(wrapper.findAll('.subtask-row').length).toBe(1)
    })
})