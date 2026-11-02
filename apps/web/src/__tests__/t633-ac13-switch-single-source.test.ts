// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { ref, defineComponent, h, nextTick } from 'vue'
import { NueSwitch } from 'nue-ui'
import { messages } from '@nao-todo/shared/locales'

/**
 * T633 AC13 / AC15 · `nue-switch` 单一语义源 + 可访问名齐备
 *
 * 背景（`T628` C2/R3）：上游 `1.14.0` 起 `NueSwitch` 自带 `role="switch"` / `aria-checked` /
 * `tabindex`（disabled ⇒ `-1`）/ `keydown.enter` / `keydown.space`。本仓这 5 处（search 1 +
 * reminder 4）**自建了同一套**，升级后若不一并拆除会变成**双实现**：
 *   - `@keydown.enter` 与组件内部监听落在同一根元素 ⇒ 一次按键**两次上抛**；
 *   - `tabindex="0"` 是 fallthrough，会**覆盖**组件内部给 disabled 开关的 `-1`
 *     ⇒ disabled 开关被重新拉进 Tab 序。
 * 判据是「可疑写法在源里消失」+「上游契约在运行期成立」，而不是靠肉眼比对 diff。
 *
 * `AC15`：升级后 3 处开关（`timer-setting` ×2 / `task-remind-setter` ×1）新进 Tab 序，
 * 必须各有可访问名。本文件用**通用不变量**守：本批涉及的 4 个组件里**每一个** `<nue-switch>`
 * 都必须带 `aria-label`（比逐处点名更抗改）。
 */

const FILES = {
    'search-filter-bar.vue': '/apps/web/src/components/search/search-filter-bar.vue',
    'reminder-panel.vue': '/apps/web/src/components/settings/panels/reminder-panel.vue',
    'timer-setting.vue':
        '/packages/presentation/pomodoro/components/dialogs/timer-setting/timer-setting.vue',
    'task-remind-setter.vue':
        '/packages/presentation/task/components/remind-setter/task-remind-setter.vue'
} as const

const sources = import.meta.glob(
    [
        '/apps/web/src/components/search/search-filter-bar.vue',
        '/apps/web/src/components/settings/panels/reminder-panel.vue',
        '/packages/presentation/pomodoro/components/dialogs/timer-setting/timer-setting.vue',
        '/packages/presentation/task/components/remind-setter/task-remind-setter.vue'
    ],
    { query: '?raw', import: 'default', eager: true }
) as Record<string, string>

/** 断言命中且仅命中预期文件数后取源文本（防 glob 写错 ⇒ 恒真/恒假） */
const sourceOf = (path: string): string => {
    const value = sources[path]
    expect(
        value,
        `未读到源码：${path}（已完成物化 ${Object.keys(sources).length} 个文件）`
    ).toBeTruthy()
    return value!
}

/** 提取所有 `<nue-switch … />` 开标签文本 */
const switchTags = (source: string): string[] => {
    const tags: string[] = []
    const pattern = /<nue-switch\b[\s\S]*?\/>/g
    let matched: RegExpExecArray | null
    while ((matched = pattern.exec(source))) tags.push(matched[0])
    return tags
}

describe('T633 AC13 · 5 处自建 switch a11y 已拆除（单一语义源）', () => {
    it('4 个组件里都没有 role="switch" / :aria-checked / tabindex / @keydown.enter|space（双实现写法）', () => {
        for (const [label, path] of Object.entries(FILES)) {
            const source = sourceOf(path)
            // 只匹配模板属性写法（样式块里的 `[role='switch']` 用单引号，不命中）
            expect(source, `${label}：不应再自建 role="switch"`).not.toContain('role="switch"')
            expect(source, `${label}：不应再自建 :aria-checked`).not.toContain(':aria-checked')
            expect(source, `${label}：不应再自建 tabindex`).not.toMatch(/(^|\s):?tabindex=/m)
            expect(
                source,
                `${label}：不应再自建 @keydown.enter / @keydown.space（会与组件内部监听双触发）`
            ).not.toMatch(/@keydown\.(enter|space)/)
        }
    })

    it('search-filter-bar / reminder-panel 的可访问名保留（拆 a11y 时不得连 :aria-label 一起删）', () => {
        for (const label of ['search-filter-bar.vue', 'reminder-panel.vue'] as const) {
            const source = sourceOf(FILES[label])
            expect(source, `${label}：应保留 :aria-label`).toContain(':aria-label=')
        }
    })

    it('5 处开关逐一在位（search 1 + reminder 4 = 5）', () => {
        const searchCount = switchTags(sourceOf(FILES['search-filter-bar.vue'])).length
        const reminderCount = switchTags(sourceOf(FILES['reminder-panel.vue'])).length
        expect(searchCount).toBe(1)
        expect(reminderCount).toBe(4)
    })
})

