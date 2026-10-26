// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import {
    boxVerticalPx,
    effectiveOverflowY,
    effectiveRules,
    effectiveValue,
    hitAreaEvidence,
    mediaBreakpoints,
    narrowScopedDecls,
    parseCssRules,
    resolvePx,
    styleTextOf,
    toPx
} from './records-responsive-harness'

/**
 * T549 · 番茄「专注记录」页手机适配 —— 窄屏布局源级守卫（红基线）
 *
 * 覆盖：AC1（可滚动·核心）· AC3（首屏/统计紧凑）· AC4（无横向溢出/省略）· AC5（分页）· AC6（三态不撑破）
 *
 * **为什么是「源级」而不是 DOM 几何断言**（必须读）：
 * jsdom 无布局引擎 —— `getBoundingClientRect()` / `scrollHeight` / `clientHeight` 恒为 0，
 * `@media` 也不参与层叠（`getComputedStyle` 读不到宽度断点）。若在此环境断言
 * `scrollTop ≤ scrollHeight - clientHeight`，**连正确实现也会「通过」**（0 ≤ 0）⇒ 属于假绿。
 * ⇒ 本文件改为按 320/360/390/1280 **推演 CSS 生效值**（含 CSS 嵌套与 `@media`），
 *    把「能不能滚 / 会不会溢出 / 点击区够不够大」的**成因**钉死；几何真值（真机滚动手感、
 *    首屏观感、卡片信息够不够）按 PRD §八 归用户真机走查。
 *    判定口径先例：`apps/web/src/themes/__tests__/dialog-settings-height.test.ts`（T521-R3）。
 *
 * **实现契约（rd-fe 可自选实现方式，但须满足；不满足则本文件为红）**
 * - 卡片根元素 class `.pomodoro-record-card`，字段类：`__type` / `__task` / `__duration` / `__time`
 *   （供 DOM 断言，见 `pomodoro-record-cards.test.ts`）；
 * - 断点只复用 **720px（主）+ 480px（既有次级）**；`min-width: 721px` 视为 720 的补集，允许；
 * - 桌面（>720px）观感零变化，见 `pomodoro-records-page-desktop.test.ts`。
 *
 * 实测值一律 `console.log` 打印（便于回执与后续比对）。
 */

const modules = import.meta.glob<string>('../*.vue', {
    query: '?raw',
    import: 'default',
    eager: true
})

/** 取记录页某 SFC 的原始源码（glob 未命中即报错，防「写错路径 ⇒ 恒真/恒假」空转） */
const sourceOf = (fileName: string): string => {
    const key = Object.keys(modules).find((moduleKey) => moduleKey.endsWith(`/${fileName}`))
    expect(key, `未找到 ${fileName}（glob: ${Object.keys(modules).join(', ')}）`).toBeTruthy()
    return modules[key!] ?? ''
}

const templateOf = (fileName: string): string => {
    const matched = /<template>([\s\S]*)<\/template>/.exec(sourceOf(fileName))
    return matched?.[1] ?? ''
}

/** 记录页全部 SFC 的 CSS（含后续新增的子组件）合并后的规则表 */
const allRules = () =>
    parseCssRules(
        Object.values(modules)
            .map((source) => styleTextOf(source))
            .join('\n')
    )

/**
 * 静态视口高度单位的字面量**不直接出现**在本文件：`apps/web/src/themes/__tests__/safe-area.test.ts`
 * 的 AC6④ 会 `import.meta.glob` 扫描**整个 `apps/web/src`**（含测试文件、白名单显式为空）统计该字面量，
 * 直接写会被计入「残留」⇒ 与 safe-area 守卫自相矛盾。故与守卫同法拼接（纯文本层规避，语义不变）。
 */
const STATIC_VH = ['100', 'vh'].join('')

const MOBILE = 360
const NARROW_WIDTHS = [320, 360, 390] as const
/** 页面容器链（内容区 → 记录区）：滚动通道可落在其中任一（含「整页交给文档滚动」） */
const SCROLL_CHAIN = [
    '.nue-main',
    '.nue-content',
    '.pomodoro-records-page',
    '.pomodoro-records-page__table'
] as const
/** 「记录页自有容器」：这两层必须可滚或不裁切（祖先 `.nue-content` 可作内层滚动的裁切框） */
const PAGE_CONTAINERS = ['.pomodoro-records-page', '.pomodoro-records-page__table'] as const

