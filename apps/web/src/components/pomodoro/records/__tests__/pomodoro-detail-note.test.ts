// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { nueUI } from '@/nue-ui-register'
import DetailPanel from '../detail-panel.vue'
import {
    effectiveRules,
    parseCssRules,
    resolvePx,
    setViewport,
    styleTextOf,
    stubResizeObserver
} from './records-responsive-harness'

/**
 * T549 · R14 / AC11 —— 详情抽屉「笔记」区（与既有 48 例并列，+2 例）
 *
 * ① **标签与条件渲染**（真实挂载，禁 stub）：有笔记 ⇒ 存在文本**恰为「笔记」**的标签 + 正文；
 *    无笔记 ⇒ 标签与正文**都不渲染**（与 `v-if="record.note"` 同条件，防「空笔记仍留标签」）。
 * ② **正文规格**（源级推演 + token 解析，打印命中选择器与解析值）：
 *    `font-size` = **14px（`--nue-text-sm`）**（**不是** 16px —— 16px = 当前继承值，写了也「视觉毫无变化」⇒ 判红）；
 *    `line-height` 无单位 ≥1.6 或 px ≥22.4（1.6×14）；`white-space: pre-wrap`（或 pre-line / break-spaces）；
 *    **`overflow-wrap` 或 `word-break` 至少一个**（R14③「不撑破抽屉」：长无空格串/URL 必须可断）；
 *    ≤480 无横向溢出成因（无 `min-width ≥320px`、无 `overflow-x: hidden` 掩盖）。
 * **两档都验**（360 与 1280）且**不绑窄屏分支** —— R14 是全局修正，与 R13 的「>480 零变化」只涉宽度/Esc 不冲突。
 */

const MOBILE = 360
const DESKTOP = 1280
const NOTE_TEXT =
    '第一行笔记\n第二行 很长很长的一段文字 https://example.com/a/very/long/path/without/any/spaces'

const baseRecord = {
    id: 'r1',
    sessionId: 's1',
    type: 1,
    startAt: '2026-10-01T10:00:00.000Z',
    endAt: '2026-10-01T10:25:00.000Z',
    duration: 1500,
    pomodoroId: 'p1',
    taskId: 't1',
    taskName: '任务 1',
    description: '',
    note: '',
    createdAt: '',
    updatedAt: '',
    deletedAt: null
}

let restoreViewport: (() => void) | null = null
let wrapper: VueWrapper | null = null

beforeAll(() => {
    stubResizeObserver()
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    restoreViewport?.()
    restoreViewport = null
    document.body.innerHTML = ''
})

afterAll(() => {
    restoreViewport?.()
})

/** 打开抽屉（先隐藏再 setProps：NueDrawer 的 watcher 才会把 `data-visible` 翻为 true） */
const openDrawer = async (width: number, note: string): Promise<VueWrapper> => {
    wrapper?.unmount()
    document.body.innerHTML = ''
    restoreViewport?.()
    restoreViewport = setViewport(width)
    const target = mount(DetailPanel, {
        props: {
            visible: false,
            record: { ...baseRecord, note } as never,
            pomodoros: [{ id: 'p1', name: '模板A' }] as never
        },
        global: { plugins: [nueUI] },
        attachTo: document.body
    })
    wrapper = target
    await flushPromises()
    await target.setProps({ visible: true })
    await flushPromises()
    await nextTick()
    return target
}

// ====================================
// DOM 判据（纯函数，便于自检反例复用）
// ====================================

/** 文本**恰为** `text` 的叶子元素（标签判定不绑 class，只认文案） */
const exactTextElements = (root: ParentNode, text: string): Element[] =>
    [...root.querySelectorAll('*')].filter(
        (element) => element.children.length === 0 && (element.textContent ?? '').trim() === text
    )

/** 笔记正文字面元素（优先专用类；回落容器类） */
const noteBodyOf = (root: ParentNode): HTMLElement | null =>
    (root.querySelector('.pomodoro-records-detail__note-text') as HTMLElement | null) ??
    (root.querySelector('.pomodoro-records-detail__note') as HTMLElement | null)

