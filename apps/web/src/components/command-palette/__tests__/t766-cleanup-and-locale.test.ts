// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'
import { messages } from '@nao-todo/shared/locales'
import { registry, scopeManager } from '@/commands/instance'
import { registerAppCommands } from '@/commands/app.commands'
import { commandLabelOf } from '../command-display'

/**
 * T766 · #371 附带清理与文案守护（源级断言）
 *
 * ① 死命令 `app.modal.close`（`scope: 'modal'` 无进入点）已删除且**零引用**（不留悬空 id / 作用域）；
 * ② 命令面板 / 快捷键帮助的文案全部走 i18n：中英双键齐备、无死键、无裸中文；
 * ③ 应用级命令一律带 `i18n.label`（面板/帮助永不回落成内部 id）；
 * ④ 帮助必列项所依赖的键位确实注册在真实组件里（帮助从注册表派生，此处守护「注册源还在」）。
 */

const APP_SOURCES = import.meta.glob(
    ['/apps/web/src/**/*.{ts,vue}', '/packages/shared/commands/**/*.ts'],
    {
        query: '?raw',
        import: 'default',
        eager: true
    }
) as Record<string, string>

/** 源码（测试文件不计：用例本身会写出被守护的字面量） */
const productionSources = (): [string, string][] =>
    Object.entries(APP_SOURCES).filter(([path]) => !path.includes('__tests__'))

/** 命令面板 / 帮助的文案键（`commands.*` 命名空间） */
const commandKeys = (locale: keyof typeof messages): string[] =>
    Object.keys(messages[locale]).filter((key) => key.startsWith('commands.'))

/** 去除注释（保留代码，用于「无裸中文」断言） */
const stripComments = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1')

const CJK = /[\u4e00-\u9fa5]/

let appCommandsSource = ''

beforeEach(() => {
    scopeManager.enter('global')
    registerAppCommands()
    appCommandsSource = String(
        (
            import.meta.glob('/apps/web/src/commands/app.commands.ts', {
                query: '?raw',
                import: 'default',
                eager: true
            }) as Record<string, string>
        )['/apps/web/src/commands/app.commands.ts'] ?? ''
    )
})

afterEach(() => {
    scopeManager.clear()
})

