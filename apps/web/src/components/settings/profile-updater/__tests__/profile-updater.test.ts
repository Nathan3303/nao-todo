// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent, ref } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
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
import { useUserStore } from '@nao-todo/presentation-identity'
import { t } from '@nao-todo/shared/locales'
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
    broadcastSignOut: vi.fn(),
    cachedNickname: '张三' as string | null
}))

vi.mock('@/views/auth/sign-out-broadcast', () => ({
    broadcastSignOut: mocks.broadcastSignOut
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

// T122：生产侧已改窄子路径导入 ⇒ 同步注册同名深路径 mock（转发上方 barrel mock，语义不变）
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/crypto/crypto-service',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/session/local-session',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/session/profile-cache',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/deletion/deletion-service',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-sync/sync-service',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-sync/sync-tracker',
    async () => import('@nao-todo/infrastructure')
)

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

const mountView = (pinia = createPinia()): VueWrapper => {
    wrapper = mount(ProfileUpdater, {
        global: {
            plugins: [pinia],
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
        expect(mocks.broadcastSignOut).toHaveBeenCalledWith('u-1')
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
        // C-54：护栏取消 ⇒ 不清库、不广播（广播不绕过护栏）
        expect(mocks.broadcastSignOut).not.toHaveBeenCalled()
    })
})

/**
 * T750 / Issue #360 · 身份区三行（AC2 / AC5 / AC9）
 * @description 头像右侧 = 昵称 / 邮箱 / `注册时间 {createdAt}`；「更多信息」分组删除
 *              （`settings.moreInfo` 键与 `user-info-viewer` 组件一并退役）。
 */
describe('T750 - 身份区三行 + 无「更多信息」', () => {
    /** 预置 profile 的挂载（同一 pinia ⇒ 组件读到真实现写入的 store） */
    const mountWithProfile = (patch: Record<string, unknown>): VueWrapper => {
        const pinia = createPinia()
        setActivePinia(pinia)
        useUserStore().setUserProfile(patch as never)
        return mountView(pinia)
    }

    it('profile 就绪 ⇒ 昵称 / 邮箱 / 注册时间 三行，且第三行带已格式化时间', async () => {
        const view = mountWithProfile({
            nickname: '张三',
            email: 'zhangsan@example.com',
            createdAt: '2026-01-02 03:04:05'
        })
        await flushPromises()

        const lines = view.findAll('.settings-profile__names > *').map((line) => line.text().trim())
        expect(lines).toEqual(['张三', 'zhangsan@example.com', '注册时间 2026-01-02 03:04:05'])
        expect(view.html()).not.toContain('info-viewer')
    })

    it('createdAt 缺失 ⇒ 第三行整行不渲染（不留空行 / 空标签）', async () => {
        const view = mountWithProfile({ nickname: '张三', email: 'zhangsan@example.com' })
        await flushPromises()

        const lines = view.findAll('.settings-profile__names > *').map((line) => line.text().trim())
        expect(lines).toEqual(['张三', 'zhangsan@example.com'])
        expect(view.text()).not.toContain(t('settings.registeredAt'))
    })

    it('「更多信息」分组不存在（文案与导出均退役）', async () => {
        const view = mountWithProfile({ nickname: '张三', createdAt: '2026-01-02 03:04:05' })
        await flushPromises()

        expect(view.text()).not.toContain('更多信息')
        expect(view.findAll('.settings-profile__field').length).toBe(1)
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