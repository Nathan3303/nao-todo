// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'

/**
 * T451 ② 详情面板「同 taskId 不重新初始化」
 * @description details.vue：watch(() => props.taskId, initialize, { immediate: true })
 *              ⇒ taskId 值不变则不重复 initialize（配合 adapter 的 route.params.taskId 稳定 ⇒ 面板不重置）。
 *              这里 mock 掉 useTaskDetails（避免真实 stores），只观测 initialize 调用次数。
 */
const hoisted = vi.hoisted(() => ({ initialize: vi.fn(async () => null) }))

vi.mock('@nao-todo/presentation/task/components/task-details/task-details', () => ({
    default: () => ({
        loading: ref(false),
        error: ref(''),
        task: ref(null),
        initialize: hoisted.initialize
    })
}))

import { TaskDetails } from '@nao-todo/presentation/task'

const mountDetails = (taskId?: string) =>
    mount(TaskDetails, { props: { taskId }, global: { config: { warnHandler: () => {} } } })

describe('T451 ② details.vue：同 taskId 不重复初始化', () => {
    it('挂载即初始化一次；taskId 不变（同值复写）不重复 initialize', async () => {
        const w = mountDetails('abc')
        await flushPromises()
        expect(hoisted.initialize).toHaveBeenCalledTimes(1)
        expect(hoisted.initialize).toHaveBeenCalledWith('abc')

        await w.setProps({ taskId: 'abc' })
        await flushPromises()
        expect(hoisted.initialize).toHaveBeenCalledTimes(1)
        w.unmount()
    })

    it('taskId 变化 ⇒ 才重新 initialize', async () => {
        hoisted.initialize.mockClear()
        const w = mountDetails('abc')
        await flushPromises()
        expect(hoisted.initialize).toHaveBeenCalledTimes(1)
        await w.setProps({ taskId: 'xyz' })
        await flushPromises()
        expect(hoisted.initialize).toHaveBeenCalledTimes(2)
        expect(hoisted.initialize).toHaveBeenLastCalledWith('xyz')
        w.unmount()
    })
})