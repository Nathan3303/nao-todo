// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { NueButton, NueContainer, NueDiv, NueMain, NueText } from 'nue-ui'
import CheckIn from '../check-in.vue'

/**
 * 检入失败分支断言（SHELL-03 附录 B-3 / C-01/C-02/C-24）
 * @description ① 路由判据：已离开检入页 ⇒ 静默 return；② 网络类失败不跳 signin + 可重试；
 *              ③ 凭证类失败跳 signin；④ 成功 emit checkInSuccess（契约不变）。
 */

const mocks = vi.hoisted(() => ({
    replace: vi.fn(),
    messageError: vi.fn(),
    routeName: 'auth-checkin'
}))

vi.mock('vue-router', () => ({
    useRouter: () => ({ replace: mocks.replace }),
    useRoute: () => ({
        get name() {
            return mocks.routeName
        }
    })
}))

vi.mock('nue-ui', async (importOriginal) => {
    const actual = await importOriginal<typeof import('nue-ui')>()
    return { ...actual, NueMessage: { error: mocks.messageError } }
})

let wrapper: VueWrapper | null = null

const mountCheckIn = (checkIn: () => Promise<unknown>): VueWrapper => {
    wrapper = mount(CheckIn, {
        attachTo: document.body,
        props: {
            authUseCase: { checkIn } as never,
            loadingText: '正在验证用户凭据，请稍后 ...'
        },
        global: {
            components: {
                'nue-container': NueContainer,
                'nue-main': NueMain,
                'nue-div': NueDiv,
                'nue-text': NueText,
                'nue-button': NueButton
            }
        }
    })
    return wrapper
}

const buttonsText = (): string[] =>
    [...document.querySelectorAll('button')].map((b) => b.textContent?.trim() ?? '')

const clickButton = (label: string): void => {
    const target = [...document.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === label
    )
    target?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('AuthCheckIn - SHELL-03 失败分支', () => {
    it('成功 ⇒ emit checkInSuccess（契约不变），不跳转', async () => {
        mocks.routeName = 'auth-checkin'
        const gate = mountCheckIn(async () => null)
        await flushPromises()
        expect(gate.emitted('checkInSuccess')).toBeTruthy()
        expect(mocks.replace).not.toHaveBeenCalled()
    })

    it('B-3② 网络类失败 ⇒ 不跳 signin，改为可重试失败态（重试 + 重新登录）', async () => {
        mocks.routeName = 'auth-checkin'
        mocks.replace.mockClear()
        mountCheckIn(async () => '网络错误，请检查您的网络连接')
        await flushPromises()

        expect(mocks.replace).not.toHaveBeenCalled()
        expect(document.body.textContent).toContain('网络错误，请检查您的网络连接')
        expect(buttonsText()).toContain('重试')
        expect(buttonsText()).toContain('重新登录')
    })

    it('B-3② 网络类失败可重试：点「重试」再次调用 checkIn', async () => {
        mocks.routeName = 'auth-checkin'
        const checkIn = vi.fn(async () => '网络错误，请检查您的网络连接')
        mountCheckIn(checkIn)
        await flushPromises()
        expect(checkIn).toHaveBeenCalledTimes(1)
        clickButton('重试')
        await flushPromises()
        expect(checkIn).toHaveBeenCalledTimes(2)
    })

    it('B-3② 凭证类失败 ⇒ 保持跳 signin（并提示）', async () => {
        mocks.routeName = 'auth-checkin'
        mocks.replace.mockClear()
        mountCheckIn(async () => '登录已过期，请重新登录')
        await flushPromises()

        expect(mocks.messageError).toHaveBeenCalled()
        expect(mocks.replace).toHaveBeenCalledWith('/auth/signin')
    })

    it('B-3① 路由判据：已离开检入页 ⇒ 失败静默 return（不弹错、不跳转、无失败 UI）', async () => {
        mocks.routeName = 'index' // 用户已「离线进入」离开检入页
        mocks.replace.mockClear()
        mocks.messageError.mockClear()
        mountCheckIn(async () => '登录已过期，请重新登录')
        await flushPromises()

        expect(mocks.replace).not.toHaveBeenCalled()
        expect(mocks.messageError).not.toHaveBeenCalled()
        expect(buttonsText()).not.toContain('重试')
        expect(buttonsText()).not.toContain('重新登录')
    })
})