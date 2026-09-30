// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { TaskViewObject } from '@nao-todo/domain-task'
import TaskBar from '../task-bar.vue'
import { nueUI } from '@/nue-ui-register'

/**
 * T447 任务条「圆角区分首尾」+ 接续末端动作收敛
 * @description 规则：**真实开始/结束端**圆角，**被截断（接续）端**直角。
 *  单段(contStart=false,contEnd=false)=两端圆角 · 首段(false,true)=左圆右直 ·
 *  中段(true,true)=两端直角 · 末段(true,false)=左直右圆。
 *  接续末端（contEnd=true）不渲染「改结束日期」动作（reschedule 触发器）。
 *  jsdom 不应用 SFC CSS ⇒ 圆角用源级样式断言（值 = 主题既有 `--nue-radius-sm`）。
 */

const task = {
    id: 't1',
    name: '跨周任务',
    state: 'todo',
    priority: 'low',
    startAt: '2026-10-05T09:00:00',
    endAt: '2026-10-13T18:00:00',
    createdAt: '2026-10-01T00:00:00',
    tags: []
} as unknown as TaskViewObject

const mountBar = (contStart = false, contEnd = false): VueWrapper =>
    mount(TaskBar, {
        props: {
            task,
            pos: { left: '0%', width: '14.28%', top: '0px' },
            contStart,
            contEnd
        },
        global: { plugins: [nueUI] }
    })

let wrapper: VueWrapper | null = null
afterEach(() => {
    wrapper?.unmount()
    wrapper = null
})

// —— 源级样式断言（jsdom 不应用 SFC CSS；与 daily-view.test.ts 同手法） ——
const RAW = import.meta.glob('../task-bar.vue', {
    query: '?raw',
    import: 'default',
    eager: true
}) as Record<string, string>
const styleText = (): string => Object.values(RAW).join('\n')
const cssRule = (css: string, selector: string): string => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = new RegExp(`${escaped}\\s*\\{`).exec(css)
    if (!match) return ''
    const start = match.index + match[0].length
    const end = css.indexOf('}', start)
    return end < 0 ? css.slice(start) : css.slice(start, end)
}

const classes = (): string[] => wrapper!.find('.cal-item').classes()

describe('T447 任务条圆角区分首尾', () => {
    it('单段（真实开始 + 真实结束）⇒ 两端圆角', () => {
        wrapper = mountBar(false, false)
        expect(classes()).toContain('is-start')
        expect(classes()).toContain('is-end')
    })

    it('首段（真实开始 + 续接末尾）⇒ 左圆右直', () => {
        wrapper = mountBar(false, true)
        expect(classes()).toContain('is-start')
        expect(classes()).not.toContain('is-end')
    })

    it('中段（承接 + 续接）⇒ 两端直角', () => {
        wrapper = mountBar(true, true)
        expect(classes()).not.toContain('is-start')
        expect(classes()).not.toContain('is-end')
    })

    it('末段（承接 + 真实结束）⇒ 左直右圆', () => {
        wrapper = mountBar(true, false)
        expect(classes()).not.toContain('is-start')
        expect(classes()).toContain('is-end')
    })

    it('圆角值复用主题 token `--nue-primary-radius`（6px），左/右分别绑定且互不覆盖', () => {
        const css = styleText()
        const start = cssRule(css, '.cal-item.is-start')
        const end = cssRule(css, '.cal-item.is-end')
        expect(start).toContain('border-top-left-radius: var(--nue-primary-radius)')
        expect(start).toContain('border-bottom-left-radius: var(--nue-primary-radius)')
        expect(end).toContain('border-top-right-radius: var(--nue-primary-radius)')
        expect(end).toContain('border-bottom-right-radius: var(--nue-primary-radius)')
    })

    it('左右留白：真实首/尾端内缩 `--cal-item-inset`，接续端紧贴（不改内缩）', () => {
        const css = styleText()
        // 基础几何改由 `--seg-*` 变量驱动（left/top/width）
        const base = cssRule(css, '.cal-item')
        expect(base).toContain('left: var(--seg-left)')
        expect(base).toContain('width: var(--seg-width)')
        expect(base).toContain('top: var(--seg-top)')
        expect(base).toContain('--cal-item-inset: 2px')
        // 真实开始端：左移一份；真实结束端：右缘内缩一份；单段：两侧各一份
        expect(cssRule(css, '.cal-item.is-start')).toContain(
            'left: calc(var(--seg-left) + var(--cal-item-inset))'
        )
        expect(cssRule(css, '.cal-item.is-start:not(.is-end)')).toContain(
            'width: calc(var(--seg-width) - var(--cal-item-inset))'
        )
        expect(cssRule(css, '.cal-item.is-end:not(.is-start)')).toContain(
            'width: calc(var(--seg-width) - var(--cal-item-inset))'
        )
        expect(cssRule(css, '.cal-item.is-start.is-end')).toContain(
            'width: calc(var(--seg-width) - 2 * var(--cal-item-inset))'
        )
    })

    it('DOM：几何以 CSS 变量（`--seg-left/width/top`）给出，不在行内直写 left/width', () => {
        wrapper = mountBar(false, false)
        const style = (wrapper.find('.cal-item').element as HTMLElement).style
        expect(style.getPropertyValue('--seg-left')).toBe('0%')
        expect(style.getPropertyValue('--seg-width')).toBe('14.28%')
        expect(style.getPropertyValue('--seg-top')).toBe('0px')
        expect(style.left).toBe('')
        expect(style.width).toBe('')
    })

    it('短横线标记已撤销：无 `.cal-cont` 标记与 `has-cont-*` 预留样式', () => {
        wrapper = mountBar(true, true)
        expect(wrapper.find('.cal-cont').exists()).toBe(false)
        const css = styleText()
        expect(css).not.toContain('.cal-cont')
        expect(css).not.toContain('has-cont-')
    })
})

describe('T447 接续末端不显示「改结束日期」动作', () => {
    it('contEnd=true（接续末端）⇒ 不渲染 reschedule 触发器（三点/时间）', () => {
        wrapper = mountBar(true, true)
        expect(wrapper.find('.cal-item-more').exists()).toBe(false)
    })

    it('contEnd=false（真实结束）⇒ 渲染 reschedule 触发器', () => {
        wrapper = mountBar(false, false)
        expect(wrapper.find('.cal-item-more').exists()).toBe(true)
    })

    it('渲染动作时任务名不受影响（无标记占位漂移）', () => {
        wrapper = mountBar(true, false)
        expect(wrapper.find('.cal-item-text').text()).toBe('跨周任务')
    })
})