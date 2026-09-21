import { describe, expect, it } from 'vite-plus/test'
import { QUICK_SEARCH_PRESETS } from '../quick-search'

/**
 * SEA-05 / T27：快捷搜索预置（纯常量：4 项、id 唯一、仅优先级/状态维度）
 */

describe('quick-search - 预置定义', () => {
    it('共 4 项且 id 唯一', () => {
        expect(QUICK_SEARCH_PRESETS).toHaveLength(4)
        expect(new Set(QUICK_SEARCH_PRESETS.map((preset) => preset.id)).size).toBe(4)
    })

    it('仅使用优先级/状态维度，其余维度为空（零模型改动）', () => {
        for (const preset of QUICK_SEARCH_PRESETS) {
            expect(preset.query.keyword).toBe('')
            expect(preset.query.projectIds).toEqual([])
            expect(preset.query.tagIds).toEqual([])
            expect(preset.query.includeExcluded).toBe(false)
        }
    })

    it('条件映射：高优先级 / 待办 / 进行中 / 已完成', () => {
        const byId = Object.fromEntries(QUICK_SEARCH_PRESETS.map((preset) => [preset.id, preset]))
        expect(byId['high-priority']!.query.priorities).toEqual(['high'])
        expect(byId['high-priority']!.query.states).toEqual([])
        expect(byId['todo']!.query.states).toEqual(['todo'])
        expect(byId['in-progress']!.query.states).toEqual(['in-progress'])
        expect(byId['done']!.query.states).toEqual(['done'])
    })

    it('每项均带图标与 i18n 名键', () => {
        for (const preset of QUICK_SEARCH_PRESETS) {
            expect(preset.icon).not.toBe('')
            expect(preset.nameKey.startsWith('search.quick.')).toBe(true)
        }
    })
})