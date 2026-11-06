// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, nextTick, ref } from 'vue'
import { useSubscriber } from '@nao-todo/shared/hooks'
import { RuleHint } from '@nao-todo/shared/components/rule-hint'
import { useTasksStore } from '@nao-todo/presentation/task'
import type { TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import { useCalendarTaskQuery } from '../use-calendar-task-query'

/**
 * `T664` / `DEF-148` 日历落点 —— 原地刷新失败**保留日历内容** + 非破坏性提示条
 *
 * @description 有快照时刷新失败 ⇒ 保留快照（不落错误分支、不清空网格），由提示条表达失败；
 *              下轮成功自动消除。无快照（首进即失败）仍落既有错误态。
 */

const SETTLE = async (): Promise<void> => {
    for (let i = 0; i < 8; i += 1) {
        await nextTick()
        await Promise.resolve()
        await new Promise((resolve) => setTimeout(resolve, 0))
    }
}

const makeTask = (id: string): TaskViewObject =>
    ({
        id,
        parentTaskId: '',
        name: id,
        description: '',
        state: 'todo',
        priority: 'medium',
        startAt: null,
        endAt: '2026-11-10T02:00:00.000Z',
        projectId: 'p1',
        tags: [],
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
        deletedAt: null,
        archivedAt: null,
        starMarkAt: null,
        givenUpAt: null,
        remindAt: null,
        remindRepeat: 'none',
        remindTime: null,
        remindWeekdays: [],
        isDeleted: false,
        isArchived: false,
        isStarMarked: false,
        isGivenUp: false
    }) as unknown as TaskViewObject

let mounted: VueWrapper[] = []
afterEach(() => {
    mounted.forEach((wrapper) => wrapper.unmount())
    mounted = []
    document.body.innerHTML = ''
})

const mountCalendar = (options: { failOnMount?: boolean } = {}) => {
    setActivePinia(createPinia())
    const tasksStore = useTasksStore()
    tasksStore.addTasks([makeTask('c1')])
    let fail = options.failOnMount === true
    const taskUseCase = {
        list: vi.fn(async () =>
            fail
                ? [null, '网络错误，请检查网络连接']
                : [
                      {
                          taskIds: ['c1'],
                          pagination: { total: 1, page: 1, limit: 100, maxPage: 1 }
                      },
                      null
                  ]
        )
    } as unknown as TaskUseCase
    const subscriber = useSubscriber()

    const Host = defineComponent({
        setup() {
            const api = useCalendarTaskQuery({ tasksStore, taskUseCase } as never)
            return {
                loading: api.loading,
                error: api.error,
                tasks: api.tasks,
                refreshError: api.refreshError
            }
        },
        template: `<div>
            <rule-hint v-if="refreshError" class="strip" variant="error" :content="'刷新失败：' + refreshError" />
            <div v-if="loading" class="cal-loading-marker">loading</div>
            <div v-else-if="error" class="cal-error-marker">error</div>
            <div v-else-if="tasks.length === 0" class="cal-empty-marker">empty</div>
            <div v-else class="cal-grid-marker">{{ tasks.length }}</div>
        </div>`
    })
    const wrapper = mount(Host, {
        components: { RuleHint } as never,
        global: {
            components: { RuleHint },
            provide: {
                [CALENDAR_VIEW_CONTEXT_KEY as symbol]: {
                    subscriber,
                    selectedProjectIds: ref<string[]>([]),
                    selectedTagIds: ref<string[]>([]),
                    hideCompleted: ref(false)
                }
            }
        }
    })
    mounted.push(wrapper)
    return {
        wrapper,
        subscriber,
        setFail: (next: boolean) => {
            fail = next
        }
    }
}

describe('T664 / DEF-148 · 日历刷新失败保留内容', () => {
    it('有内容 + 刷新失败 ⇒ 网格保留、提示条可见；下轮成功 ⇒ 提示条消失', async () => {
        const harness = mountCalendar()
        await SETTLE()
        expect(harness.wrapper.find('.cal-grid-marker').exists()).toBe(true)
        expect(harness.wrapper.findComponent(RuleHint).exists()).toBe(false)

        harness.setFail(true)
        harness.subscriber.emit('RefreshData' as never)
        await SETTLE()
        expect(harness.wrapper.find('.cal-grid-marker').exists(), '内容必须保留').toBe(true)
        expect(harness.wrapper.find('.cal-loading-marker').exists()).toBe(false)
        const strip = harness.wrapper.findComponent(RuleHint)
        expect(strip.exists(), '失败必须可见').toBe(true)
        expect(strip.text()).toContain('刷新失败')

        harness.setFail(false)
        harness.subscriber.emit('RefreshData' as never)
        await SETTLE()
        expect(harness.wrapper.findComponent(RuleHint).exists(), '成功必须清除提示条').toBe(false)
        expect(harness.wrapper.find('.cal-grid-marker').exists()).toBe(true)
    })

    it('首进即失败（无内容可保）⇒ 仍落既有错误态', async () => {
        const harness = mountCalendar({ failOnMount: true })
        await SETTLE()
        expect(harness.wrapper.find('.cal-error-marker').exists(), '首进失败必须落错误态').toBe(
            true
        )
        expect(harness.wrapper.find('.cal-grid-marker').exists()).toBe(false)
        expect(harness.wrapper.findComponent(RuleHint).exists(), '无内容时不用提示条').toBe(false)
    })
})