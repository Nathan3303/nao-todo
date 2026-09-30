// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { setLocale } from '@nao-todo/shared/locales'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { nueUI } from '@/nue-ui-register'
import CalendarAside from '../aside.vue'

/**
 * T445 ① 日历侧边栏顶部的子视图切换（侧栏显示态）
 * @description 侧栏显示时切换器落在 `CalendarAside` 顶部，点击走 `router.replace` 到对应子路由；
 *              侧栏隐藏时的头部兜底入口由 `view-switch.test.ts` + `day-nav-shortcut.test.ts` 覆盖。
 */

const buildViewContext = () => ({
    dialogManager: { open: () => {} },
    subscriber: { subscribe: () => {}, unsubscribe: () => {}, emit: () => {} },
    isDisplayAside: ref(true),
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

const buildIndexContext = () => ({
    appDialogManager: { open: () => {} },
    appSubscriber: { subscribe: () => {}, unsubscribe: () => {}, emit: () => {} },
    isDisplayAside: ref(true),
    isUseFloatAside: ref(false),
    switchDisplayAside: () => {},
    asideWidth: ref('0px'),
    handleResizeAside: () => {},
    setControllOption: () => {},
    isDisplayOutline: ref(false),
    isUseFloatOutline: ref(false),
    showTaskDetails: () => {},
    getProjectName: () => '',
    getTagColor: () => ''
})

const buildRouter = () => {
    const routes: RouteRecordRaw[] = [
        { path: '/', redirect: '/calendar/monthly' },
        {
            path: '/calendar',
            component: { template: '<router-view />' },
            children: [
                {
                    path: 'monthly/:taskId?',
                    name: 'calendar-monthly',
                    component: { template: '<div class="v-month" />' }
                },
                {
                    path: 'weekly/:taskId?',
                    name: 'calendar-weekly',
                    component: { template: '<div class="v-week" />' }
                },
                {
                    path: 'daily/:taskId?',
                    name: 'calendar-day',
                    component: { template: '<div class="v-day" />' }
                }
            ]
        }
    ]
    return createRouter({ history: createMemoryHistory(), routes })
}

let wrapper: VueWrapper | null = null
let slot: HTMLElement | null = null

beforeEach(() => {
    setLocale('zh-CN')
    slot = document.createElement('div')
    slot.id = 'SubPageAsideTeleportSlot'
    document.body.appendChild(slot)
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    slot?.remove()
    slot = null
    document.body.innerHTML = ''
    setLocale('zh-CN')
})

const mountAside = async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = buildRouter()
    await router.push({ name: 'calendar-monthly' })
    await router.isReady()
    const replaceSpy = vi.spyOn(router, 'replace')
    wrapper = mount(CalendarAside, {
        attachTo: document.body,
        global: {
            plugins: [pinia, nueUI, router],
            provide: {
                [CALENDAR_VIEW_CONTEXT_KEY as symbol]: buildViewContext(),
                [INDEX_VIEW_CONTEXT_KEY as symbol]: buildIndexContext()
            }
        }
    })
    await flushPromises()
    return { router, replaceSpy }
}

const teleportedButton = (mode: string): HTMLElement | null =>
    document.querySelector<HTMLElement>(
        `#SubPageAsideTeleportSlot [data-testid="calendar-view-${mode}"]`
    )

describe('T445 ① CalendarAside 顶部视图切换（侧栏显示态）', () => {
    it('侧栏顶部渲染三格切换，当前态为月视图高亮', async () => {
        await mountAside()
        expect(teleportedButton('month')).not.toBeNull()
        expect(teleportedButton('week')).not.toBeNull()
        expect(teleportedButton('day')).not.toBeNull()
        expect(teleportedButton('month')!.classList.contains('is-active')).toBe(true)
    })

    it('点击「周」⇒ router 切到 calendar-weekly；点击「日」⇒ calendar-day', async () => {
        const { router } = await mountAside()
        teleportedButton('week')!.click()
        await flushPromises()
        expect(router.currentRoute.value.name).toBe('calendar-weekly')

        teleportedButton('day')!.click()
        await flushPromises()
        expect(router.currentRoute.value.name).toBe('calendar-day')
    })

    it('英文环境渲染 Month/Week/Day', async () => {
        setLocale('en-US')
        await mountAside()
        expect(teleportedButton('month')!.textContent?.trim()).toBe('Month')
        expect(teleportedButton('week')!.textContent?.trim()).toBe('Week')
        expect(teleportedButton('day')!.textContent?.trim()).toBe('Day')
    })
})