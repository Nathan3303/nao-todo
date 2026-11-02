import { describe, expect, it } from 'vite-plus/test'

/**
 * DEF-129（T634）· 日期选择器「清除键压在日历图标上」源级回归守卫
 *
 * 缺陷机制：`nue-ui` 1.15.0 起，`nue-date-picker` 的清除键从按钮内部移出，变成与按钮
 * **同级**的绝对定位按钮 `.nue-date-picker__clear`（`right: calc(var(--nue-padding-*) + 1px)`），
 * 主题靠 `.nue-date-picker__trigger--clearable .nue-button { padding-right: calc(…) }`
 * 在按钮右侧**预留**这块位置。本组件曾用 `padding: 0 var(--nue-padding-xs)` 简写覆写按钮内边距
 * ⇒ 预留被一并清掉 ⇒ 按钮内容（含 `#append` 日历图标）右移到最右，正好被清除键压住。
 *
 * 为什么只能源级断言：jsdom 无布局引擎，绝对定位不会产生任何可断言的几何重叠
 * （`getBoundingClientRect()` 恒为 0）⇒ 用「可疑写法消失 + 预留规则存在」两条不变量守。
 * 手法沿用 `apps/web/src/themes/__tests__/link-focus-ring.test.ts` 的 `?raw` glob + `sourceOf()`。
 * 像素观感由用户走查覆盖（转用户复看）。
 */

const sources = import.meta.glob(
    '/packages/presentation/task/components/date-selector/task-date-selector.vue',
    { query: '?raw', import: 'default', eager: true }
) as Record<string, string>

/** 断言命中且仅命中 1 个文件后返回其源文本（防 glob 写错 ⇒ 恒真/恒假空转） */
const sourceOf = (modules: Record<string, string>): string => {
    const values = Object.values(modules)
    expect(values.length, 'glob 应恰好命中 1 个文件').toBe(1)
    return values[0]!
}

/** 取 `start`（某条规则选择器的起始下标）之后第一对花括号内的文本，按深度配对以容纳嵌套 */
const blockAt = (source: string, start: number): string => {
    const open = source.indexOf('{', start)
    expect(open, '选择器后应有规则块').toBeGreaterThan(start)
    let depth = 0
    for (let i = open; i < source.length; i++) {
        if (source[i] === '{') depth++
        else if (source[i] === '}') {
            depth--
            if (depth === 0) return source.slice(open + 1, i)
        }
    }
    throw new Error('规则块未闭合')
}

/** 抽出源中所有 `.nue-button` 规则块（含 `&.nue-button--xxx` 变体） */
const buttonBlocks = (source: string): string[] => {
    const blocks: string[] = []
    const pattern = /\.nue-button\b[^{]*\{/g
    let matched: RegExpExecArray | null
    while ((matched = pattern.exec(source))) blocks.push(blockAt(source, matched.index))
    return blocks
}

/** 去掉全部空白，使 token 级断言不受换行/缩进影响 */
const compact = (text: string): string => text.replace(/\s+/g, '')

describe('DEF-129 ① · `.nue-button` 覆写不得用 padding 简写', () => {
    it('本文件所有 `.nue-button` 规则块内均无 `padding:` 简写（只允许 padding-* 长写）', () => {
        const source = sourceOf(sources)
        const blocks = buttonBlocks(source)

        // 前置：确实抓到了按钮覆写规则（否则下面的过滤恒真）
        expect(blocks.length, '应至少抽出 1 个 .nue-button 规则块').toBeGreaterThan(0)

        const offenders = blocks.filter((block) => /[{;\s]padding\s*:/.test(block))
        expect(
            offenders,
            `发现 padding 简写会清掉主题为清除键预留的 padding-right：${offenders.join(' | ')}`
        ).toEqual([])
    })

    it('日期选择器按钮的横向内边距改用 padding-block / padding-left / padding-right 长写', () => {
        const source = sourceOf(sources)
        const block = buttonBlocks(source)
            .map(compact)
            .find((item) => item.includes('width:100%'))

        expect(block, '应定位到日期选择器的按钮覆写块').toBeTruthy()
        expect(block!).toContain('padding-block:0')
        expect(block!).toContain('padding-left:var(--nue-padding-xs)')
        expect(block!).toContain('padding-right:var(--nue-padding-xs)')
    })
})

describe('DEF-129 ② · clearable 态显式恢复主题的 padding-right 预留', () => {
    it('存在 `.nue-date-picker__trigger--small.nue-date-picker__trigger--clearable .nue-button` 且值与上游同式', () => {
        const source = sourceOf(sources)
        const selector =
            '.nue-date-picker__trigger--small.nue-date-picker__trigger--clearable .nue-button'
        const start = source.indexOf(selector)

        expect(start, `未找到 clearable 预留规则：${selector}`).toBeGreaterThanOrEqual(0)

        // 与上游 `nue-ui-theme-shadlike/dist/components/date-picker.css` 的 size=small 档逐字同式
        // （`.nue-date-picker__trigger--small.nue-date-picker__trigger--clearable .nue-button`）
        expect(compact(blockAt(source, start))).toContain(
            'padding-right:calc(var(--nue-padding-xs)+var(--nue-gap-sm)+1.025*var(--nue-text-xs))'
        )
    })

    it('上述 `--small` 档与模板一致：本文件所有 clearable 的 `nue-date-picker` 都传 `size="small"`', () => {
        const source = sourceOf(sources)
        const tags = source.match(/<nue-date-picker\b[\s\S]*?\/>/g) ?? []
        const clearableTags = tags.filter((tag) => tag.includes('clearable'))

        expect(clearableTags.length, '应至少有 1 个 clearable 日期选择器').toBeGreaterThan(0)
        clearableTags.forEach((tag) => expect(compact(tag)).toContain('size="small"'))
    })
})