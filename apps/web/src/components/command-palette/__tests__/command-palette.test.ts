// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { NueDialog, NueEmpty, NueIcon, NueInput } from 'nue-ui'
import { t } from '@nao-todo/shared/locales'
import { registry, scopeManager } from '@/commands/instance'
import { registerAppCommands } from '@/commands/app.commands'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import CommandPalette from '../command-palette.vue'
import ShortcutsHelp from '../shortcuts-help.vue'
import { closeCommandPalette, closeShortcutsHelp, commandPaletteOpen } from '../state'

/**
 * T766 · 命令面板（Issue #371）
 *
 * 契约：
 *  - `Ctrl/⌘ + K` 打开（真实键盘引擎 + 真实注册中心，不用桩）；
 *  - 输入即时过滤（label / description，大小写不敏感）、`↑/↓` 选择、`Enter` 执行、执行后关闭；
 *  - `Esc` 关闭 + 焦点归还给打开前的元素（`NueDialog` 原生 `onEscape`）；
 *  - 面板项**全部来自注册表**：不含自身（`hidden`）、不含已删除/占位的命令。
 */

const FAKE_IDS = ['t766.fake.one', 't766.fake.two']

const hoisted = vi.hoisted(() => ({ one: vi.fn(), two: vi.fn() }))

const registerFakes = (): void => {
    registry.register({
        id: 't766.fake.one',
        label: 'Fake Command One',
        description: 'first fake command',
        group: '测试',
        keyboard: { keys: 'ctrl+1', scope: 'global' },
        handler: hoisted.one
    })
    registry.register({
        id: 't766.fake.two',
        label: 'Fake Command Two',
        description: 'second fake command',
        group: '测试',
        keyboard: { keys: 'ctrl+2', scope: 'global' },
        handler: hoisted.two
    })
}

/** 宿主：真实键盘引擎 + 两个可见面（与 `App.vue` 的挂载关系一致） */
const Host = defineComponent({
    name: 'CommandPaletteTestHost',
    setup() {
        useKeyboardShortcuts()
        return () => h('div', { class: 'test-host' }, [h(CommandPalette), h(ShortcutsHelp)])
    }
})

let wrapper: VueWrapper | null = null
let trigger: HTMLButtonElement | null = null

/** 用例时钟：等待渲染 + 宏任务（`nue-input` 的 `update:modelValue` 走 0ms 防抖） */
const settle = async (): Promise<void> => {
    for (let round = 0; round < 3; round += 1) {
        await nextTick()
        await new Promise((resolve) => setTimeout(resolve, 0))
    }
    await flushPromises()
    await nextTick()
}

const mountHost = (): void => {
    wrapper = mount(Host, {
        attachTo: document.body,
        global: {
            components: {
                'nue-dialog': NueDialog,
                'nue-empty': NueEmpty,
                'nue-icon': NueIcon,
                'nue-input': NueInput
            }
        }
    })
}

const dialog = (): HTMLElement | null => document.querySelector<HTMLElement>('.nue-dialog')
const overlay = (): HTMLElement | null => document.querySelector<HTMLElement>('.nue-dialog-overlay')
const inputEl = (): HTMLInputElement | null =>
    document.querySelector<HTMLInputElement>('.cp .nue-input__input')
const optionLabels = (): string[] =>
    Array.from(document.querySelectorAll('.cp__option-label')).map((el) => el.textContent?.trim())
const optionHints = (): string[] =>
    Array.from(document.querySelectorAll('.cp__option-hint')).map((el) => el.textContent?.trim())

/** 派发真实 keydown（引擎监听在 `document` 上） */
const pressKey = async (init: KeyboardEventInit): Promise<void> => {
    document.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
    )
    await settle()
}

/** 在输入框上派发（组合框的 ↑/↓/Enter/Esc 都从这里冒泡到对话框） */
const pressKeyInInput = async (init: KeyboardEventInit): Promise<void> => {
    inputEl()?.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
    )
    await settle()
}

/**
 * jsdom 不跑 CSS 动画 ⇒ 手动补 `animationend` 让 NueDialog 走完 after-open / after-close
 * @description 先等一拍再补事件：真实浏览器里开启动画要先跑完（≈0.36s），`NueOverlay` 挂载时的
 *              抢焦点 `setTimeout(0)` 早已执行完；这里用一轮宏任务等价替代，否则会把「遮罩抢焦点」
 *              误判成「after-open 未聚焦输入框」。
 */
const finishDialogAnimation = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 20))
    dialog()?.dispatchEvent(new Event('animationend', { bubbles: true }))
    await settle()
}

const typeQuery = async (value: string): Promise<void> => {
    const input = inputEl()
    if (!input) throw new Error('命令面板输入框不存在')
    input.value = value
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await settle()
}

const openPalette = async (): Promise<void> => {
    await pressKey({ key: 'k', ctrlKey: true })
    await finishDialogAnimation()
}

