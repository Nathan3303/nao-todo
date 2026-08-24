import { describe, expect, it, vi } from 'vite-plus/test'
import { reactive } from 'vue'
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