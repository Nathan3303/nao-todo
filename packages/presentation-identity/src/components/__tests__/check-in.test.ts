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

afterEach(async () => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    // 检入窗口是模块级全局态 ⇒ 用例间复位
    const window = await import('@nao-todo/shared/requester/checkin-window')
    window.resetCheckInWindow()
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

    it('T558 R3 挂载即开计划窗口（早于请求派发）；检入落定 / 卸载即关闭', async () => {
        mocks.routeName = 'auth-checkin'
        const window = await import('@nao-todo/shared/requester/checkin-window')
        window.resetCheckInWindow()

        const gate = mountCheckIn(async () => null)
        // 组件 setup 内、`checkIn()` 落定之前就已开窗 ⇒ 数据面并发的 10041 会被延后处置
        expect(window.isCheckInInFlight()).toBe(true)

        // 检入落定（成功）⇒ 关窗（此后到达的 10041 照旧处置，不再无脑延后）
        await flushPromises()
        expect(window.isCheckInInFlight()).toBe(false)

        // 卸载路径同样关窗（幂等）
        window.openCheckInPlan()
        gate.unmount()
        wrapper = null
        expect(window.isCheckInInFlight()).toBe(false)
    })

    it('T558 R1 检入冲突（10022）⇒ 显式可重试终态（重试 + 重新登录），不跳 signin、不弹凭证错误', async () => {
        mocks.routeName = 'auth-checkin'
        mocks.replace.mockClear()
        mocks.messageError.mockClear()
        const conflictError = Object.assign(new Error('检入失败'), {
            code: 10022,
            businessCode: 10022
        })
        mountCheckIn(async () => conflictError)
        await flushPromises()

        // 终态可辨：不是永久 loading，而是可重试失败态
        expect(document.body.textContent).toContain('验证未完成，请重试')
        expect(buttonsText()).toContain('重试')
        expect(buttonsText()).toContain('重新登录')
        expect(mocks.replace).not.toHaveBeenCalled()
        expect(mocks.messageError).not.toHaveBeenCalled()
    })

    it('T558 R1 检入冲突可重试：点「重试」再次发起检入', async () => {
        mocks.routeName = 'auth-checkin'
        const checkIn = vi.fn(async () =>
            Object.assign(new Error('检入失败'), { code: 10022, businessCode: 10022 })
        )
        mountCheckIn(checkIn)
        await flushPromises()
        expect(checkIn).toHaveBeenCalledTimes(1)
        clickButton('重试')
        await flushPromises()
        expect(checkIn).toHaveBeenCalledTimes(2)
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