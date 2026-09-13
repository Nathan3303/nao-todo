// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { TASKS_VIEW_CONTEXT_KEY } from '@/views/index/tasks/context'
import useBuiltInProjectView from './built-in-project'

/**
 * SHELL-05 T5 / C-31 / C-32：离线（profile=null）内容视图就绪断言
 * @description 不得以 profile 为初始化前置；loading 有界；缺 viewType 自愈 table。
 *              依赖全部 mock（本组合式 DI 面较大，测试聚焦 initialize 终态语义）。
 */

const mocks = vi.hoisted(() => ({
    replace: vi.fn(),
    load: vi.fn(),
    loadResult: null as string | null,
    preferenceRef: { value: undefined as { viewType?: string } | undefined }
}))

vi.mock('vue-router', () => ({
    useRouter: () => ({
        currentRoute: { value: { params: { viewType: undefined } } },
        replace: mocks.replace
    })
}))

vi.mock('pinia', () => ({
    storeToRefs: (store: unknown) => store
}))

vi.mock('@/hooks', () => ({
    useBuiltInProjectUseCase: () => ({
        loadBuiltInProjectPreference: (...args: unknown[]) => {
            mocks.load(...args)
            mocks.preferenceRef.value = { viewType: 'table' }
            return mocks.loadResult
        }
    }),
    useTaskUseCase: () => ({})
}))

vi.mock('@nao-todo/presentation/task', () => ({ useTasksStore: () => ({}) }))

vi.mock('@nao-todo/presentation/built-in-project', () => ({
    BuiltInProjectHandler: class {
        constructor() {}
    },
    useBuiltInProjectsStore: () => ({
        builtInProjectPreference: mocks.preferenceRef,
        getBuiltInProject: () => undefined,
        getPreferenceGetTasksOption: () => undefined,
        setBuiltInProjectPreference: vi.fn()
    })
}))

vi.mock('@nao-todo/presentation/tag', () => ({
    useTagsStore: () => ({ tags: { value: new Map() } })
}))

// profile 恒 null：模拟离线（网络装饰数据缺失）
vi.mock('@nao-todo/presentation-identity', () => ({
    useUserStore: () => ({ profile: { value: null } })
}))

vi.mock('@nao-todo/shared', () => ({
    TASK_CREATOR_DIALOG_KEY: 'task-creator',
    unwrapError: (error: unknown) => String(error)
}))

vi.mock('nue-ui', () => ({
    NueMessage: { error: vi.fn() }
}))

const Harness = defineComponent({
    props: { projectId: { type: String, default: 'all' } },
    setup(props) {
        const { loading } = useBuiltInProjectView(props as never)
        return { loading }
    },
    template: '<div class="harness" :data-loading="String(loading)" />'
})

let wrapper: VueWrapper | null = null

const mountView = (): VueWrapper => {
    wrapper = mount(Harness, {
        global: {
            provide: {
                [TASKS_VIEW_CONTEXT_KEY as symbol]: {
                    appSubscriber: { subscribe: vi.fn(), unsubscribe: vi.fn() },
                    appDialogManager: { open: vi.fn() },
                    getColumnLabel: () => '',
                    getProjectName: () => '',
                    showTaskDetails: vi.fn()
                }
            }
        }
    })
    return wrapper
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.preferenceRef.value = undefined
    mocks.loadResult = null
    mocks.replace.mockResolvedValue(undefined)
    vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('useBuiltInProjectView - 离线就绪（profile=null）', () => {
    it('C-31/C-32：profile 缺失仍清 loading 且自愈默认 viewType=table', async () => {
        const view = mountView()
        await flushPromises()

        expect(mocks.load).toHaveBeenCalledWith('', 'all')
        expect(view.attributes('data-loading')).toBe('false')
        expect(mocks.replace).toHaveBeenCalledWith({
            name: 'tasks-built-in-project-main',
            params: { viewType: 'table' }
        })
    })

    it('C-31：偏好读取失败 ⇒ loading 仍退出（不永加载），不切视图', async () => {
        mocks.loadResult = '清单偏好获取失败'
        const view = mountView()
        await flushPromises()

        expect(view.attributes('data-loading')).toBe('false')
        expect(mocks.replace).not.toHaveBeenCalled()
    })

    it('C-31：切换视图抛错 ⇒ catch 记录且 loading 有界', async () => {
        mocks.replace.mockRejectedValueOnce(new Error('nav failed'))
        const view = mountView()
        await flushPromises()

        expect(view.attributes('data-loading')).toBe('false')
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('[SHELL-05]'),
            expect.objectContaining({ source: 'tasks:built-in-project:initialize' })
        )
    })
})