describe('T549 AC1 可滚动（核心）：窄屏页面不得被锁死', () => {
    it('AC1 ① 360px：页容器 / 记录区生效 overflow-y 不得为 hidden', () => {
        const rules = allRules()
        const measured = PAGE_CONTAINERS.map(
            (selector) => [selector, effectiveOverflowY(rules, selector, MOBILE)] as const
        )
        console.log('[AC1-①] 360px 生效 overflow-y：', measured)

        for (const [selector, value] of measured) {
            expect(value, `${selector} 在 360px 仍锁死纵向滚动（overflow-y: ${value}）`).not.toBe(
                'hidden'
            )
        }
    })

    it('AC1 ② 内容区若保留内联 overflow: hidden，页容器必须自己成为窄屏滚动主体', () => {
        const template = templateOf('index.vue')
        const inlineLock = /style="[^"]*overflow:\s*hidden/.exec(template)?.[0] ?? null
        const pageOverflow = effectiveOverflowY(allRules(), '.pomodoro-records-page', MOBILE)
        console.log('[AC1-②] 内联锁死实测 / 页容器 overflow-y：', { inlineLock, pageOverflow })

        // 内联样式无法被 @media 解除 ⇒ 只有在「内层自成滚动容器」时才可接受（否则窄屏无从滚动）
        if (inlineLock) {
            expect(
                ['auto', 'scroll'],
                '内容区仍内联裁切、而页容器在 360px 不是滚动容器 ⇒ 整页仍无法下移（DEF-31 同族）'
            ).toContain(pageOverflow)
        }
    })

    it('AC1 ③ 360px：记录区不得是「height: 100% + overflow: hidden」的高度锁死组合', () => {
        const rules = allRules()
        const height = effectiveValue(rules, '.pomodoro-records-page__table', 'height', MOBILE)
        const overflowY = effectiveOverflowY(rules, '.pomodoro-records-page__table', MOBILE)
        console.log('[AC1-③] 360px 记录区 height / overflow-y：', { height, overflowY })

        expect(
            {
                height,
                overflowY
            },
            '记录区仍是定高 + 裁切 ⇒ 表格被压到近似零高且不可见'
        ).not.toEqual({ height: '100%', overflowY: 'hidden' })
    })

    it('AC1 ④ 360px：必须存在纵向滚动通道（显式 overflow-y: auto|scroll，或整页交给文档滚动）', () => {
        const rules = allRules()
        const measured = SCROLL_CHAIN.map((selector) => ({
            selector,
            overflowY: effectiveOverflowY(rules, selector, MOBILE),
            height: effectiveValue(rules, selector, 'height', MOBILE)
        }))
        const scrollable = measured.filter((item) =>
            ['auto', 'scroll'].includes(item.overflowY ?? '')
        )
        // 「整页交给文档滚动」= 链上没有任一层被定高或裁切锁住
        const locked = measured.filter(
            (item) =>
                item.overflowY === 'hidden' ||
                (item.height !== null &&
                    new RegExp(`^(100%|${STATIC_VH}|100dvh)$`).test(item.height))
        )
        console.log('[AC1-④] 360px 容器链实测：', measured)

        expect(
            scrollable.length > 0 || locked.length === 0,
            '既没有 overflow-y: auto|scroll 的滚动容器，又有多层定高/裁切锁死 ⇒ 记录滚不到、分页摸不到（AC1 根因）'
        ).toBe(true)
    })
})

