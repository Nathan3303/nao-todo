// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { NueButton, NueDatePicker, NueSwitch } from 'nue-ui'
import { setLocale, t } from '@nao-todo/shared/locales'
import { messages } from '@nao-todo/shared/locales/messages'
import type { LocaleKey } from '@nao-todo/shared'
import { InnerDropdownOption } from '@nao-todo/shared/components/inner-dropdown'
import { nueUI } from '@/nue-ui-register'
import SearchSortTrigger from '../search-sort-trigger.vue'
import SearchDueTrigger from '../search-due-trigger.vue'
import { DEFAULT_SEARCH_SORT, type SearchSort } from '../search-sort'

/**
 * T770 · 排序 / 截止日触发器（UI 接线）
 * 依据：Issue #373 口径 2（四种 + 方向，选择器风格与既有筛选触发器一致）、口径 3（区间 + 含无截止日）。
 * 断言口径（jsdom 可测）：触发器文案与激活态、面板项（字段 5 / 方向 2，相关性无方向）、
 * 事件上抛（字段 / 方向 / 起止日 / 含无截止日 / 清除）、i18n 中英齐备。
 * ⚠️ 面板内容由 NueDropdown **Teleport 到 body**（`#TopLevelNuePopupPool`）⇒ 一律用组件查询
 *    （`findAllComponents`），DOM 查询只在 `document.body` 上做。
 * jsdom 不可测（留给用户视觉走查）：面板实际像素、日期面板弹出位置、窄屏换行。
 */

type SortProps = { sort?: SearchSort }
type DueProps = { from?: string; to?: string; includeNoDue?: boolean }

let wrapper: VueWrapper | null = null

const mountSort = (props: SortProps = {}): VueWrapper => {
    wrapper = mount(SearchSortTrigger, {
        global: { plugins: [nueUI] },
        props: { sort: props.sort ?? DEFAULT_SEARCH_SORT }
    })
    return wrapper
}

const mountDue = (props: DueProps = {}): VueWrapper => {
    wrapper = mount(SearchDueTrigger, {
        global: { plugins: [nueUI] },
        props: {
            from: props.from ?? '',
            to: props.to ?? '',
            includeNoDue: props.includeNoDue ?? false
        }
    })
    return wrapper
}

const trigger = () => wrapper!.find('[data-role="sort-trigger"]')
const dueTrigger = () => wrapper!.find('[data-role="due-trigger"]')
const optionTitles = () =>
    wrapper!.findAllComponents(InnerDropdownOption).map((option) => option.props('title'))
const optionByTitle = (title: string) =>
    wrapper!
        .findAllComponents(InnerDropdownOption)
        .find((option) => option.props('title') === title)!

beforeEach(() => {
    setActivePinia(createPinia())
    setLocale('zh-CN')
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    setLocale('zh-CN')
    document.body.innerHTML = ''
})

describe('T770 排序触发器', () => {
    it('默认（相关性）：触发器显示「排序：相关性」，无方向词、非激活态', () => {
        mountSort()
        expect(trigger().text()).toBe('排序：相关性')
        expect(trigger().classes()).not.toContain('filter-trigger--active')
    })

    it('非默认排序：触发器显示方向词并进入激活态', async () => {
        mountSort({ sort: { field: 'name', order: 'asc' } })
        expect(trigger().text()).toBe('排序：名称升序')
        expect(trigger().classes()).toContain('filter-trigger--active')
        await wrapper!.setProps({ sort: { field: 'updatedAt', order: 'desc' } })
        expect(trigger().text()).toBe('排序：更新时间降序')
    })

    it('面板含五个字段项；相关性时不含方向项（避免无意义的升降）', () => {
        mountSort()
        const titles = optionTitles()
        expect(titles).toEqual(['相关性', '更新时间', '截止日', '优先级', '名称'])
        expect(titles).not.toContain('升序')
        expect(titles).not.toContain('降序')
    })

    it('非相关性时方向项出现，且当前方向带勾选', () => {
        mountSort({ sort: { field: 'updatedAt', order: 'desc' } })
        const titles = optionTitles()
        expect(titles).toEqual(['相关性', '更新时间', '截止日', '优先级', '名称', '升序', '降序'])
        expect(optionByTitle('降序').props('checked')).toBe(true)
        expect(optionByTitle('升序').props('checked')).toBe(false)
        expect(optionByTitle('更新时间').props('checked')).toBe(true)
    })

    it('NueDropdown execute 分流：字段项 → selectField，方向项 → selectOrder（前缀区分）', async () => {
        mountSort({ sort: { field: 'name', order: 'asc' } })
        const dropdown = wrapper!.findComponent({ name: 'NueDropdown' })
        dropdown.vm.$emit('execute', 'dueAt')
        await nextTick()
        expect(wrapper!.emitted('selectField')?.[0]).toEqual(['dueAt'])
        dropdown.vm.$emit('execute', '__order__desc')
        await nextTick()
        expect(wrapper!.emitted('selectOrder')?.[0]).toEqual(['desc'])
        // 非法 id 不产生事件
        dropdown.vm.$emit('execute', '__order__bogus')
        dropdown.vm.$emit('execute', 'bogus')
        await nextTick()
        expect(wrapper!.emitted('selectField')).toHaveLength(1)
        expect(wrapper!.emitted('selectOrder')).toHaveLength(1)
    })
})

