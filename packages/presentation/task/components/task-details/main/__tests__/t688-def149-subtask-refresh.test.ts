// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { computed, ref } from 'vue'
import {
    NueButton,
    NueContainer,
    NueContent,
    NueDiv,
    NueEmpty,
    NueIcon,
    NueMain,
    NueText
} from 'nue-ui'
import { InputButton } from '@nao-todo/shared/components/input-button'
import { RuleHint } from '@nao-todo/shared/components/rule-hint'
import { t } from '@nao-todo/shared/locales'
import type { TaskTagViewObject, TaskViewObject } from '@nao-todo/domain-task'
import { TASK_DETAILS_CONTEXT_KEY } from '../../context'
import { TaskTagBar } from '../../../tag-bar'
import DetailsSubTasks from '../subtasks.vue'

/**
 * T688 / `DEF-149` —— **子任务区原地刷新失败 ⇒ 非破坏性提示条**
 *
 * 契约（与列表/表格/看板/日历同一套 `DEF-148`/`T665` 语义）：
 * - 刷新失败且**有已渲染行** ⇒ 只显示 `RuleHint` 提示条：**已渲染子任务行保留** +
 *   「新增子任务」输入框**不卸载**（用户正在输入被打断是原始报障）；
 * - 两态编码：`subTasksRefreshError === ''`（失败但无可读原因）⇒ **仍可见**，走兜底句式
 *   `task.refreshFailedGeneric`；`null` ⇒ 不显示；
 * - **首进即失败**（阻塞式 `subTasksError`）⇒ 仍走正常错误态（不得把真错误吞掉）。
 */

const makeSubTask = (overrides: Partial<TaskViewObject> = {}): TaskViewObject =>
    ({
        id: 'sub-1',
        name: '子任务 A',
        description: undefined,
        state: 'todo',
        priority: 'low',
        startAt: null,
        endAt: null,
        projectId: null,
        checkItemCount: 0,
        subtaskCount: 0,
        ...overrides
    }) as TaskViewObject

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.clearAllMocks()
})

interface MountOptions {
    subTasks?: TaskViewObject[]
    subTasksError?: string
    subTasksRefreshError?: string | null
}

const mountArea = (options: MountOptions = {}): VueWrapper => {
    const context = {
        subTasks: computed(() => options.subTasks ?? []),
        subTasksLoading: computed(() => false),
        subTasksError: computed(() => options.subTasksError ?? ''),
        subTasksRefreshError: computed(() =>
            options.subTasksRefreshError === undefined ? null : options.subTasksRefreshError
        ),
        retrySubTasks: vi.fn(async () => {}),
        switchTaskDetails: vi.fn(),
        subTaskHandler: { updateTaskState: vi.fn(async () => null) },
        createSubTask: vi.fn(async () => {}),
        resortSubTasks: vi.fn(async () => null),
        tags: ref<TaskTagViewObject[]>([])
    }
    wrapper = mount(DetailsSubTasks, {
        global: {
            components: {
                InputButton,
                RuleHint,
                TaskTagBar,
                'nue-button': NueButton,
                'nue-container': NueContainer,
                'nue-content': NueContent,
                'nue-div': NueDiv,
                'nue-empty': NueEmpty,
                'nue-icon': NueIcon,
                'nue-main': NueMain,
                'nue-text': NueText
            },
            provide: { [TASK_DETAILS_CONTEXT_KEY as symbol]: context },
            config: { warnHandler: () => {} }
        }
    })
    return wrapper
}

const rowsOf = (target: VueWrapper): number => target.findAll('.subtask-row').length

describe('T688 / DEF-149 刷新失败保留内容 + 输入框', () => {
    it('有已渲染行 + 刷新失败 ⇒ 提示条可见 + 行保留 + 「新增子任务」输入框仍在', () => {
        const area = mountArea({
            subTasks: [makeSubTask(), makeSubTask({ id: 'sub-2', name: '子任务 B' })],
            subTasksRefreshError: '网络异常'
        })

        const hint = area.find('.subtask-refresh-warning')
        expect(hint.exists()).toBe(true)
        expect(hint.text()).toContain(t('task.refreshFailed', { reason: '网络异常' }))
        // 内容不丢：两行都在
        expect(rowsOf(area)).toBe(2)
        // 输入框不卸载（原始报障）
        expect(area.find('.subtask-row__create-bar').exists()).toBe(true)
    })

    it('空原因（两态编码 `""`）⇒ 提示条**仍可见**且走兜底句式（不得静默）', () => {
        const area = mountArea({ subTasks: [makeSubTask()], subTasksRefreshError: '' })

        const hint = area.find('.subtask-refresh-warning')
        expect(hint.exists()).toBe(true)
        expect(hint.text()).toContain(t('task.refreshFailedGeneric'))
    })

    it('无刷新失败（null）⇒ 不渲染提示条', () => {
        const area = mountArea({ subTasks: [makeSubTask()], subTasksRefreshError: null })

        expect(area.find('.subtask-refresh-warning').exists()).toBe(false)
        expect(rowsOf(area)).toBe(1)
        expect(area.find('.subtask-row__create-bar').exists()).toBe(true)
    })

    it('首进即失败（阻塞式 subTasksError）⇒ 仍走正常错误态（不得吞真错误）', () => {
        const area = mountArea({ subTasks: [], subTasksError: '子任务获取失败：网络异常' })

        // 阻塞错误分支：无行、无输入框、有可见错误与重试
        expect(rowsOf(area)).toBe(0)
        expect(area.find('.subtask-row__create-bar').exists()).toBe(false)
        expect(area.text()).toContain('子任务获取失败：网络异常')
        expect(area.text()).toContain(t('common.retry'))
    })
})