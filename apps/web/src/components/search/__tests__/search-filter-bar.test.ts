// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { setLocale } from '@nao-todo/shared/locales'
import { InnerDropdownOption } from '@nao-todo/shared/components/inner-dropdown'
import type { ProjectViewObject } from '@nao-todo/domain-project'
import type { TagViewObject } from '@nao-todo/domain-tag'
import { useProjectsStore } from '@nao-todo/presentation/project'
import { useTagsStore } from '@nao-todo/presentation/tag'
import { nueUI } from '@/nue-ui-register'
import SearchFilterBar from '../search-filter-bar.vue'

/**
 * T505 搜索筛选栏四项细化（Issue #181）
 * 依据：`docs/prds/2026-10-07-search-filter-bar-refinement.md` §7
 *
 * 覆盖：① 不再有 excluded 开关 · ② 归档开关可见标签 + role/aria-checked/键盘/点文字 ·
 *       ③ 下拉项间隙全局契约（静态读 CSS）· ④ 触发器已选名称（1/2/≥3 + 色点 + 折叠）·
 *       AC7 负向：切换归档不触发其它事件。
 * jsdom 不可测（留给用户视觉走查）：实际像素宽度 / 省略号渲染 / 跨页面对照。
 */

/** CSS / SFC 源码（`?raw`，与既有样式契约测试同法） */
const themeModules = import.meta.glob('/apps/web/src/themes/dropdown.css', {
    query: '?raw',
    import: 'default',
    eager: true
}) as Record<string, string>
const barModules = import.meta.glob('/apps/web/src/components/search/search-filter-bar.vue', {
    query: '?raw',
    import: 'default',
    eager: true
}) as Record<string, string>
const dropdownCss = themeModules['/apps/web/src/themes/dropdown.css'] ?? ''
const barSource = barModules['/apps/web/src/components/search/search-filter-bar.vue'] ?? ''

const makeProject = (id: string, name: string, sortId: number): ProjectViewObject =>
    ({ id, name, sortId, isArchived: false, isDeleted: false }) as unknown as ProjectViewObject

const makeTag = (id: string, name: string, color: string): TagViewObject =>
    ({ id, name, color }) as unknown as TagViewObject

type BarProps = {
    selectedProjectIds?: string[]
    selectedTagIds?: string[]
    selectedPriorities?: string[]
    selectedStates?: string[]
    active?: boolean
    includeArchived?: boolean
    canSave?: boolean
}

let pinia: Pinia
let wrapper: VueWrapper | null = null

const mountBar = (props: BarProps = {}): VueWrapper => {
    wrapper = mount(SearchFilterBar, {
        global: { plugins: [nueUI, pinia] },
        props: {
            selectedProjectIds: [],
            selectedTagIds: [],
            selectedPriorities: [],
            selectedStates: [],
            active: false,
            includeArchived: false,
            canSave: false,
            ...props
        }
    })
    return wrapper
}

/** 触发器顺序：清单 / 标签 / 优先级 / 状态 */
const TRIGGER = { project: 0, tag: 1, priority: 2, state: 3 } as const

const triggerText = (index: number): string => wrapper!.findAll('.filter-trigger')[index]!.text()

beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    useProjectsStore().setProjects([makeProject('p1', '工作', 1), makeProject('p2', '生活', 2)])
    useTagsStore().setTags([
        makeTag('t1', '紧急', 'rgb(240, 0, 0)'),
        makeTag('t2', '重要', 'rgb(0, 160, 0)')
    ])
    setLocale('zh-CN')
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
})

describe('T505 ① 已移除 excluded 开关', () => {
    it('筛选栏不再渲染 excluded 开关（仅剩归档一个开关）', () => {
        mountBar()
        expect(wrapper!.findAll('.search-filter-bar__excluded')).toHaveLength(0)
        expect(wrapper!.findAll('.nue-switch')).toHaveLength(1)
        expect(wrapper!.find('.search-filter-bar__archived').exists()).toBe(true)
    })
})

describe('T505 ② 归档开关可见标签与无障碍', () => {
    it('开关右侧有可见文字「包含已归档」（兄弟元素，NueSwitch 忽略默认插槽）', () => {
        mountBar()
        const label = wrapper!.find('.search-filter-bar__archived-label')
        expect(label.exists()).toBe(true)
        expect(label.text()).toBe('包含已归档')
        expect(label.element.previousElementSibling?.classList.contains('nue-switch')).toBe(true)
    })

    it('role=switch / tabindex 可聚焦 / aria-checked 随态翻转', async () => {
        mountBar({ includeArchived: false })
        const sw = wrapper!.find('.search-filter-bar__archived [role="switch"]')
        expect(sw.exists()).toBe(true)
        expect(sw.attributes('aria-checked')).toBe('false')
        expect(sw.attributes('tabindex')).toBe('0')

        await wrapper!.setProps({ includeArchived: true })
        expect(
            wrapper!.find('.search-filter-bar__archived [role="switch"]').attributes('aria-checked')
        ).toBe('true')
    })

    it('Enter / Space 可切换，点文字也可切换（均上抛 toggleArchived）', async () => {
        mountBar({ includeArchived: false })
        const sw = wrapper!.find('.search-filter-bar__archived [role="switch"]')
        await sw.trigger('keydown', { key: 'Enter' })
        expect(wrapper!.emitted('toggleArchived')?.[0]).toEqual([true])
        await sw.trigger('keydown', { key: ' ' })
        expect(wrapper!.emitted('toggleArchived')?.[1]).toEqual([true])
        await wrapper!.find('.search-filter-bar__archived-label').trigger('click')
        expect(wrapper!.emitted('toggleArchived')?.[2]).toEqual([true])
    })
})