beforeEach(() => {
    // 与 `useApp()` 初始化同款：全局作用域入栈（引擎只派发当前作用域内的命令）
    scopeManager.enter('global')
    closeCommandPalette()
    closeShortcutsHelp()
    registerAppCommands()
    registerFakes()
    hoisted.one.mockClear()
    hoisted.two.mockClear()
    trigger = document.createElement('button')
    trigger.textContent = 'trigger'
    document.body.appendChild(trigger)
    trigger.focus()
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    trigger = null
    FAKE_IDS.forEach((id) => registry.unregister(id))
    closeCommandPalette()
    closeShortcutsHelp()
    scopeManager.clear()
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('T766 · 打开与关闭', () => {
    it('Ctrl+K 打开面板：role=dialog + aria-modal，焦点落到搜索框', async () => {
        mountHost()
        expect(dialog()).toBeNull()

        await openPalette()

        expect(commandPaletteOpen.value).toBe(true)
        expect(overlay()).toBeTruthy()
        expect(
            document.querySelector('[role="dialog"][aria-modal="true"]')?.getAttribute('aria-label')
        ).toBe(t('commands.palette.title'))
        expect(document.activeElement).toBe(inputEl())
    })

    it('Esc（输入框冒泡到遮罩）关闭，并把焦点还给打开前的元素', async () => {
        mountHost()
        await openPalette()
        expect(dialog()).toBeTruthy()

        await pressKeyInInput({ key: 'Escape' })
        // NueDialog 收到 esc ⇒ 关启动画 ⇒ animationend 才写回 model
        await finishDialogAnimation()

        expect(commandPaletteOpen.value).toBe(false)
        expect(dialog()).toBeNull()
        expect(document.activeElement).toBe(trigger)
    })

    it('mac 上 ⌘+K 同样打开（平台键位与引擎展开口径一致）', async () => {
        vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: 'Mozilla/5.0 (Macintosh)' })
        mountHost()

        await pressKey({ key: 'k', metaKey: true })
        await finishDialogAnimation()

        expect(dialog()).toBeTruthy()
    })
})

describe('T766 · 列表内容与交互', () => {
    it('列表项全部来自注册表：有 label / 分组 / 键位胶囊', async () => {
        mountHost()
        await openPalette()

        const labels = optionLabels()
        // 应用级命令（设置 / 快捷键帮助）+ 两条假命令
        expect(labels).toContain(t('commands.command.openSettings'))
        expect(labels).toContain(t('commands.command.showShortcuts'))
        expect(labels).toContain('Fake Command One')
        // 分组标题存在（注册表给的 group）
        const groupNames = Array.from(document.querySelectorAll('.cp__group-name')).map((el) =>
            el.textContent?.trim()
        )
        expect(groupNames).toContain(t('commands.group.system'))
        expect(groupNames).toContain('测试')
        // 键位胶囊：非 mac ⇒ Ctrl
        expect(optionHints()).toContain('Ctrl+,')
        expect(optionHints()).toContain('?')
    })

    it('不含自身、不含已删除/占位的命令（`hidden` + 注册表为准）', async () => {
        mountHost()
        await openPalette()

        const labels = optionLabels()
        // 自身（$mod+k 打开面板）标了 hidden ⇒ 不列
        expect(labels).not.toContain(t('commands.command.openPalette'))
        // 死命令已删（#371 附带清理）⇒ 注册表里不存在，面板自然没有
        expect(registry.get('app.modal.close')).toBeUndefined()
        expect(labels.some((label) => label?.includes('关闭当前弹窗'))).toBe(false)
        // 面板条数 = 注册表非 hidden 条数（单一来源，非手写清单）
        const expected = registry.getAll().filter((command) => command.hidden !== true).length
        expect(labels).toHaveLength(expected)
    })

    it('输入即时过滤（大小写不敏感），↑/↓ 移动选中，Enter 执行并关闭', async () => {
        mountHost()
        await openPalette()

        await typeQuery('FAKE')
        expect(optionLabels()).toEqual(['Fake Command One', 'Fake Command Two'])
        // 过滤后选中态回零 ⇒ aria-activedescendant 指向第一条
        expect(inputEl()?.getAttribute('aria-activedescendant')).toBe('command-palette-option-0')

        await pressKeyInInput({ key: 'ArrowDown' })
        expect(inputEl()?.getAttribute('aria-activedescendant')).toBe('command-palette-option-1')
        // 循环：再 ↓ 回到首条，↑ 回末条
        await pressKeyInInput({ key: 'ArrowDown' })
        expect(inputEl()?.getAttribute('aria-activedescendant')).toBe('command-palette-option-0')
        await pressKeyInInput({ key: 'ArrowUp' })
        expect(inputEl()?.getAttribute('aria-activedescendant')).toBe('command-palette-option-1')

        await pressKeyInInput({ key: 'Enter' })
        await finishDialogAnimation()

        expect(hoisted.two).toHaveBeenCalledTimes(1)
        expect(hoisted.one).not.toHaveBeenCalled()
        expect(commandPaletteOpen.value).toBe(false)
    })

    it('过滤无结果 ⇒ 空态（LoadingError empty），且不残留选中项', async () => {
        mountHost()
        await openPalette()

        await typeQuery('zzz-no-such-command')

        expect(optionLabels()).toEqual([])
        expect(document.querySelector('.cp__empty')).toBeTruthy()
        expect(document.body.textContent).toContain(t('commands.palette.empty'))
        expect(inputEl()?.getAttribute('aria-activedescendant')).toBeNull()
    })

    it('点击列表项同样执行（鼠标可用路径）', async () => {
        mountHost()
        await openPalette()
        await typeQuery('Fake Command One')

        document
            .querySelector('.cp__option')
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await finishDialogAnimation()

        expect(hoisted.one).toHaveBeenCalledTimes(1)
    })
})