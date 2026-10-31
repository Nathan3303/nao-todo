// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'
import { resetAuthExpiryForTest } from '@nao-todo/shared/requester/auth-expiry'
import { handleSessionEnd } from '@/session-end'
import { useSettingsSignOut } from '@/components/settings/use-settings-sign-out'
import { SETTINGS_VIEW_CONTEXT_KEY } from '@/components/settings/context'

/**
 * T596 红基线 —— AC4 后半条：reason「登出即清」（主动退出登录 ≠ 会话失效）
 *
 * 判据：会话失效 ⇒ reason 留在 `sessionStorage`（刷新仍可读，见 `t596-w3-session-banner.test.ts`）；
 *      **用户主动退出登录** ⇒ reason 必须清除（下次进登录页不得显示上一次的失效横幅，R3 不误导）。
 *
 * 驱动的是**真实** `useSettingsSignOut().signOut()`（用户点「退出登录」的唯一实现），只在外部边界
 * 打桩：确认框（默认点取消以外的确认）、清库护栏（返回 true）、远程登出、广播、router。
 * 断言只看 `sessionStorage` 里是否还留有类别枚举 —— 不假设存储键名（与 W3 横幅用例同一口径）。
 *
 * 状态：**红**（reason 尚未落地，且登出路径未清它）。
 * 变异易感：登出路径不清理 ⇒ 本用例红（且实际产品会在下次登录页误报「已过期」）。
 */

const mocks = vi.hoisted(() => ({
    replace: vi.fn(async () => undefined),
    wipe: vi.fn(async () => true),
    broadcast: vi.fn(),
    signOut: vi.fn(async () => null),
    confirm: vi.fn(async () => [false, null] as [boolean, unknown]),
    messageSuccess: vi.fn(),
    messageError: vi.fn()
}))

vi.mock('vue-router', () => ({
    useRouter: () => ({ replace: mocks.replace, resolve: () => ({ matched: [{}], fullPath: '/' }) })
}))

vi.mock('nue-ui', async (importOriginal) => {
    const actual = await importOriginal<typeof import('nue-ui')>()
    return {
        ...actual,
        NueConfirm: mocks.confirm,
        NueMessage: { success: mocks.messageSuccess, error: mocks.messageError }
    }
})

vi.mock('@/views/auth/sign-out-wipe', () => ({
    wipeLocalDataOnSignOut: mocks.wipe
}))
vi.mock('@/views/auth/sign-out-broadcast', () => ({
    broadcastSignOut: mocks.broadcast
}))

const nowSeconds = (): number => Math.floor(Date.now() / 1000)

const makeJwt = (expSeconds: number): string => {
    const payload = { Id: '422644611870101504', exp: expSeconds, iss: 'NaoTodoServer' }
    const encoded = btoa(JSON.stringify(payload))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
    return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${encoded}.sig`
}

const ReasonHarness = defineComponent({
    name: 'T596ReasonHarness',
    setup() {
        const { signOut } = useSettingsSignOut()
        return { signOut }
    },
    template: '<button type="button" @click="signOut()">退出登录</button>'
})

let wrapper: VueWrapper | null = null

const sessionStorageValues = (): string[] => {
    const values: string[] = []
    for (let i = 0; i < sessionStorage.length; i += 1) {
        const key = sessionStorage.key(i)
        if (key) values.push(sessionStorage.getItem(key) ?? '')
    }
    return values
}

const reasonValues = (): string[] =>
    sessionStorageValues().filter((value) =>
        /expired|signed-in-elsewhere|credential-invalid/.test(value)
    )

const mountHarness = (): VueWrapper => {
    wrapper = mount(ReasonHarness, {
        attachTo: document.body,
        global: {
            plugins: [createPinia()],
            provide: {
                [SETTINGS_VIEW_CONTEXT_KEY as symbol]: {
                    authUseCase: { signOut: mocks.signOut },
                    userUseCase: {}
                } as never
            }
        }
    })
    return wrapper
}

beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    sessionStorage.clear()
    resetAuthExpiryForTest()
    mocks.replace.mockClear()
    mocks.wipe.mockClear()
    mocks.broadcast.mockClear()
    mocks.signOut.mockClear()
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    resetAuthExpiryForTest()
    vi.restoreAllMocks()
})

describe('AC4：主动退出登录 ⇒ reason 清除', () => {
    it('会话失效率先落 reason，用户主动「退出登录」后被清空', async () => {
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, makeJwt(nowSeconds() - 3600))
        await handleSessionEnd('expired', { router: { replace: mocks.replace } as never })
        await flushPromises()
        expect(reasonValues().length, '前置：失效后 reason 应可读').toBeGreaterThan(0)

        // 重新登录后再主动退出（模拟「失效 → 重登 → 用户自己点退出」）
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, makeJwt(nowSeconds() + 3600))
        mountHarness()
        document.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await flushPromises()

        expect(mocks.wipe, '前置：清库护栏放行').toHaveBeenCalledTimes(1)
        expect(mocks.replace, '登出后应回登录页').toHaveBeenCalledWith('/auth/signin')
        expect(
            reasonValues(),
            `主动登出必须清 reason（否则下次登录页误报上一次失效）；实测：${JSON.stringify(sessionStorageValues())}`
        ).toEqual([])
    })
})