// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { computed, defineComponent, h, provide, ref } from 'vue'
import type { TaskViewObject } from '@nao-todo/domain-task'
import type { TaskDetailsContext, TaskDetailsPreContext } from '../context'
import { TASK_DETAILS_CONTEXT_KEY, TASK_DETAILS_PRE_CONTEXT_KEY } from '../context'
import useExportTask from '../use-export-task'

/**
 * T583 / DEF-84 导出文案（PRD `docs/prds/2026-10-30-priority-urgent.md` AC9 · `T582` 裁定 B）
 * @description 口径：导出单据的本地化文案中 `urgent` 必须写「紧急优先级」，
 *              **不得**落成「低优先级」（导出是对外文档，错标优先级 = 事实错误）。
 *              未覆盖：三格式差异与别语种 —— 属既有 `export-*.test.ts` 范围。
 */

const urgentTask = (): TaskViewObject =>
    ({
        id: 't-urgent',
        parentTaskId: null,
        name: '紧急任务',
        description: '',
        projectId: '',
        state: 'todo',
        priority: 'urgent',
        tags: [],
        startAt: null,
        endAt: null,
        archivedAt: null,
        starMarkAt: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
        deletedAt: null,
        givenUpAt: null,
        isStarMarked: false,
        isDeleted: false,
        isArchived: false,
        isGivenUp: false,
        remindAt: null,
        remindRepeat: 'none',
        remindTime: null,
        remindWeekdays: [],
        checkItemCount: 0,
        commentCount: 0,
        subtaskCount: 0,
        sortId: 0
    }) as unknown as TaskViewObject

/** 只填导出链路实际读到的字段，其余以最小替身占位（本用例不验证这些分支） */
const makeContexts = () => {
    const details = {
        vo: ref(urgentTask()),
        checkItems: computed(() => [])
    } as unknown as TaskDetailsContext
    const pre = {
        subTaskUseCase: {
            list: async () => [{ taskIds: [], pagination: { maxPage: 1 } }, null]
        },
        taskCheckItemUseCase: { listByTask: async () => [[], null] },
        getTag: () => undefined,
        getProjectName: () => ''
    } as unknown as TaskDetailsPreContext
    return { details, pre }
}

const mountHarness = () => {
    const { details, pre } = makeContexts()
    // 子组件才能 inject 父组件 provide ⇒ 两层：Provider 提供上下文，Harness 内部取用并 expose
    const Harness = defineComponent({
        name: 'ExportHarness',
        setup(_, { expose }) {
            const { startExport } = useExportTask()
            expose({ startExport })
            return () => h('div')
        }
    })
    const Provider = defineComponent({
        name: 'ExportProvider',
        setup() {
            provide(TASK_DETAILS_CONTEXT_KEY, details)
            provide(TASK_DETAILS_PRE_CONTEXT_KEY, pre)
            return () => h(Harness)
        }
    })
    return mount(Provider)
}

describe('T583 导出文案含「紧急」', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it('AC9：urgent 任务导出的优先级文案为「紧急优先级」，不含「低优先级」', async () => {
        const wrapper = mountHarness()
        // 等子组件挂载完成后再从 harness 取导出入口
        await wrapper.vm.$nextTick()
        const harness = wrapper.findComponent({ name: 'ExportHarness' })
        const startExport = (harness.vm as unknown as { startExport: () => Promise<string | null> })
            .startExport
        const markdown = await startExport()
        expect(markdown).toBeTruthy()
        expect(markdown!).toContain('紧急优先级')
        expect(markdown!).not.toContain('低优先级')
        wrapper.unmount()
    })
})