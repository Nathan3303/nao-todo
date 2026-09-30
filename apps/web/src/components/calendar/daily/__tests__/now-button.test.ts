// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import dayjs from 'dayjs'
import { ref } from 'vue'
import { useTasksStore } from '@nao-todo/presentation/task'
import { setLocale, t } from '@nao-todo/shared/locales'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import { nueUI } from '@/nue-ui-register'
import DailyView from '../index.vue'
import { DAY_MINUTES } from '../day-zoom'

/**
 * T445 ② 「现在」入口组件级行为断言
 * @description 红→绿口径：点击「现在」= **日期回到今天** + **视口滚动到当前时间线**。
 *              jsdom 无布局 ⇒ 手动 stub `.day-body.clientWidth`（视口宽）与
 *              `.day-scroll.getBoundingClientRect()`（时间轴实宽），令 1px = 1 分钟。
 *              文案走 i18n（`calendar.now`）；旧硬编码「今天」在日视图不再出现。
 */

const buildContext = () => ({
    dialogManager: { open: () => {} },
    subscriber: { subscribe: () => {}, unsubscribe: () => {}, emit: () => {} },
    isDisplayAside: ref(false),
    isUseFloatAside: ref(false),
    switchDisplayAside: () => {},
    showTaskDetails: () => {},
    selectedProjectIds: ref<string[]>([]),
    selectedTagIds: ref<string[]>([]),
    hideCompleted: ref(false),
    weekStart: ref<'sunday' | 'monday'>('monday'),
    setWeekStart: () => {},
    pomodoroBadge: ref(true),
    setPomodoroBadge: () => {},
    clearFilter: () => {},
    applyScope: () => {}
})

const mountDaily = async (): Promise<VueWrapper> => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useTasksStore()
    const wrapper = mount(DailyView, {
        attachTo: document.body,
        global: {
            plugins: [pinia, nueUI],
            provide: { [CALENDAR_VIEW_CONTEXT_KEY as symbol]: buildContext() }
        }
    })
    await flushPromises()
    return wrapper
}

const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, min), max)

/** 当前时刻（分钟，0–1439） */
const nowMinutes = (): number => dayjs().hour() * 60 + dayjs().minute()

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    setLocale('zh-CN')
})

beforeEach(() => {
    setLocale('zh-CN')
})

describe('T445 ② 日视图「现在」入口', () => {
    it('i18n 键中英齐备：calendar.today = 今天/Today，calendar.now = 现在/Now', () => {
        setLocale('zh-CN')
        expect(t('calendar.today')).toBe('今天')
        expect(t('calendar.now')).toBe('现在')
        setLocale('en-US')
        expect(t('calendar.today')).toBe('Today')
        expect(t('calendar.now')).toBe('Now')
    })

    it('存在 i18n 文案「现在」，且旧硬编码「今天」不再出现', async () => {
        wrapper = await mountDaily()
        const texts = wrapper.findAll('button').map((b) => b.text().trim())
        expect(texts).toContain('现在')
        expect(texts).not.toContain('今天')
    })

    it('英文环境渲染「Now」', async () => {
        setLocale('en-US')
        wrapper = await mountDaily()
        const texts = wrapper.findAll('button').map((b) => b.text().trim())
        expect(texts).toContain('Now')
    })

    it('点击「现在」⇒ 日期回到今天 + 滚动到当前时间线', async () => {
        wrapper = await mountDaily()
        const w = wrapper

        // 1) stub 几何：视口 480px、时间轴实宽 = 1440px ⇒ 1px = 1 分钟
        const viewport = 480
        const axisWidth = DAY_MINUTES
        const body = w.find('.day-body').element as HTMLElement
        const scroll = w.find('.day-scroll').element as HTMLElement
        Object.defineProperty(body, 'clientWidth', { value: viewport, configurable: true })
        scroll.getBoundingClientRect = () =>
            ({
                width: axisWidth,
                left: 0,
                top: 0,
                height: 0,
                right: axisWidth,
                bottom: 0
            }) as DOMRect

        // 2) 先离开今天（否则「回到今天」无法区分）
        await w.find('[title="前一天"]').trigger('click')
        await flushPromises()
        expect(w.find('.day-title').text()).not.toBe(dayjs().format('YYYY 年 M 月 D 日'))

        // 3) 点「现在」
        const nowBtn = w.findAll('button').find((b) => b.text().trim() === '现在')!
        const expected = clamp(nowMinutes() - viewport / 2, 0, axisWidth - viewport)
        await nowBtn.trigger('click')
        await flushPromises()

        // 日期回到今天
        expect(w.find('.day-title').text()).toBe(dayjs().format('YYYY 年 M 月 D 日'))
        // 视口居中于当前时间线（±2 分钟容差，吸收分钟边界翻转）
        expect(Math.abs(body.scrollLeft - expected)).toBeLessThanOrEqual(2)
        // 非退化：确实发生了滚动
        expect(body.scrollLeft).toBeGreaterThan(0)
    })

    it('已是今天时再点「现在」仍重新居中（不依赖锚点变化）', async () => {
        wrapper = await mountDaily()
        const w = wrapper
        const viewport = 480
        const axisWidth = DAY_MINUTES
        const body = w.find('.day-body').element as HTMLElement
        const scroll = w.find('.day-scroll').element as HTMLElement
        Object.defineProperty(body, 'clientWidth', { value: viewport, configurable: true })
        scroll.getBoundingClientRect = () =>
            ({
                width: axisWidth,
                left: 0,
                top: 0,
                height: 0,
                right: axisWidth,
                bottom: 0
            }) as DOMRect

        body.scrollLeft = 0
        const nowBtn = w.findAll('button').find((b) => b.text().trim() === '现在')!
        await nowBtn.trigger('click')
        await flushPromises()

        const expected = clamp(nowMinutes() - viewport / 2, 0, axisWidth - viewport)
        expect(Math.abs(body.scrollLeft - expected)).toBeLessThanOrEqual(2)
    })
})