import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { reactive } from 'vue'
import { NueMessage } from 'nue-ui'
import {
    ARCHIVED_READONLY_ERROR,
    TASK_ARCHIVE_WRITE_METHODS,
    resetArchiveGateForTest,
    withArchivedReadOnlyGuard
} from '../../../../archive-gate'
import { OFFLINE_READONLY_ERROR } from '../../../../../offline/write-gate'
import useTaskCreator from '../use-creator'
import type { TaskCreatorDialogProps } from '../types'

// useTaskCreator 内部调用 useRouter，注入 mock
vi.mock('vue-router', () => ({
    useRouter: () => ({ push: vi.fn(), currentRoute: { value: { name: 'mock' } } })
}))

const makeProps = () =>
    reactive({
        taskUseCase: {},
        subscriber: {},
        dialogManager: {},
        avaliableTags: [],
        avaliableProjects: []
    }) as unknown as TaskCreatorDialogProps

describe('useTaskCreator - avaliableProjects/avaliableTags 响应式读取', () => {
    it('初始为空数组', () => {
        const props = makeProps()
        const { avaliableProjects, avaliableTags } = useTaskCreator(props)
        expect(avaliableProjects.value).toEqual([])
        expect(avaliableTags.value).toEqual([])
    })

    it('props 更新后 computed 同步反映（非 setup 一次性快照）', () => {
        const props = makeProps()
        const { avaliableProjects, avaliableTags } = useTaskCreator(props)

        // 模拟兜底加载/主视图 init 填充 store 后父组件传入新数组引用
        props.avaliableProjects = [{ id: 'p1', name: '清单A' }] as never
        props.avaliableTags = [{ id: 't1', name: '标签A' }] as never

        expect(avaliableProjects.value).toHaveLength(1)
        expect(avaliableProjects.value[0]!.name).toBe('清单A')
        expect(avaliableTags.value).toHaveLength(1)
        expect(avaliableTags.value[0]!.name).toBe('标签A')
    })

    it('props 清空后 computed 同步为空', () => {
        const props = makeProps()
        const { avaliableProjects } = useTaskCreator(props)

        props.avaliableProjects = [{ id: 'p1', name: '清单A' }] as never
        expect(avaliableProjects.value).toHaveLength(1)

        props.avaliableProjects = [] as never
        expect(avaliableProjects.value).toEqual([])
    })
})

describe('T191 · 归档只读码在任务创建器静默（守卫已提示）', () => {
    afterEach(() => {
        resetArchiveGateForTest()
        vi.restoreAllMocks()
    })

    it('create 被守卫拦截 → 仅守卫 warn 1 条、无原始错误码', async () => {
        const warn = vi.spyOn(NueMessage, 'warn').mockImplementation(() => {})
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        resetArchiveGateForTest()
        const guarded = withArchivedReadOnlyGuard(
            { create: vi.fn(async () => [null, null]) } as unknown as object,
            TASK_ARCHIVE_WRITE_METHODS,
            { isArchivedTarget: async () => true }
        )
        const props = makeProps()
        ;(props as { taskUseCase: unknown }).taskUseCase = guarded
        const { states, handleCreateTask } = useTaskCreator(props)
        states.name = '新任务'

        const ok = await handleCreateTask()

        expect(ok).toBe(false)
        expect(warn).toHaveBeenCalledTimes(1)
        expect(error).not.toHaveBeenCalled()
        expect(warn.mock.calls.length + error.mock.calls.length).toBe(1) // 恰好 1 条
        expect(String(warn.mock.calls[0]?.[0] ?? '')).not.toContain(ARCHIVED_READONLY_ERROR)
    })

    it('其它错误码仍原样透出（防过度静默）', async () => {
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const props = makeProps()
        ;(props as { taskUseCase: unknown }).taskUseCase = {
            create: vi.fn(async () => [null, OFFLINE_READONLY_ERROR])
        }
        const { states, handleCreateTask } = useTaskCreator(props)
        states.name = '新任务'

        const ok = await handleCreateTask()

        expect(ok).toBe(false)
        expect(error).toHaveBeenCalledTimes(1)
        expect(String(error.mock.calls[0]?.[0] ?? '')).toContain(OFFLINE_READONLY_ERROR)
    })
})