describe('T766 · 死代码清理（`app.modal.close` 零引用）', () => {
    it('源码里不再出现 `app.modal.close`（不留悬空 id；注释里的历史说明不算引用）', () => {
        const offenders = productionSources()
            .filter(([, source]) => stripComments(source).includes('app.modal.close'))
            .map(([path]) => path)
        expect(offenders).toEqual([])
    })

    it('源码里不再出现 `scope: "modal"`（不留无进入点的作用域依赖）', () => {
        const offenders = productionSources()
            .filter(([, source]) => /scope:\s*['"]modal['"]/.test(source))
            .map(([path]) => path)
        expect(offenders).toEqual([])
    })

    it('注册表里只剩三条应用级命令（面板自身 / 帮助 / 设置）', () => {
        const appIds = registry
            .getAll()
            .map((command) => command.id)
            .filter((id) => id.startsWith('app.'))
            .sort()
        expect(appIds).toEqual([
            'app.command-palette.open',
            'app.settings.open',
            'app.shortcuts.show'
        ])
    })
})

describe('T766 · 文案 i18n（中英双键 + 无裸中文 + 无死键）', () => {
    it('zh-CN / en-US 的 `commands.*` 键集合逐字相同且非空', () => {
        expect(commandKeys('en-US').sort()).toEqual(commandKeys('zh-CN').sort())
        const empty = commandKeys('zh-CN').filter((key) => {
            const zh = (messages['zh-CN'] as unknown as Record<string, string>)[key]
            const en = (messages['en-US'] as unknown as Record<string, string>)[key]
            return !zh?.trim() || !en?.trim()
        })
        expect(empty).toEqual([])
    })

    it('`commands.*` 键全部有消费者（无死键）', () => {
        const referenced = new Set<string>()
        for (const [path, source] of productionSources()) {
            if (path.includes('/packages/shared/locales/')) continue
            for (const match of source.matchAll(/'(commands\.[A-Za-z0-9.]+)'/g)) {
                if (match[1]) referenced.add(match[1])
            }
        }
        const dead = commandKeys('zh-CN').filter((key) => !referenced.has(key))
        expect(dead).toEqual([])
    })

    it('`app.commands.ts` 代码里不裸写中文（注释之外零 CJK）', () => {
        expect(appCommandsSource).not.toBe('')
        expect(stripComments(appCommandsSource)).not.toMatch(CJK)
    })

    it('应用级命令都带 `i18n.label`，解析结果不等于内部 id（面板/帮助不显示 id）', () => {
        const appCommands = registry.getAll().filter((command) => command.id.startsWith('app.'))
        expect(appCommands).toHaveLength(3)
        for (const command of appCommands) {
            expect(command.i18n?.label, command.id).toBeTruthy()
            const label = commandLabelOf(command)
            expect(label, command.id).not.toBe(command.id)
            expect(label).not.toMatch(/^app\./)
        }
    })
})

describe('T766 · 帮助必列项（键位确实注册在真实组件里）', () => {
    /** 单文件源码（空白归一后比较 ⇒ 不受格式化换行影响） */
    const sourceOf = (path: string): string => {
        const raw = (
            import.meta.glob(['/apps/web/src/**/*.ts'], {
                query: '?raw',
                import: 'default',
                eager: true
            }) as Record<string, string>
        )[path]
        return String(raw ?? '')
            .replace(/useShortcut\(/g, 'useShortcut( ')
            .replace(/\s+/g, ' ')
    }

    const INDEX_VIEW = '/apps/web/src/views/index/index-view.ts'
    const CALENDAR_HOST = '/apps/web/src/components/calendar/use-calendar-host.ts'
    const DAY_VIEWPORT = '/apps/web/src/components/calendar/daily/use-day-viewport.ts'

    /** 帮助面板必列项：`useShortcut(id, keys, …)` 的真实注册点（源级断言） */
    const EXPECTED_REGISTRATIONS: { path: string; id: string; keys: string }[] = [
        { path: INDEX_VIEW, id: 'task.create', keys: 'n' },
        { path: INDEX_VIEW, id: 'project.create', keys: 'p' },
        { path: CALENDAR_HOST, id: 'calendar.nav.prev', keys: 'arrowleft' },
        { path: CALENDAR_HOST, id: 'calendar.nav.next', keys: 'arrowright' },
        { path: CALENDAR_HOST, id: 'calendar.nav.today', keys: 't' },
        { path: CALENDAR_HOST, id: 'calendar.nav.week', keys: 'w' },
        { path: CALENDAR_HOST, id: 'calendar.nav.month', keys: 'm' },
        { path: CALENDAR_HOST, id: 'calendar.quick-create', keys: 'n' },
        { path: CALENDAR_HOST, id: 'calendar.open-day', keys: 'enter' },
        { path: DAY_VIEWPORT, id: 'calendar.dayzoom.in', keys: '$mod+=' },
        { path: DAY_VIEWPORT, id: 'calendar.dayzoom.out', keys: '$mod+-' },
        { path: DAY_VIEWPORT, id: 'calendar.dayzoom.reset', keys: '$mod+0' }
    ]

    it('任务 / 清单 / 日历 / 日视图缩放的键位仍由真实组件 `useShortcut` 注册', () => {
        const missing = EXPECTED_REGISTRATIONS.filter(
            ({ path, id, keys }) => !sourceOf(path).includes(`useShortcut( '${id}', '${keys}'`)
        ).map(({ path, id, keys }) => `${path} ← ${id} (${keys})`)
        expect(missing).toEqual([])
    })

    it('日视图 `Ctrl/⌘ + 滚轮` 以手势提示注册（帮助里也会出现）', () => {
        expect(sourceOf(DAY_VIEWPORT)).toContain("gesture: '$mod+wheel'")
    })

    it('这些文件里的每次 `useShortcut` 都带 i18n 标签键（帮助里可翻译，不回落成 id）', () => {
        const paths = [...new Set(EXPECTED_REGISTRATIONS.map(({ path }) => path))]
        const offenders = paths
            .map((path) => {
                const source = sourceOf(path)
                const registrations = source.match(/useShortcut\(/g)?.length ?? 0
                const i18nLabels = source.match(/i18n: \{/g)?.length ?? 0
                return { path, registrations, i18nLabels }
            })
            .filter(
                ({ registrations, i18nLabels }) =>
                    registrations === 0 || registrations !== i18nLabels
            )
        expect(offenders).toEqual([])
    })
})