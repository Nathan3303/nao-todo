// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent, ref } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import {
    NueButton,
    NueContainer,
    NueContent,
    NueDiv,
    NueDivider,
    NueHeader,
    NueMain,
    NueText
} from 'nue-ui'
import {
    grantOfflineEntry,
    isOfflineEntryGranted,
    revokeOfflineEntry
} from '@/views/auth/offline-entry'
import { SETTINGS_VIEW_CONTEXT_KEY } from '../../context'
import ProfileUpdater from '../index.vue'

/**
 * SHELL-05 G12/G14：离线登出与昵称占位
 * @description G12：远程登出失败仍本地登出 + 跳 signin + 清离线授权；
 *              G14：profile=null 时展示昵称缓存占位、不抛。
 */

const mocks = vi.hoisted(() => ({
    confirm: vi.fn(),
    signOut: vi.fn(),
    replace: vi.fn(),
    clearSession: vi.fn(),
    lock: vi.fn(),
    wipeUserData: vi.fn(async () => undefined),
    cachedNickname: '张三' as string | null
}))

vi.mock('nue-ui', async (importOriginal) => {
    const actual = await importOriginal<typeof import('nue-ui')>()
    return {
        ...actual,
        NueConfirm: mocks.confirm,
        NueMessage: { error: vi.fn(), success: vi.fn() }
    }
})

vi.mock('@nao-todo/infrastructure', () => ({
    readCachedNickname: () => mocks.cachedNickname,
    localSession: { clear: mocks.clearSession, getCurrentUserId: () => 'u-1' },
    cryptoService: { lock: mocks.lock },
    resolveUserIdFromStoredJwt: () => 'u-1',
    // C-54：无脏队列 ⇒ 护栏不弹窗，直接清库
    syncTracker: { countDirty: async () => 0 },
    syncService: { start: vi.fn(async () => ({ ok: true })) },
    deletionService: { wipeUserData: mocks.wipeUserData }
}))

vi.mock('vue-router', () => ({
    useRouter: () => ({
        replace: mocks.replace,
        resolve: (target: string) => ({ matched: [{}], fullPath: target }),
        currentRoute: { value: { params: {}, name: 'index' } }
    })
}))

/** 渲染默认插槽的桩（昵称块位于 avatar-updater 的 default slot 内） */
const SlotStub = defineComponent({
    name: 'SlotStub',
    template: '<div><slot /></div>'
})

let wrapper: VueWrapper | null = null

const mountView = (): VueWrapper => {
    wrapper = mount(ProfileUpdater, {
        global: {
            plugins: [createPinia()],
            provide: {
                [SETTINGS_VIEW_CONTEXT_KEY as symbol]: {
                    isDisplayAside: ref(false),
                    switchDisplayAside: vi.fn(),
                    userUseCase: {},
                    authUseCase: { signOut: mocks.signOut },
                    dialogManager: { close: vi.fn() }
                }
            },
            components: {
                'nue-container': NueContainer,
                'nue-header': NueHeader,
                'nue-main': NueMain,
                'nue-content': NueContent,
                'nue-div': NueDiv,
                'nue-text': NueText,
                'nue-button': NueButton,
                'nue-divider': NueDivider
            },
            stubs: {
                'user-avatar-updater': SlotStub,
                'user-nickname-updater': true,
                'user-info-viewer': true,
                'user-session-manager': true,
                'user-deactive-manager': true,
                'user-restore-dialog': true,
                'user-deactive-dialog': true
            }
        }
    })
    return wrapper
}

const clickSignOut = async (view: VueWrapper): Promise<void> => {
    const button = view.findAll('button').find((b) => b.text().includes('退出登录'))
    await button?.trigger('click')
    await flushPromises()
}

beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    revokeOfflineEntry()
    mocks.confirm.mockResolvedValue([false])
    mocks.signOut.mockResolvedValue(null)
    mocks.replace.mockResolvedValue(undefined)
    mocks.cachedNickname = '张三'
    vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('G12 - 离线可退出登录', () => {
    it('远程登出失败 ⇒ 仍本地登出 + 清离线授权 + 跳 signin', async () => {
        mocks.signOut.mockRejectedValue(new Error('offline'))
        grantOfflineEntry()

        const view = mountView()
        await flushPromises()
        await clickSignOut(view)

        expect(isOfflineEntryGranted()).toBe(false)
        expect(mocks.clearSession).toHaveBeenCalled()
        expect(mocks.lock).toHaveBeenCalled()
        expect(mocks.wipeUserData).toHaveBeenCalledWith('u-1')
        expect(mocks.replace).toHaveBeenCalledWith('/auth/signin')
    })

    it('用户取消确认 ⇒ 不登出、不导航', async () => {
        mocks.confirm.mockResolvedValue([true])
        grantOfflineEntry()
        const view = mountView()
        await flushPromises()

        await clickSignOut(view)

        expect(isOfflineEntryGranted()).toBe(true)
        expect(mocks.replace).not.toHaveBeenCalled()
    })
})

describe('G14 - 离线昵称占位', () => {
    it('profile=null ⇒ 展示昵称缓存占位 + 离线标签，不抛', async () => {
        mocks.cachedNickname = '张三'
        const view = mountView()
        await flushPromises()

        expect(view.text()).toContain('张三')
        expect(view.text()).toContain('离线')
    })

    it('profile=null 且无缓存 ⇒ 不渲染昵称、仍不抛', async () => {
        mocks.cachedNickname = null
        const view = mountView()
        await flushPromises()

        expect(view.text()).toContain('离线')
        expect(console.error).not.toHaveBeenCalled()
    })
})