describe('T549 AC11 ① 笔记标签存在 / 无笔记不渲染（真实挂载 @360 与 @1280）', () => {
    it('AC11 ① 有笔记 ⇒ 标签「笔记」+ 正文可见；无笔记 ⇒ 两者都不渲染', async () => {
        const measured: Record<string, unknown> = {}

        for (const width of [MOBILE, DESKTOP]) {
            // —— 有笔记 ——
            await openDrawer(width, NOTE_TEXT)
            const labels = exactTextElements(document.body, '笔记')
            const body = noteBodyOf(document.body)
            const withNote = {
                labelCount: labels.length,
                labelSelector: labels.map((element) => `${element.tagName}.${element.className}`),
                hasNoteBody: body !== null,
                noteText: (body?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60)
            }

            // —— 无笔记 ——
            await openDrawer(width, '')
            const emptyLabels = exactTextElements(document.body, '笔记')
            const emptyBody = noteBodyOf(document.body)
            const withoutNote = {
                labelCount: emptyLabels.length,
                hasNoteBody: emptyBody !== null
            }

            measured[`${width}px`] = { withNote, withoutNote }
        }

        console.log('[AC11-①] 标签/条件渲染实测：', JSON.stringify(measured, null, 1))

        for (const [width, value] of Object.entries(measured)) {
            const { withNote, withoutNote } = value as {
                withNote: { labelCount: number; hasNoteBody: boolean; noteText: string }
                withoutNote: { labelCount: number; hasNoteBody: boolean }
            }
            expect(
                withNote.labelCount,
                `${width}：有笔记却找不到文本恰为「笔记」的标签`
            ).toBeGreaterThan(0)
            expect(withNote.hasNoteBody, `${width}：有笔记却无正文节点`).toBe(true)
            expect(withNote.noteText.length, `${width}：笔记正文为空`).toBeGreaterThan(0)
            expect(withoutNote.labelCount, `${width}：无笔记仍渲染「笔记」标签`).toBe(0)
            expect(withoutNote.hasNoteBody, `${width}：无笔记仍渲染正文节点`).toBe(false)
        }
    })
})

// ====================================
// 源级判据
// ====================================

const sources = import.meta.glob<string>('../*.vue', {
    query: '?raw',
    import: 'default',
    eager: true
})

const detailPanelRules = () => {
    const key = Object.keys(sources).find((moduleKey) => moduleKey.endsWith('/detail-panel.vue'))
    expect(key, '未找到 detail-panel.vue').toBeTruthy()
    return parseCssRules(styleTextOf(sources[key!] ?? ''))
}

/** `line-height` 解析：无单位倍数 / px / rem（`resolvePx` 会把裸数字当 px，故此处单独判） */
const parseLineHeight = (
    value: string | null | undefined
): { kind: 'ratio'; ratio: number } | { kind: 'px'; px: number } | null => {
    if (!value) return null
    const text = value.trim()
    const ratio = /^(\d+(?:\.\d+)?)$/.exec(text)
    if (ratio) return { kind: 'ratio', ratio: Number(ratio[1]) }
    const px = /^(\d+(?:\.\d+)?)px$/.exec(text)
    if (px) return { kind: 'px', px: Number(px[1]) }
    const rem = /^(\d+(?:\.\d+)?)rem$/.exec(text)
    if (rem) return { kind: 'px', px: Number(rem[1]) * 16 }
    return null
}

/** 笔记正文候选选择器（优先专用类；回落容器类） */
const NOTE_TARGETS = ['.pomodoro-records-detail__note-text', '.pomodoro-records-detail__note']