describe('T633 AC15 · 每个 <nue-switch> 都有可访问名（含 3 处本批补名）', () => {
    it('4 个组件内每一个 <nue-switch> 都带 aria-label', () => {
        const offenders: string[] = []
        let total = 0
        for (const [label, path] of Object.entries(FILES)) {
            switchTags(sourceOf(path)).forEach((tag, index) => {
                total += 1
                if (!tag.includes('aria-label')) offenders.push(`${label} 第 ${index + 1} 个开关`)
            })
        }
        expect(total, '应扫到 5 + 3 = 8 个开关').toBe(8)
        expect(offenders, `无可访问名的开关：${offenders.join('、')}`).toEqual([])
    })

    it('新增 3 个 i18n 键在 zh-CN / en-US 均存在且非空（types 由 tsc 保证）', () => {
        const keys = [
            'pomodoro.timerSetting.autoStartNextFocusSession',
            'pomodoro.timerSetting.autoRest',
            'task.reminder.enabled'
        ] as const
        for (const key of keys) {
            for (const locale of ['zh-CN', 'en-US'] as const) {
                const value = (messages[locale] as unknown as Record<string, string>)[key]
                expect(value, `${locale} 缺 ${key}`).toBeTruthy()
                expect(value!.trim(), `${locale} 的 ${key} 为空`).not.toBe('')
            }
        }
    })

    it('可用文案与 aria-label 同键（可见文字与读屏文案不分叉）', () => {
        const timerSetting = sourceOf(FILES['timer-setting.vue'])
        expect(timerSetting).toContain("t('pomodoro.timerSetting.autoStartNextFocusSession')")
        expect(timerSetting).toContain("t('pomodoro.timerSetting.autoRest')")

        const remindSetter = sourceOf(FILES['task-remind-setter.vue'])
        expect(remindSetter).toContain("t('task.reminder.enabled')")
    })
})

describe('T633 AC13 · 上游 NueSwitch 运行期契约（本仓拆除后才成立的那条）', () => {
    /** 记录「父级收到的上抛次数与值」——这正是「一次按键一次上抛」要锁的东西 */
    const mountSwitch = (props: Record<string, unknown>) => {
        const model = ref(Boolean(props.modelValue))
        const received: boolean[] = []
        const wrapper = mount(
            defineComponent({
                setup: () => () =>
                    h(NueSwitch, {
                        ...props,
                        modelValue: model.value,
                        'onUpdate:modelValue': (value: boolean) => {
                            received.push(value)
                            model.value = value
                        }
                    })
            }),
            { attachTo: document.body }
        )
        return { wrapper, model, received }
    }

    it('enabled ⇒ tabindex=0；disabled ⇒ tabindex=-1（disabled 不被拉进 Tab 序）', async () => {
        const enabled = mountSwitch({ modelValue: false })
        const enabledRoot = enabled.wrapper.find('[role="switch"]')
        expect(enabledRoot.exists()).toBe(true)
        expect(enabledRoot.attributes('tabindex')).toBe('0')
        enabled.wrapper.unmount()

        const disabled = mountSwitch({ modelValue: false, disabled: true })
        const disabledRoot = disabled.wrapper.find('[role="switch"]')
        expect(disabledRoot.exists()).toBe(true)
        expect(disabledRoot.attributes('tabindex')).toBe('-1')
        expect(disabledRoot.attributes('aria-disabled')).toBe('true')
        disabled.wrapper.unmount()
    })

    it('一次 Enter 恰好一次上抛（拆除自建 keydown 后的核心不变量）', async () => {
        const { wrapper, received } = mountSwitch({ modelValue: false })
        await wrapper.find('[role="switch"]').trigger('keydown', { key: 'Enter' })
        await nextTick()
        expect(received, `父级实收：${JSON.stringify(received)}`).toEqual([true])
        wrapper.unmount()
    })

    it('一次 Space 恰好一次上抛', async () => {
        const { wrapper, received } = mountSwitch({ modelValue: true })
        await wrapper.find('[role="switch"]').trigger('keydown', { key: ' ' })
        await nextTick()
        expect(received, `父级实收：${JSON.stringify(received)}`).toEqual([false])
        wrapper.unmount()
    })
})