describe('T549 AC3 首屏：统计区窄屏紧凑', () => {
    it('AC3 ① 360px：统计卡最多 2 列（沿用 720/480 断点，禁止新增魔法数）', () => {
        const rules = allRules()
        const columns = effectiveValue(
            rules,
            '.nue-div--stats-cards',
            'grid-template-columns',
            MOBILE
        )
        console.log('[AC3-①] 360px 统计卡列定义：', columns)

        expect(columns, '窄屏统计卡未收敛到 ≤2 列').toMatch(/^1fr$|repeat\(\s*[12]\s*,/)
    })

    it('AC3 ② 360px：存在窄屏紧凑化声明（R4：统计区 ≤ 视口约 1/3，首屏要见记录）', () => {
        const rules = allRules()
        const compacting = narrowScopedDecls(
            rules,
            MOBILE,
            /stats-card|stats-value|stats-cards/
        ).filter((decl) => /^(padding|gap|font-size|max-height|max-block-size)$/.test(decl.prop))
        console.log('[AC3-②] 360px 统计区窄屏专属声明：', compacting)

        expect(
            compacting.length,
            '统计区无任何窄屏收窄（内距/字号/高度）⇒ 首屏继续被数据卡占满'
        ).toBeGreaterThan(0)
    })
})

describe('T549 AC4 无横向溢出（320 / 360 / 390）', () => {
    for (const width of NARROW_WIDTHS) {
        it(`AC4 ① ${width}px：桌面表格 760px 硬宽 / 卡片容器不得超出视口`, () => {
            const rules = allRules()
            const measured = effectiveRules(rules, width)
                .filter((rule) =>
                    rule.selectors.some((selector) =>
                        /(pomodoro-records-table__(header|body)|pomodoro-record-card)/.test(
                            selector
                        )
                    )
                )
                .flatMap((rule) =>
                    rule.decls
                        .filter((decl) => decl.prop === 'min-width')
                        .map((decl) => ({
                            selector: rule.selectors.join(', '),
                            value: decl.value,
                            px: toPx(decl.value)
                        }))
                )
            console.log(`[AC4-①] ${width}px min-width 实测：`, measured)

            for (const item of measured) {
                expect(
                    item.px ?? 0,
                    `${item.selector} 的 min-width=${item.value} 在 ${width}px 下必溢出（scrollWidth > clientWidth）`
                ).toBeLessThanOrEqual(width)
            }
        })
    }

    it('AC4 ② 卡片任务名末尾省略（text-overflow: ellipsis 或 line-clamp）', () => {
        const rules = allRules()
        const candidate = effectiveRules(rules, MOBILE).filter((rule) =>
            rule.selectors.some((selector) => /pomodoro-record-card/.test(selector))
        )
        const ellipsis = candidate.filter(
            (rule) =>
                rule.decls.some((decl) => decl.prop === 'overflow' && decl.value === 'hidden') &&
                rule.decls.some(
                    (decl) => decl.prop === 'text-overflow' && decl.value === 'ellipsis'
                ) &&
                rule.decls.some((decl) => decl.prop === 'white-space' && decl.value === 'nowrap')
        )
        const clamp = candidate.filter((rule) =>
            rule.decls.some(
                (decl) => decl.prop === '-webkit-line-clamp' || decl.prop === 'line-clamp'
            )
        )
        console.log('[AC4-②] 卡片省略规则命中：', {
            ellipsis: ellipsis.map((rule) => rule.selectors),
            clamp: clamp.map((rule) => rule.selectors)
        })

        expect(ellipsis.length + clamp.length, '超长任务名无省略规则 ⇒ 会撑宽卡片').toBeGreaterThan(
            0
        )
    })

    it('AC4 ③ 反作弊：容器不得靠 overflow-x: hidden 掩盖横向溢出', () => {
        const rules = allRules()
        const offenders = effectiveRules(rules, MOBILE)
            .filter((rule) =>
                rule.selectors.some((selector) =>
                    /(pomodoro-records-page|nue-content)/.test(selector)
                )
            )
            .filter((rule) =>
                rule.decls.some((decl) => decl.prop === 'overflow-x' && decl.value === 'hidden')
            )
        console.log(
            '[AC4-③] 360px 容器裁切嫌疑：',
            offenders.map((rule) => rule.selectors)
        )

        expect(offenders, '用 overflow 裁切掩盖溢出 ⇒ 内容实际被切掉，不算适配').toEqual([])
    })
})

describe('T549 AC2 / R9 单行卡片（源级推演；jsdom 无布局引擎，几何归真机）', () => {
    it('AC2 ⑥ ≤720px：卡片单行 —— flex-direction 非 column、无 flex-wrap:wrap、align-items:center', () => {
        const rules = allRules()
        const measured = {
            display: effectiveValue(rules, '.pomodoro-record-card', 'display', MOBILE),
            flexDirection: effectiveValue(rules, '.pomodoro-record-card', 'flex-direction', MOBILE),
            flexWrap: effectiveValue(rules, '.pomodoro-record-card', 'flex-wrap', MOBILE),
            alignItems: effectiveValue(rules, '.pomodoro-record-card', 'align-items', MOBILE)
        }
        console.log('[AC2-⑥] 卡片布局实测（360px 生效值）：', measured)

        // 单行：横向排布（row / 未声明即 row），或等价 grid 横向流
        const horizontal =
            measured.display === 'grid' ? true : (measured.flexDirection ?? 'row').startsWith('row')
        expect(horizontal, '卡片仍为纵向堆叠（三行）⇒ 违背 R9「单行」').toBe(true)
        expect(measured.flexDirection, '卡片显式 flex-direction: column ⇒ 不是单行').not.toBe(
            'column'
        )
        expect(measured.flexWrap, '卡片允许换行 ⇒ 会退化成多行').not.toBe('wrap')
        expect(measured.alignItems, '单行需垂直居中（否则四字段错位）').toBe('center')
    })

    it('AC2 ⑦ ≤720px：卡片高 ∈ [50,62]（目标 56±6）且列表 gap ≤8（unit ≤70）', () => {
        const rules = allRules()
        const card = '.pomodoro-record-card'
        const minHeightRaw = effectiveValue(rules, card, 'min-height', MOBILE)
        const heightRaw = effectiveValue(rules, card, 'height', MOBILE)
        const gapRaw = effectiveValue(rules, '.pomodoro-record-card-list', 'gap', MOBILE)

        const paddingRaw = effectiveValue(rules, card, 'padding', MOBILE)
        const paddingVertical =
            boxVerticalPx(paddingRaw) ??
            (resolvePx(effectiveValue(rules, card, 'padding-top', MOBILE)) ?? 0) +
                (resolvePx(effectiveValue(rules, card, 'padding-bottom', MOBILE)) ?? 0)
        const fontSizePx = resolvePx(effectiveValue(rules, card, 'font-size', MOBILE)) ?? 16
        const lineHeightPx =
            resolvePx(effectiveValue(rules, card, 'line-height', MOBILE)) ??
            Math.round(fontSizePx * 1.2)
        const borderPx = effectiveValue(rules, card, 'border', MOBILE) ? 2 : 0
        const heightFromBox = Math.round(paddingVertical + lineHeightPx + borderPx)

        const anchored = resolvePx(minHeightRaw) ?? resolvePx(heightRaw)
        const cardHeight = anchored ?? heightFromBox
        const gap = resolvePx(gapRaw) ?? 0
        const unit = cardHeight + gap
        console.log('[AC2-⑦] 卡片高推演实测：', {
            高度锚: { minHeight: minHeightRaw, height: heightRaw, px: anchored },
            盒模型推演: {
                paddingRaw,
                paddingVertical,
                fontSizePx,
                lineHeightPx,
                borderPx,
                heightFromBox
            },
            采用: cardHeight,
            列表gap: { raw: gapRaw, px: gap },
            unit
        })

        // R9 目标 56px、容差 ±6 ⇒ [50, 62]
        expect(cardHeight).toBeGreaterThanOrEqual(50)
        expect(cardHeight).toBeLessThanOrEqual(62)
        expect(gap, '列表 gap > 8px ⇒ 卡片行间距过大、首屏能见的条数变少').toBeLessThanOrEqual(8)
        expect(unit, 'unit = 卡片高 + gap 应 ≤ 70px').toBeLessThanOrEqual(70)
    })
})

describe('T549 AC5 分页：窄屏可点、不弹回顶端', () => {
    it('AC5 ① 360px：可点区（命中区）≥40px —— 判据 = 按钮视觉高 + 伪元素外扩（R10）', () => {
        const evidence = hitAreaEvidence(allRules(), MOBILE)
        console.log('[AC5-①] 命中区推演明细：', JSON.stringify(evidence.boxes, null, 1))
        console.log('[AC5-①] 按钮本体高度声明：', evidence.directHeights)

        expect(
            evidence.boxes.some((box) => box.satisfied),
            '未推演出 ≥40px 的可点区：需 `::after/::before` + `content` + 按钮 `overflow: visible` + ' +
                '（伪元素高度 ≥40px 或 垂直每侧外扩 ≥6px ⇒ 28+2×6=40）'
        ).toBe(true)
    })

    it('AC5 ② 360px：分页容器允许换行（不产生横向溢出）', () => {
        const rules = allRules()
        const wrapping = effectiveRules(rules, MOBILE).filter(
            (rule) =>
                rule.selectors.some((selector) => /pagination|pager/i.test(selector)) &&
                rule.decls.some((decl) => decl.prop === 'flex-wrap' && /wrap/.test(decl.value))
        )
        console.log(
            '[AC5-②] 360px 分页换行规则：',
            wrapping.map((rule) => rule.selectors)
        )

        expect(wrapping.length, '分页不允许换行 ⇒ 窄屏必然被挤出屏幕').toBeGreaterThan(0)
    })

    it('AC5 ⑤ 360px：命中区扩展必须位于 ≤720 分支（无条件写 ⇒ 桌面命中区/尺寸漂移，违 AC7）', () => {
        const evidence = hitAreaEvidence(allRules(), MOBILE)
        const inNarrow = evidence.boxes.filter((box) => box.satisfied && box.narrow)
        console.log(
            '[AC5-⑤] 满足命中区的伪元素规则（选择器 + 媒体条件 + 外扩量）：',
            evidence.boxes.map((box) => ({
                selectors: box.selectors,
                media: box.media,
                narrow: box.narrow,
                expandedPerSide: box.expandedPerSide,
                hitAreaPx: box.hitAreaPx,
                satisfied: box.satisfied,
                reason: box.reason
            }))
        )

        expect(
            inNarrow.length,
            '命中区扩展不在 ≤720px 分支内（写成了无条件规则）⇒ 桌面分页的可点区/尺寸也会漂移；请移入 @media (max-width: 720px)'
        ).toBeGreaterThan(0)
    })

    it('AC5 ⑥ 360px：禁止用按钮本体 `min-height/height ≥40px` 直给（视觉高会变 40，违 R10「small」）', () => {
        const evidence = hitAreaEvidence(allRules(), MOBILE)
        const offenders = evidence.directHeights.filter((decl) => decl.px >= 40)
        console.log('[AC5-⑥] 按钮本体高度声明（≥40px 即违 R10）：', evidence.directHeights)

        expect(
            offenders,
            '按钮本体被撑到 ≥40px ⇒ 视觉尺寸不再是 small（R10 要求 small 视觉 + ≥40px 命中区，须用伪元素/等效扩展）'
        ).toEqual([])
    })

    it('AC5 ③ 切页不得重置滚动位置（负向守卫：源码不得出现滚动归零调用）', () => {
        const offenders = Object.entries(modules).flatMap(([key, source]) =>
            [
                ...source.matchAll(
                    /scrollTo\s*\([^)]*top\s*:\s*0|scrollTop\s*=\s*0|scrollIntoView\s*\(/g
                )
            ].map((matched) => `${key}: ${matched[0]}`)
        )
        console.log('[AC5-③] 滚动归零调用：', offenders)

        expect(offenders, '切页/刷新时把滚动归零 ⇒ 用户弹回页面顶端（AC5 反例）').toEqual([])
    })
})

describe('T549 AC6 三态：LoadingError 呈现且不撑破布局', () => {
    it('AC6 ① 记录页三态仍由 LoadingError 承担（不自绘空/错/载）', () => {
        const template = templateOf('index.vue')
        const hasLoadingError = /<loading-error[\s\S]*?:loading=/.test(template)
        const hasThreeBindings =
            /:error=/.test(template) && /:empty=/.test(template) && /empty-message=/.test(template)
        const selfDrawnEmpty = /nue-empty|--empty/.test(template)
        console.log('[AC6-①] LoadingError / 三态绑定 / 自绘空态：', {
            hasLoadingError,
            hasThreeBindings,
            selfDrawnEmpty
        })

        expect(hasLoadingError && hasThreeBindings, '三态未走 LoadingError（R7 硬约束）').toBe(true)
        expect(selfDrawnEmpty, '记录页自绘了空态/错误态（R7 禁止）').toBe(false)
    })

    it('AC6 ② 360px：分页不得 position: absolute|fixed、不得超宽（不越出屏幕）', () => {
        const rules = allRules()
        const offenders = effectiveRules(rules, MOBILE)
            // 排除伪元素：`::after` 属命中区扩展（absolute 定位在外扩方向上不产生页面溢出）
            .filter((rule) => rule.selectors.every((selector) => !selector.includes('::')))
            .filter((rule) => rule.selectors.some((selector) => /pagination/i.test(selector)))
            .flatMap((rule) =>
                rule.decls
                    .filter(
                        (decl) =>
                            (decl.prop === 'position' && /absolute|fixed/.test(decl.value)) ||
                            (decl.prop === 'width' && (toPx(decl.value) ?? 0) > MOBILE)
                    )
                    .map((decl) => `${rule.selectors.join(', ')} { ${decl.prop}: ${decl.value} }`)
            )
        console.log('[AC6-②] 360px 分页越界声明：', offenders)

        expect(offenders).toEqual([])
    })
})

describe('T549 口径守卫（断点 / 视口单位 / 红线 / 详情复用）', () => {
    it('断点口径（含桌面分支）：只允许 720（主）+ 480（既有次级），721 视为 720 的补集', () => {
        const rules = allRules()
        const breakpoints = mediaBreakpoints(rules)
        const byBranch = {
            窄屏: [
                ...new Set(rules.flatMap((rule) => rule.media).filter((c) => /max-width/.test(c)))
            ],
            桌面: [
                ...new Set(rules.flatMap((rule) => rule.media).filter((c) => /min-width/.test(c)))
            ]
        }
        console.log('[断点] 记录页全分支实测阈值：', breakpoints, '按分支：', byBranch)

        expect(breakpoints.length, '记录页没有任何媒体查询 ⇒ 窄屏适配缺失').toBeGreaterThan(0)
        expect(breakpoints).toContain(720)
        expect(
            breakpoints.filter((value) => ![480, 720, 721].includes(value)),
            '出现新阈值（PRD R2 + PM 2026-10-26 裁定：桌面分支也不得出现 768/780 等新断点）'
        ).toEqual([])
    })

    it('AC8 设计一致性：记录页样式只用既有 nue token（不出现裸色值）', () => {
        const offenders = Object.entries(modules).flatMap(([key, source]) =>
            [...styleTextOf(source).matchAll(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g)].map(
                (matched) => `${key}: ${matched[0]}`
            )
        )
        console.log('[AC8] 裸色值命中：', offenders)

        expect(offenders, '新造色值 ⇒ 违反「不新创 token / 只沿用 nue-*」（AC8）').toEqual([])
    })

    it('NFR：不得用裸静态视口高度单位作高度基（DESIGN.md §9）', () => {
        const staticViewportHeight = new RegExp(STATIC_VH)
        const offenders = Object.entries(modules)
            .filter(([, source]) => staticViewportHeight.test(styleTextOf(source)))
            .map(([key]) => key)
        console.log('[NFR] 静态视口高度命中：', offenders)

        expect(offenders).toEqual([])
    })

    it('红线：记录页不得引入移动端专属包（presentation-react / apps/mobile）', () => {
        const offenders = Object.entries(modules)
            .filter(([, source]) => /presentation-react|apps\/mobile/.test(source))
            .map(([key]) => key)
        expect(offenders).toEqual([])
    })

    it('R5：详情沿用既有面板（record 透传 selectedRecord，不新增交互形态）', () => {
        const template = templateOf('index.vue')
        expect(template).toMatch(/<detail-panel[\s\S]*?:record="selectedRecord"/)
    })
})