/** 逐候选取第一条显式声明（打印命中层级，供失败定位） */
const declarationOf = (
    rules: ReturnType<typeof parseCssRules>,
    prop: string,
    width: number,
    targets: string[] = NOTE_TARGETS
): { target: string; value: string; px: number | null } | null => {
    for (const target of targets) {
        const decls = effectiveRules(rules, width)
            .filter((rule) => rule.selectors.some((selector) => selector.endsWith(target)))
            .flatMap((rule) => rule.decls)
            .filter((decl) => decl.prop === prop)
        if (decls.length > 0) {
            const last = decls[decls.length - 1]!
            return { target, value: last.value, px: resolvePx(last.value) }
        }
    }
    return null
}

type NoteSpecMeasured = {
    fontSize: { target: string; value: string; px: number | null } | null
    lineHeight: { target: string; value: string; px: number | null } | null
    whiteSpace: { target: string; value: string } | null
    overflowWrap: { target: string; value: string } | null
    wordBreak: { target: string; value: string } | null
    horizontalCauses: string[]
}

/** 笔记正文规格测量（②③ 共用同一份测量，避免口径漂移） */
const measureNoteSpec = (
    rules: ReturnType<typeof parseCssRules>,
    width: number
): NoteSpecMeasured => ({
    fontSize: declarationOf(rules, 'font-size', width),
    lineHeight: declarationOf(rules, 'line-height', width),
    whiteSpace: declarationOf(rules, 'white-space', width),
    overflowWrap: declarationOf(rules, 'overflow-wrap', width),
    wordBreak: declarationOf(rules, 'word-break', width),
    horizontalCauses: effectiveRules(rules, width)
        .filter((rule) =>
            rule.selectors.some((selector) => /pomodoro-records-detail__note/.test(selector))
        )
        .flatMap((rule) =>
            rule.decls
                .filter(
                    (decl) =>
                        (decl.prop === 'min-width' && (resolvePx(decl.value) ?? 0) >= 320) ||
                        (decl.prop === 'overflow-x' && decl.value === 'hidden')
                )
                .map((decl) => `${rule.selectors.join(', ')} { ${decl.prop}: ${decl.value} }`)
        )
})

/** 笔记正文规格断言（单一事实来源：②「正文规格」与 ③「去装饰后正文仍达标」共用） */
const assertNoteSpec = (
    rules: ReturnType<typeof parseCssRules>,
    width: number,
    tag: string
): NoteSpecMeasured => {
    const measured = measureNoteSpec(rules, width)
    const where = `${width}${tag}`

    // ① font-size 必须显式 = 14px（16px = 原继承值，等于没改）
    expect(
        measured.fontSize,
        `${where}：笔记正文未显式声明 font-size —— 请显式声明 font-size: var(--nue-text-sm)（与其它字段值一致）；继承不可证明，且上层变动会静默回退`
    ).not.toBeNull()
    expect(
        measured.fontSize!.px,
        `${where}：笔记字号为 ${measured.fontSize!.value}（${measured.fontSize!.px}px），应显式声明 font-size: var(--nue-text-sm)（=14px，与其它字段值一致）`
    ).toBe(14)

    // ② line-height：无单位 ≥1.6；px/rem ≥ 1.6×14 = 22.4
    expect(measured.lineHeight, `${where}：笔记正文未声明 line-height`).not.toBeNull()
    const lineHeight = parseLineHeight(measured.lineHeight!.value)
    expect(
        lineHeight,
        `${where}：line-height=${measured.lineHeight!.value} 无法解析`
    ).not.toBeNull()
    if (lineHeight!.kind === 'ratio') {
        expect(
            lineHeight!.ratio,
            `${where}：line-height=${measured.lineHeight!.value} < 1.6`
        ).toBeGreaterThanOrEqual(1.6)
    } else {
        expect(
            lineHeight!.px,
            `${where}：line-height=${measured.lineHeight!.value} < 22.4px（1.6×14）`
        ).toBeGreaterThanOrEqual(22.4)
    }

    // ③ white-space 保留换行
    expect(
        ['pre-wrap', 'pre-line', 'break-spaces'],
        `${where}：笔记正文 white-space=${measured.whiteSpace?.value ?? '(未声明)'}，需 pre-wrap 等以保留用户换行`
    ).toContain(measured.whiteSpace?.value)

    // ④ 长无空格串（URL / 英文 token）必须可断
    expect(
        measured.overflowWrap !== null || measured.wordBreak !== null,
        `${where}：笔记正文既无 overflow-wrap 也无 word-break ⇒ 长无空格串会撑破抽屉（R14③）`
    ).toBe(true)

    // ⑤ 无横向溢出成因
    expect(measured.horizontalCauses, `${where}：笔记元素出现横向溢出成因`).toEqual([])

    return measured
}