describe('T505 ③ 下拉项间隙（全局契约，静态读 CSS）', () => {
    it('dropdown.css 的 --menu 分块 gap 收紧为 --nue-gap-2xs，保留 padding: 0', () => {
        const menuBlock = dropdownCss.slice(dropdownCss.indexOf('.nue-dropdown--menu'))
        expect(menuBlock).toContain('gap: var(--nue-gap-2xs)')
        expect(menuBlock).toContain('padding: 0')
        expect(menuBlock).not.toContain('--nue-gap-xs')
    })
})

describe('T505 ④ 触发器显示已选名称', () => {
    it('未选时只显示维度名', () => {
        mountBar()
        expect(triggerText(TRIGGER.priority)).toBe('优先级')
        expect(triggerText(TRIGGER.project)).toBe('清单')
    })

    it('1 项：维度名 + 名称', () => {
        mountBar({ selectedStates: ['todo'] })
        expect(triggerText(TRIGGER.state)).toBe('状态 待办')
    })

    it('2 项：全显，且按各维度选项顺序（todo → in-progress → done）', () => {
        mountBar({ selectedStates: ['in-progress', 'todo'] })
        expect(triggerText(TRIGGER.state)).toBe('状态 待办、正在进行')
    })

    it('≥3 项：前 2 项 + 「+N」', () => {
        mountBar({ selectedStates: ['done', 'todo', 'in-progress'] })
        expect(triggerText(TRIGGER.state)).toBe('状态 待办、正在进行 +1')
    })

    it('优先级用短名：1 项 / ≥3 项（触发器专用）', async () => {
        mountBar({ selectedPriorities: ['high'] })
        expect(triggerText(TRIGGER.priority)).toBe('优先级 高')
        await wrapper!.setProps({ selectedPriorities: ['high', 'medium', 'low'] })
        expect(triggerText(TRIGGER.priority)).toBe('优先级 低、中 +1')
    })

    it('锁：优先级下拉面板项仍用长名（短名未污染全局）', async () => {
        mountBar()
        await wrapper!.findAll('.filter-trigger')[TRIGGER.priority]!.trigger('click')
        await nextTick()
        const titles = wrapper!
            .findAllComponents(InnerDropdownOption)
            .map((option) => option.props('title'))
        expect(titles).toContain('高优先级')
        expect(titles).toContain('中优先级')
        expect(titles).toContain('低优先级')
        expect(titles).not.toContain('高')
    })

    it('清单名称本地解析（含收件箱哨兵）', () => {
        mountBar({ selectedProjectIds: ['', 'p2'] })
        expect(triggerText(TRIGGER.project)).toBe('清单 收集箱、生活')
    })

    it('标签项带色点（用户数据色，非色值令牌）', () => {
        mountBar({ selectedTagIds: ['t1'] })
        expect(triggerText(TRIGGER.tag)).toBe('标签 紧急')
        const tagTrigger = wrapper!.findAll('.filter-trigger')[TRIGGER.tag]!
        const dot = tagTrigger.find('.filter-trigger-label__dot')
        expect(dot.exists()).toBe(true)
        expect(dot.attributes('style')).toContain('background')
    })

    it('AC6：超宽折叠 + 触发器最大宽度 / 内部文本可收缩省略（源码契约）', () => {
        mountBar({ selectedProjectIds: ['', 'p1', 'p2'] })
        expect(triggerText(TRIGGER.project)).toBe('清单 收集箱、工作 +1')
        expect(barSource).toMatch(/\.filter-trigger\s*\{[^}]*max-width/m)
        expect(barSource).toMatch(
            /\.filter-trigger :deep\(\.nue-button__text\)\s*\{[^}]*min-width:\s*0/m
        )
    })
})

describe('T505 AC7 负向：切换归档不越界', () => {
    it('只上抛 toggleArchived，不触发其它维度 / 清空 / 保存事件', async () => {
        mountBar()
        await wrapper!
            .find('.search-filter-bar__archived [role="switch"]')
            .trigger('keydown', { key: 'Enter' })
        await wrapper!.find('.search-filter-bar__archived-label').trigger('click')
        expect(wrapper!.emitted('toggleArchived')).toHaveLength(2)
        expect(wrapper!.emitted('toggleProject')).toBeUndefined()
        expect(wrapper!.emitted('toggleTag')).toBeUndefined()
        expect(wrapper!.emitted('togglePriority')).toBeUndefined()
        expect(wrapper!.emitted('toggleState')).toBeUndefined()
        expect(wrapper!.emitted('clear')).toBeUndefined()
        expect(wrapper!.emitted('save')).toBeUndefined()
    })
})