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
import { closeCommandPalette, closeShortcutsHelp, shortcutsHelpOpen } from '../state'

/**
 * T766 · 快捷键帮助（Issue #371）
 *
 * 契约：`?` 打开；按键、说明与分组**全部由注册表派生**（新增一条注册项即自动出现在帮助里，
 * 证明「不是手写清单」）；只列真的有键位/手势的命令；键面按平台（mac `⌘` / 其它 `Ctrl`）。
 */

const Host = defineComponent({
    name: 'ShortcutsHelpTestHost',
    setup() {
        useKeyboardShortcuts()
        return () => h('div', [h(CommandPalette), h(ShortcutsHelp)])
    }
})

let wrapper: VueWrapper | null = null

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

const helpDialog = (): HTMLElement | null =>
    document.querySelector<HTMLElement>('.nue-dialog--shortcuts-help')

const rowLabels = (): string[] =>
    Array.from(document.querySelectorAll('.sh__row-label')).map((el) => el.textContent?.trim())
const groupNames = (): string[] =>
    Array.from(document.querySelectorAll('.sh__group-name')).map((el) => el.textContent?.trim())

/** 键位胶囊与标签同行（row 内 dt + dd），用于断言「某命令的键位」 */
const keysOf = (label: string): string | undefined => {
    const row = Array.from(document.querySelectorAll('.sh__row')).find(
        (el) => el.querySelector('.sh__row-label')?.textContent?.trim() === label
    )
    return row?.querySelector('.sh__keys')?.textContent?.trim()
}

const openHelp = async (): Promise<void> => {
    document.dispatchEvent(
        new KeyboardEvent('keydown', { key: '?', bubbles: true, cancelable: true })
    )
    await settle()
    await new Promise((resolve) => setTimeout(resolve, 20))
    helpDialog()?.dispatchEvent(new Event('animationend', { bubbles: true }))
    await settle()
}

beforeEach(() => {
    scopeManager.enter('global')
    closeCommandPalette()
    closeShortcutsHelp()
    registerAppCommands()
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    registry.unregister('t766.fake.keyed')
    registry.unregister('t766.fake.keyless')
    scopeManager.clear()
    closeCommandPalette()
    closeShortcutsHelp()
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('T766 · 快捷键帮助', () => {
    it('`?` 打开帮助对话框（role=dialog + aria-modal）', async () => {
        mountHost()
        expect(helpDialog()).toBeNull()

        await openHelp()

        expect(shortcutsHelpOpen.value).toBe(true)
        expect(helpDialog()).toBeTruthy()
        expect(
            document.querySelector('[role="dialog"][aria-modal="true"]')?.getAttribute('aria-label')
        ).toBe(t('commands.help.title'))
        expect(document.body.textContent).toContain(t('commands.help.intro'))
    })

    it('内容由注册表派生：新增一条注册项即出现在帮助里（非手写清单）', async () => {
        mountHost()
        await openHelp()

        const before = rowLabels()
        expect(before).toContain(t('commands.command.openSettings'))
        expect(before).not.toContain('Fake Keyed Command')

        // 新增注册项（含键位）⇒ 再次打开帮助即出现
        registry.register({
            id: 't766.fake.keyed',
            label: 'Fake Keyed Command',
            group: '测试',
            keyboard: { keys: 'ctrl+shift+y', scope: 'global' },
            handler: () => {}
        })
        closeShortcutsHelp()
        await settle()
        await openHelp()

        expect(rowLabels()).toContain('Fake Keyed Command')
        expect(keysOf('Fake Keyed Command')).toBe('Ctrl+Shift+Y')
        expect(groupNames()).toContain('测试')
    })

    it('只列「实际生效」的命令：无键位/手势的注册项不出现，占位/死命令也不出现', async () => {
        registry.register({
            id: 't766.fake.keyless',
            label: 'Fake Keyless Command',
            group: '测试',
            handler: () => {}
        })
        mountHost()
        await openHelp()

        const labels = rowLabels()
        expect(labels).not.toContain('Fake Keyless Command')
        // #371 附带清理：全局 Esc 死命令已删 ⇒ 帮助里没有它
        expect(registry.get('app.modal.close')).toBeUndefined()
        expect(labels).toHaveLength(
            registry.getAll().filter((command) => command.keyboard?.keys ?? command.gesture).length
        )
    })

    it('应用级必列项：快捷键帮助 `?`、命令面板、设置、新建任务 / 清单', async () => {
        registry.register({
            id: 't766.fake.keyed',
            label: 'New Task (fake mirror)',
            i18n: { label: 'commands.command.createTask', group: 'commands.group.tasks' },
            keyboard: { keys: 'n', scope: 'global' },
            handler: () => {}
        })
        mountHost()
        await openHelp()

        expect(keysOf(t('commands.command.showShortcuts'))).toBe('?')
        expect(keysOf(t('commands.command.openPalette'))).toBe('Ctrl+K')
        expect(keysOf(t('commands.command.openSettings'))).toBe('Ctrl+,')
        expect(keysOf(t('commands.command.createTask'))).toBe('N')
        expect(groupNames()).toContain(t('commands.group.system'))
    })

    it('mac 上用 ⌘ 显示（同一条注册项，两平台两种键面）', async () => {
        vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: 'Mozilla/5.0 (Macintosh)' })
        mountHost()
        await openHelp()

        expect(keysOf(t('commands.command.openPalette'))).toBe('⌘+K')
        expect(keysOf(t('commands.command.openSettings'))).toBe('⌘+,')
    })

    it('非键盘手势（`$mod+wheel`）也进帮助，词按语言本地化', async () => {
        registry.register({
            id: 't766.fake.keyed',
            label: 'Fake Wheel Zoom',
            group: '测试',
            gesture: '$mod+wheel',
            handler: () => {}
        })
        mountHost()
        await openHelp()

        expect(keysOf('Fake Wheel Zoom')).toBe('Ctrl+滚轮')
    })
})