describe('T549 AC11 ② 笔记正文规格：14px / 行高 ≥1.6 / pre-wrap / 可断长串 / 不溢出', () => {
    it('AC11 ② 360 与 1280：font-size=14px（--nue-text-sm）、行高 ≥1.6、white-space 与 overflow-wrap 齐备', () => {
        const rules = detailPanelRules()
        const measured: Record<string, NoteSpecMeasured> = {}
        for (const width of [MOBILE, DESKTOP]) {
            measured[`${width}px`] = assertNoteSpec(rules, width, '')
        }
        console.log('[AC11-②] 笔记正文规格实测（360 / 1280）：', JSON.stringify(measured, null, 1))
    })
})

describe('T549 AC11 ③ 笔记去装饰容器（与其它字段同样式，双档 360 / 1280）', () => {
    /** 容器（`.pomodoro-records-detail__note`）禁止出现的装饰性声明 */
    const DECORATION_PROP =
        /^(padding|padding-[a-z-]+|background|background-color|background-[a-z-]+|border-radius|border-(top|bottom|left|right)-(left|right)-radius)$/

    it('AC11 ③ 360 与 1280：容器无 padding/背景/圆角；正文仍达标且左对齐（不得 right/end）', () => {
        const rules = detailPanelRules()
        const measured: Record<string, unknown> = {}

        for (const width of [MOBILE, DESKTOP]) {
            const containerRules = effectiveRules(rules, width).filter((rule) =>
                rule.selectors.some((selector) =>
                    selector.endsWith('.pomodoro-records-detail__note')
                )
            )
            const decorations = containerRules.flatMap((rule) =>
                rule.decls
                    .filter((decl) => DECORATION_PROP.test(decl.prop))
                    .map((decl) => `${rule.selectors.join(', ')} { ${decl.prop}: ${decl.value} }`)
            )
            const containerDecls = containerRules.flatMap((rule) =>
                rule.decls.map((decl) => `${decl.prop}: ${decl.value}`)
            )

            // 正文仍须达标（与 ② 同一份断言函数）
            const spec = assertNoteSpec(rules, width, '（去装饰后）')

            // 正文左对齐：不得 right / end；未声明 ⇒ 继承默认（左），通过并打印
            const textAlign = declarationOf(rules, 'text-align', width)
            const alignValue = textAlign?.value.replace('!important', '').trim()
            console.log(`[AC11-③] ${width}px 实测：`, {
                containerRuleCount: containerRules.length,
                containerDecls,
                decorations,
                textAlign: textAlign ?? '(未声明 ⇒ 继承默认左对齐)',
                spec
            })

            expect(
                decorations,
                `${width}：笔记容器仍带装饰（padding/背景/圆角）⇒ 应与其它字段同样式（R14⑤）`
            ).toEqual([])
            if (alignValue !== undefined) {
                expect(
                    ['right', 'end'],
                    `${width}：笔记正文 text-align=${alignValue} ⇒ 长笔记右对齐难读（须左对齐或继承默认）`
                ).not.toContain(alignValue)
            }

            measured[`${width}px`] = {
                containerRuleCount: containerRules.length,
                decorations,
                textAlign: alignValue ?? '(未声明)'
            }
        }

        console.log('[AC11-③] 去装饰 / 对齐实测汇总：', JSON.stringify(measured, null, 1))
    })
})