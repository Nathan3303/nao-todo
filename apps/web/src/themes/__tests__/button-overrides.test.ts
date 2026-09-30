import { describe, expect, it } from 'vite-plus/test'

/**
 * DEF-64：注销/恢复账户按钮归并到库标准 `destructive` 主题；app 层自造 `danger`/`warning` 覆盖已删除。
 * @description 源级防回归：
 *              ① 3 处按钮使用库标准 `destructive`，不再使用 app 自造 `danger`；
 *              ② `apps/web/src/themes/button.css` 覆盖文件已删除、themes 入口不再引用。
 *              背景：app 层覆盖会顶掉主题 AA 配色（`DEF-64` 实测 warning 实心仅 2.97:1）；
 *              归并到库语义（`destructive` 已达 AA）后 app 覆盖无存在必要。
 */

const deactiveManagerModules = import.meta.glob(
    '/packages/presentation-identity/src/components/deactive-manager/index.vue',
    { query: '?raw', import: 'default', eager: true }
)
const deactiveUserModules = import.meta.glob(
    '/packages/presentation-identity/src/components/dialogs/deactive-user/deactive-user.vue',
    { query: '?raw', import: 'default', eager: true }
)
const themesIndexModules = import.meta.glob('/apps/web/src/themes/index.ts', {
    query: '?raw',
    import: 'default',
    eager: true
})
const buttonCssModules = import.meta.glob('/apps/web/src/themes/button.css', {
    query: '?raw',
    import: 'default',
    eager: true
})

/** 断言命中且仅命中 1 个文件后返回其源文本（防「glob 模式写错 ⇒ 恒真/恒假」空转） */
const sourceOf = (modules: Record<string, string>): string => {
    const values = Object.values(modules)
    expect(values.length).toBe(1)
    return values[0]!
}

const countOccurrences = (haystack: string, needle: string): number =>
    haystack.split(needle).length - 1

describe('DEF-64 注销/恢复账户按钮归并库 destructive 主题', () => {
    it('3 处按钮使用 destructive，且不再使用自造 danger', () => {
        const manager = sourceOf(deactiveManagerModules)
        const dialog = sourceOf(deactiveUserModules)

        expect(countOccurrences(manager, 'theme="destructive"')).toBe(2)
        expect(countOccurrences(dialog, 'theme="destructive"')).toBe(1)

        expect(manager).not.toContain('theme="danger"')
        expect(dialog).not.toContain('theme="danger"')
    })

    it('app 层不再保留 .nue-button--danger / --warning 覆盖', () => {
        // 覆盖文件已删除（glob 命中 0 文件），themes 入口不再引用
        expect(Object.keys(buttonCssModules)).toHaveLength(0)
        expect(sourceOf(themesIndexModules)).not.toContain('button.css')
    })
})