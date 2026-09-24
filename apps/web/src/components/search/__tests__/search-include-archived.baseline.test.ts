import { describe, expect, it } from 'vite-plus/test'
import { messages } from '@nao-todo/shared/locales/messages'
import {
    EMPTY_SEARCH_QUERY,
    needsSearchQueryReExport,
    parseSearchQuery,
    searchQueryEquals,
    serializeSearchQuery,
    type SearchQueryState
} from '../search-query'

/**
 * T178b 用例先行 · 红基线（清单归档 —— 面7 搜索开关：URL 深链 + i18n，行为级）
 *
 * 真源：`docs/adr/2026-09-24-project-archive.md` §15.2（`T175b` 冻结命名）：
 *   - `SearchQueryState.includeArchived: boolean`（与 `includeExcluded` 并列）；
 *   - URL 参数 **`archived=1`**（镜像既有 `excluded=1` / `EXCLUDED_ON` 范式）
 *     ⇒ `parse` / `serialize` / `equals` 三处同步；
 *   - 结果标识键 **`search.state.archived`**、开关标签 **`search.includeArchived`**（中/英）。
 *
 * ⚠️ 红基线：`includeArchived` 尚未入选 `SearchQueryState`（`archived=1` 被忽略）⇒ 本文件应 **红**。
 *    不改任何实现文件。仓储侧「命中归档任务」行为见
 *    `packages/infrastructure/.../local-task-archive-search.baseline.test.ts`。
 */

/** 实现落地前以窄类型承接（防 `vp check` 类型红；断言仍按 ADR 冻结名） */
type ArchivedSearchState = SearchQueryState & { includeArchived?: boolean }

const withArchived = (includeArchived: boolean): ArchivedSearchState => ({
    ...EMPTY_SEARCH_QUERY,
    includeArchived
})

const parse = (raw: Record<string, string | string[]>): ArchivedSearchState =>
    parseSearchQuery(raw) as ArchivedSearchState

const dict = (locale: 'zh-CN' | 'en-US'): Record<string, string> =>
    messages[locale] as unknown as Record<string, string>

describe('T178b · 面7 URL 深链 archived=1（parse / serialize / equals）', () => {
    it("parseSearchQuery({ archived: '1' }) ⇒ includeArchived === true", () => {
        expect(parse({ archived: '1' }).includeArchived).toBe(true)
        // 数组取首值（镜像 excluded=1 范式）
        expect(parse({ archived: ['1', '0'] }).includeArchived).toBe(true)
    })

    it("缺省 / '0' / 非法值 ⇒ includeArchived === false", () => {
        expect(parse({}).includeArchived ?? false).toBe(false)
        expect(parse({ archived: '0' }).includeArchived ?? false).toBe(false)
        expect(parse({ archived: 'bogus' }).includeArchived ?? false).toBe(false)
    })

    it("serializeSearchQuery(includeArchived: true) ⇒ archived='1'；false ⇒ 省略（URL 保持干净）", () => {
        expect(serializeSearchQuery(withArchived(true) as SearchQueryState).archived).toBe('1')
        expect(
            serializeSearchQuery(withArchived(false) as SearchQueryState).archived
        ).toBeUndefined()
    })

    it('往返一致：parse(serialize(state)) ≡ state（含 archived=1）', () => {
        const state = withArchived(true)
        const roundTrip = parse(serializeSearchQuery(state as SearchQueryState))

        expect(roundTrip.includeArchived).toBe(true)
        expect(searchQueryEquals(roundTrip as SearchQueryState, state as SearchQueryState)).toBe(
            true
        )
    })

    it('searchQueryEquals 区分 includeArchived；URL 缺 archived=1 ⇒ 需回写', () => {
        expect(
            searchQueryEquals(
                withArchived(true) as SearchQueryState,
                withArchived(false) as SearchQueryState
            )
        ).toBe(false)
        expect(needsSearchQueryReExport(withArchived(true) as SearchQueryState, {})).toBe(true)
        expect(
            needsSearchQueryReExport(withArchived(true) as SearchQueryState, { archived: '1' })
        ).toBe(false)
    })
})

describe('T178b · 面7 i18n 文案键（ADR §15.2 冻结名）', () => {
    it.each(['search.state.archived', 'search.includeArchived'])(
        '中/英均存在非空文案：%s',
        (key) => {
            expect(dict('zh-CN')[key] ?? '').not.toBe('')
            expect(dict('en-US')[key] ?? '').not.toBe('')
        }
    )

    it('结果标识可与其它状态标识区分（archived ≠ deleted）', () => {
        const archivedZh = dict('zh-CN')['search.state.archived'] ?? ''
        const archivedEn = dict('en-US')['search.state.archived'] ?? ''
        expect(archivedZh).not.toBe('')
        expect(archivedEn).not.toBe('')
        expect(archivedZh).not.toBe(dict('zh-CN')['search.state.deleted'])
        expect(archivedEn).not.toBe(dict('en-US')['search.state.deleted'])
    })
})