describe('T770 截止日触发器', () => {
    it('未设置：只显示维度名，非激活态，面板内有起/止两个日期 + 无截止日开关，无「清除日期」', () => {
        mountDue()
        expect(dueTrigger().text()).toBe('截止日')
        expect(dueTrigger().classes()).not.toContain('filter-trigger--active')
        expect(wrapper!.findAllComponents(NueDatePicker)).toHaveLength(2)
        expect(wrapper!.findAllComponents(NueSwitch)).toHaveLength(1)
        const clear = wrapper!
            .findAllComponents(NueButton)
            .find((button) => button.text().includes('清除日期'))
        expect(clear).toBeUndefined()
    })

    it('区间摘要：双端 / 仅起 / 仅止三态（含激活态）', async () => {
        mountDue({ from: '2026-03-01', to: '2026-03-31' })
        expect(dueTrigger().text()).toContain('截止日')
        expect(dueTrigger().text()).toContain('至')
        expect(dueTrigger().classes()).toContain('filter-trigger--active')
        await wrapper!.setProps({ to: '' })
        expect(dueTrigger().text()).toContain('不早于')
        await wrapper!.setProps({ from: '', to: '2026-03-31' })
        expect(dueTrigger().text()).toContain('不晚于')
        await wrapper!.setProps({ from: '', to: '' })
        expect(dueTrigger().text()).toBe('截止日')
    })

    it('无截止日开关：受控态跟随 prop；点文字上抛取反值', async () => {
        mountDue({ includeNoDue: false })
        const sw = () => wrapper!.findComponent(NueSwitch)
        expect(sw().props('modelValue')).toBe(false)
        await wrapper!.setProps({ includeNoDue: true })
        expect(sw().props('modelValue')).toBe(true)

        await wrapper!.find('.due-panel__switch-label').trigger('click')
        expect(wrapper!.emitted('update:includeNoDue')?.at(-1)).toEqual([false])
    })

    it('开关自身 update:model-value 直接上抛（单一真源）', async () => {
        mountDue()
        wrapper!.findComponent(NueSwitch).vm.$emit('update:model-value', true)
        expect(wrapper!.emitted('update:includeNoDue')?.[0]).toEqual([true])
    })

    it('清除日期：区间生效时出现按钮并上抛 clear', async () => {
        mountDue({ from: '2026-03-01' })
        const clear = wrapper!
            .findAllComponents(NueButton)
            .find((button) => button.text().includes('清除日期'))
        expect(clear).toBeTruthy()
        await clear!.trigger('click')
        expect(wrapper!.emitted('clear')).toHaveLength(1)
    })

    it('日期选择上抛 update:from / update:to（null 归一为空串）', async () => {
        mountDue()
        const pickers = wrapper!.findAllComponents(NueDatePicker)
        pickers[0]!.vm.$emit('update:model-value', '2026-05-06')
        expect(wrapper!.emitted('update:from')?.at(-1)).toEqual(['2026-05-06'])
        pickers[1]!.vm.$emit('update:model-value', null)
        expect(wrapper!.emitted('update:to')?.at(-1)).toEqual([''])
    })
})

describe('T770 i18n：新增文案键中英齐备', () => {
    const keys: LocaleKey[] = [
        'search.sort.label',
        'search.sort.relevance',
        'search.sort.updatedAt',
        'search.sort.dueAt',
        'search.sort.priority',
        'search.sort.name',
        'search.sort.orderAsc',
        'search.sort.orderDesc',
        'search.filter.due',
        'search.filter.dueFrom',
        'search.filter.dueTo',
        'search.filter.dueRange',
        'search.filter.dueFromOnly',
        'search.filter.dueToOnly',
        'search.filter.dueClear',
        'search.includeNoDue',
        'search.showMore',
        'search.tooManyResults',
        'search.capped',
        'search.enumBudgetPaused'
    ]

    it('zh-CN / en-US 均非空（无占位缺失）', () => {
        const zh = messages['zh-CN'] as unknown as Record<string, string>
        const en = messages['en-US'] as unknown as Record<string, string>
        for (const key of keys) {
            expect(zh[key]?.trim(), `zh ${key}`).toBeTruthy()
            expect(en[key]?.trim(), `en ${key}`).toBeTruthy()
        }
        expect(zh['search.sort.label']).toBe('排序')
        expect(en['search.sort.label']).toBe('Sort')
        // 5000 硬封顶口径已作废 ⇒ 提示文案改为「仅搜索前 5 万条」
        expect(zh['search.capped']).toContain('5 万')
        expect(en['search.capped']).toContain('50,000')
    })

    it('切换语言后 t() 立即返回对应文案（无硬编码中文残留）', () => {
        setLocale('en-US')
        expect(t('search.filter.due')).toBe('Due date')
        expect(t('search.showMore')).toBe('Show more')
        setLocale('zh-CN')
        expect(t('search.filter.due')).toBe('截止日')
    })
})