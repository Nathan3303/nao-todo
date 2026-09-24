import { describe, expect, it } from 'vite-plus/test'

/**
 * T178 用例先行 · 红基线（清单归档 —— 入口/搜索开关/只读错误码 **接线契约**）
 *
 * 真源：`docs/adr/2026-09-24-project-archive.md`（r1）
 *   - §7.1 / PRD §3-1：入口两处 = 头部操作菜单 + **清单右键菜单** ⇒「归档清单」。
 *   - §3.2 ② / AC：搜索默认排除归档 + **显式「包含已归档」开关**（开 ⇒ 命中 + 标识）。
 *   - §7.2 / DP-4：新增独立错误码 **`ARCHIVED_READONLY`**（不复用 `OFFLINE_READONLY`）；
 *                  只读判据 = 任务 `archivedAt` 非空（用例层拦截 ⇒ URL 直达亦不可写）。
 *   - §3.2 ①③⑥⑦：侧栏 / 搜索默认 / 日历 / 番茄选择器 / 新建下拉 **已排除**（保守护栏）。
 *
 * ⚠️ 红基线：入口（未接线）/ 右键菜单（不存在）/ 搜索开关（不存在）/ `ARCHIVED_READONLY`（不存在）
 *    应 **红**；5 处已排除点 + 头部 handler 已注册为 **绿**保守护栏。不改任何实现文件。
 *
 * 说明：本文件为**接线契约**（ADR 允诺「结构级断言」）——对源码做静态存在性断言，
 *      用于在实现落地前先钉死「必须有」的接线点；实现落地后由行为用例接管。
 */

const sourceModules: Record<string, string> = {
    ...(import.meta.glob('/apps/web/src/**/*.{ts,vue}', {
        query: '?raw',
        import: 'default',
        eager: true
    }) as Record<string, string>),
    ...(import.meta.glob('/packages/presentation/**/*.{ts,vue}', {
        query: '?raw',
        import: 'default',
        eager: true
    }) as Record<string, string>),
    ...(import.meta.glob('/packages/shared/locales/*.ts', {
        query: '?raw',
        import: 'default',
        eager: true
    }) as Record<string, string>)
}

/** 以仓根相对路径读取源码（path 不带前导斜杠） */
const readSource = (relativePath: string): string => sourceModules[`/${relativePath}`] ?? ''

/** 移除 HTML 注释（`.vue` 模板注释），用于区分「已接线」与「被注释掉的整段」 */
const stripHtmlComments = (source: string): string => source.replace(/<!--[\s\S]*?-->/g, '')

const nonTestModules = Object.entries(sourceModules).filter(([path]) => !path.includes('__tests__'))

describe('T178 · 面4 入口两处（头部菜单 + 右键菜单）', () => {
    it('头部操作菜单「归档清单」已接线（非注释态）', () => {
        const header = stripHtmlComments(
            readSource('apps/web/src/components/tasks/project/header/operation-dropdown.vue')
        )
        expect(header).toContain('execute-id="archive-project"')
    })

    it('头部「归档清单」handler 已注册（执行 projectUseCase.archive）', () => {
        const header = readSource(
            'apps/web/src/components/tasks/project/header/operation-dropdown.vue'
        )
        expect(header).toContain("register('archive-project'")
        expect(header).toContain('.archive(')
    })

    it('存在「清单右键菜单」入口（contextmenu + archive 接线）', () => {
        const candidates = nonTestModules.filter(([path, source]) => {
            if (path.includes('calendar')) return false
            return /contextmenu/i.test(source) && /archive/i.test(source)
        })
        expect(candidates.map(([path]) => path)).not.toEqual([])
    })
})

describe('T178 · 面7 搜索：默认排除（保守护栏）+「包含已归档」开关（待实现）', () => {
    it('搜索默认查询显式排除归档（保守护栏）', () => {
        const search = readSource('apps/web/src/components/search/use-search.ts')
        expect(search).toContain('isArchived: false')
    })

    it('存在「包含已归档」开关接线（includeArchived）', () => {
        const searchModules = nonTestModules.filter(
            ([path]) => path.includes('/search/') || path.includes('search-view')
        )
        const hasToggle = searchModules.some(([, source]) => /includeArchived/.test(source))
        expect(
            hasToggle,
            '搜索「包含已归档」开关（includeArchived）尚未接线（ADR §3.2 ② / AC）'
        ).toBe(true)
    })

    it('搜索结果「已归档」标识存在（中英 i18n 键齐备）', () => {
        const zh = readSource('packages/shared/locales/zh-CN.ts')
        const en = readSource('packages/shared/locales/en-US.ts')
        const zhHasMarker = /search[\s\S]{0,2000}已归档/.test(zh)
        const enHasMarker = /search[\s\S]{0,2000}(archived|Archived)/.test(en)
        expect(zhHasMarker && enHasMarker).toBe(true)
    })
})

describe('T178 · 面8 只读错误码 ARCHIVED_READONLY（DP-4，不复用 OFFLINE_READONLY）', () => {
    it('存在独立错误码 ARCHIVED_READONLY，且判据绑定任务 archivedAt', () => {
        const guardModules = nonTestModules.filter(([, source]) =>
            source.includes('ARCHIVED_READONLY')
        )
        expect(
            guardModules.map(([path]) => path),
            'ARCHIVED_READONLY 尚未落地（ADR §7.2 / DP-4）'
        ).not.toEqual([])
        expect(guardModules.some(([, source]) => source.includes('archivedAt'))).toBe(true)
    })
})

describe('T178 · 面6 已排除 5 处保持（保守护栏）', () => {
    it('侧栏清单列表走 avaliableProjects（排除归档/删除）', () => {
        expect(readSource('apps/web/src/components/tasks/aside/use-aside.ts')).toContain(
            'avaliableProjects'
        )
    })

    it('日历查询排除归档', () => {
        expect(readSource('apps/web/src/components/calendar/monthly/list-query.ts')).toContain(
            'isArchived: false'
        )
    })

    it('番茄选择器查询排除归档', () => {
        expect(
            readSource('apps/web/src/components/pomodoro/focus-depend-dropdown/use-task-panel.ts')
        ).toContain('isArchived: false')
    })

    it('新建任务清单下拉走 avaliableProjects（排除归档）', () => {
        expect(readSource('apps/web/src/views/index/tasks/multi-select-adapter.vue')).toContain(
            'avaliableProjects'
        )
    })
})