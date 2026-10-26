// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { nueUI } from '@/nue-ui-register'
import DetailPanel from '../detail-panel.vue'
import {
    effectiveRules,
    hitAreaEvidence,
    narrowScopedDecls,
    parseCssRules,
    resolvePx,
    setViewport,
    styleTextOf,
    stubResizeObserver
} from './records-responsive-harness'

/**
 * T549 · R13 / AC10 —— 专注记录详情抽屉 ≤480px 全宽（与既有 42 例并列）
 *
 * 覆盖：① ≤480 全宽 ② >480 不变（含「全宽只在 ≤480」+「非 scoped 块只含本抽屉命名空间」+
 *        「`records-full` 全仓单点引用」）③a ✕ 命中区 ≥40px ③b Esc 关闭 ④ ≤480 抽屉无横向溢出成因
 *       ⑤ >480 遮罩点击**仍不可关**（钉住 `allowCloseByOverlay` 未被改成无条件）
 *
 * 取证方式（遵循 `AGENTS.md`「前端验证纪律」2026-10-23：禁 stub 推断）：
 * - 真实挂载 `DetailPanel`（真 `NueDrawer`、真 Teleport、真 overlay），
 *   `nue-drawer` / `nue-overlay` 可能被 Teleport 到 body ⇒ **wrapper 与 `document.body` 双路取节点**；
 * - 全宽三路径按生效证据判定：props（内联 `--nue-drawer-span: 100%`）/ `width: 100%` / `--nue-drawer-span: 100% !important`；
 * - jsdom 无动画 ⇒ 关闭判定取「`update:visible` 收到 false」**或**「`.nue-drawer[data-visible]` 翻为 false」（二者其一）。
 *
 * 断点只用既有 480（PRD R2 允许集 {480,720,721}）。
 */

const VIEWPORT_NARROW = 360
/** 480 的补集（>480 的第一档） */
const VIEWPORT_JUST_ABOVE = 481
const DESKTOP = 1280

const RECORD = {
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
    note: '备注',
    createdAt: '',
    updatedAt: '',
    deletedAt: null
}
const POMODOROS = [{ id: 'p1', name: '模板A' }]

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

const mountDrawer = async (width: number, visible = true): Promise<VueWrapper> => {
    restoreViewport?.()
    restoreViewport = setViewport(width)
    wrapper = mount(DetailPanel, {
        props: {
            visible: false,
            record: RECORD as never,
            pomodoros: POMODOROS as never
        },
        global: { plugins: [nueUI] },
        attachTo: document.body
    })
    await flushPromises()
    if (visible) {
        // 先隐藏再打开 ⇒ 触发抽屉的 modelValue watcher（NueDrawer 的 `data-visible` 才会翻为 true；
        // 直接以 visible:true 挂载时 watcher 不触发、`data-visible` 恒 false ⇒ 会让「关闭」判定假绿）
        await wrapper.setProps({ visible: true })
        await flushPromises()
        await nextTick()
    }
    return wrapper
}

/** 打开抽屉并断言前置态（避免「本来就是 false ⇒ 关闭判定假绿」） */
const openDrawer = async (width: number): Promise<VueWrapper> => {
    const target = await mountDrawer(width)
    const dataVisible = drawerOf(target)?.getAttribute('data-visible')
    expect(dataVisible, `${width}px 抽屉未进入可见态（data-visible 应为 true）`).toBe('true')
    return target
}

/** 真实 DOM 取节点：Teleport 到 body 时 `wrapper.find` 取不到，回落到 `document.body` */
const findReal = (target: VueWrapper, selector: string): HTMLElement | null => {
    const inWrapper = target.find(selector)
    if (inWrapper.exists()) return inWrapper.element as HTMLElement
    return (document.body.querySelector(selector) as HTMLElement | null) ?? null
}

const drawerOf = (target: VueWrapper) => findReal(target, '.nue-drawer')
const overlayOf = (target: VueWrapper) => findReal(target, '.nue-overlay')

/** 关闭判定：`update:visible` 收到 false，或 `data-visible` 由 true 翻为 false（jsdom 无动画，二者取其一） */
const isClosed = (target: VueWrapper): boolean => {
    const emitted = target.emitted('update:visible') ?? []
    const emittedFalse = emitted.some((payload) => payload[0] === false)
    const dataVisible = drawerOf(target)?.getAttribute('data-visible')
    return emittedFalse || dataVisible === 'false'
}

// ====================================
// 源级证据
// ====================================

const sources = import.meta.glob<string>('../*.vue', {
    query: '?raw',
    import: 'default',
    eager: true
})

const sourceOf = (fileName: string): string => {
    const key = Object.keys(sources).find((moduleKey) => moduleKey.endsWith(`/${fileName}`))
    expect(key, `未找到 ${fileName}`).toBeTruthy()
    return sources[key!] ?? ''
}

const detailPanelRules = () => parseCssRules(styleTextOf(sourceOf('detail-panel.vue')))

/** 非 scoped `<style>` 块（抽屉 Teleport 到 body，scoped 选择器够不到其内部） */
const nonScopedCss = (): string[] =>
    [...sourceOf('detail-panel.vue').matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/g)]
        .filter((block) => !/scoped/.test(block[1] ?? ''))
        .map((block) => block[2] ?? '')

/** 「本抽屉唯一命名空间」—— 用拼接避免本文件被全仓文本扫描命中 */
const DRAWER_NAMESPACE = ['nue-drawer', 'records-full'].join('--')

describe('T549 AC10 ① ≤480px：详情抽屉全宽（真实挂载 + 源级三路径）', () => {
    it('AC10 ① 360px：抽屉宽度 = 视口（props 内联 span / width:100% / span:100% !important 三选一）', async () => {
        const target = await mountDrawer(VIEWPORT_NARROW)
        const drawer = drawerOf(target)
        expect(
            drawer,
            '未在 wrapper / document.body 找到 `.nue-drawer`（Teleport 取节点失败）'
        ).not.toBeNull()

        const inlineSpan = drawer!.style.getPropertyValue('--nue-drawer-span').trim()
        const inlineMinSpan = drawer!.style.getPropertyValue('--nue-drawer-min-span').trim()

        const rules = detailPanelRules()
        const narrowDecls = narrowScopedDecls(rules, 480, /nue-drawer/)
        const cssWidth = narrowDecls.find(
            (decl) =>
                decl.prop === 'width' && /^100%$/.test(decl.value.replace('!important', '').trim())
        )
        const cssSpan = narrowDecls.find(
            (decl) => decl.prop === '--nue-drawer-span' && decl.value.startsWith('100%')
        )

        const path =
            inlineSpan === '100%'
                ? 'props（内联 --nue-drawer-span: 100%）'
                : cssWidth
                  ? 'width: 100%（≤480 CSS）'
                  : cssSpan
                    ? `--nue-drawer-span: 100%（≤480 CSS${/!important/.test(cssSpan.value) ? ' + !important' : ' ⚠ 无 !important'}）`
                    : null

        console.log('[AC10-①] 全宽证据：', {
            inlineSpan,
            inlineMinSpan,
            css: { width: cssWidth, span: cssSpan },
            adoptedPath: path
        })

        expect(
            path,
            '≤480px 未达成全宽：既无 props 内联 span=100%，也无 ≤480 的 width/span 覆盖'
        ).not.toBeNull()
        // 若走 CSS 覆盖 span 而没有 !important ⇒ 会被内联自定义属性压住（静默失效）
        if (
            !inlineSpan.startsWith('100') &&
            cssSpan &&
            !/!important/.test(cssSpan.value) &&
            !cssWidth
        ) {
            expect.fail(
                '`--nue-drawer-span: 100%` 缺 `!important` ⇒ 被 NueDrawer 的内联自定义属性压住（扩展静默失效）'
            )
        }
        // min-span 不得超出最小支持视口（320px），否则窄屏仍会被撑出横向滚动
        const minSpanPx = resolvePx(inlineMinSpan)
        if (minSpanPx !== null) {
            expect(
                minSpanPx,
                `min-span=${inlineMinSpan} 超过 320px 最小支持视口`
            ).toBeLessThanOrEqual(320)
        }
    })
})

describe('T549 AC10 ② >480px：尺寸与行为保持现状', () => {
    it('AC10 ② 481/1280px：span 仍 36% + 全宽只在 ≤480 + 非 scoped 块仅本命名空间（且全仓单点）', async () => {
        const measured: Record<string, { span: string; minSpan: string }> = {}
        for (const width of [VIEWPORT_JUST_ABOVE, DESKTOP]) {
            const target = await openDrawer(width)
            const drawer = drawerOf(target)
            expect(drawer, `${width}px 未找到 .nue-drawer`).not.toBeNull()
            measured[`${width}px`] = {
                span: drawer!.style.getPropertyValue('--nue-drawer-span').trim(),
                minSpan: drawer!.style.getPropertyValue('--nue-drawer-min-span').trim()
            }
            target.unmount()
            wrapper = null
        }

        const rules = detailPanelRules()
        const fullWidthRules = rules
            .filter((rule) =>
                rule.decls.some(
                    (decl) =>
                        (decl.prop === 'width' && decl.value.startsWith('100%')) ||
                        (decl.prop === '--nue-drawer-span' && decl.value.startsWith('100%'))
                )
            )
            .map((rule) => ({ selectors: rule.selectors, media: rule.media }))
        const leaking = fullWidthRules.filter(
            (item) => !item.media.some((condition) => /max-width:\s*480px/.test(condition))
        )
        console.log('[AC10-②] >480 内联 span / 全宽规则所在媒体块：', { measured, fullWidthRules })

        for (const [width, value] of Object.entries(measured)) {
            expect(
                value.span,
                `${width} 的 span 被改成全宽 ⇒ 改了桌面/平板行为（应为 36% = 现状）`
            ).toBe('36%')
        }
        expect(leaking, '全宽声明逸出 ≤480 媒体块 ⇒ 会影响 >480').toEqual([])

        // —— PM 额外要求的两点独立复核（并入本用例，保持 48 例口径）——
        const blocks = nonScopedCss()
        expect(
            blocks.length,
            '未找到非 scoped `<style>` 块（抽屉 Teleport 后的命中区规则无处安放）'
        ).toBeGreaterThan(0)

        const nonScopedRules = parseCssRules(blocks.join('\n'))
        const outsideNamespace = nonScopedRules
            .flatMap((rule) => rule.selectors)
            .filter((selector) => !selector.startsWith(`.${DRAWER_NAMESPACE}`))
        console.log(
            '[AC10-②′] 非 scoped 规则选择器：',
            nonScopedRules.flatMap((rule) => rule.selectors)
        )

        expect(
            outsideNamespace,
            '非 scoped 块出现本抽屉命名空间以外的选择器 ⇒ 会外溢影响其它抽屉/页面'
        ).toEqual([])

        // 命名空间全仓仅本组件使用（排除测试目录，避免本文件自指）
        const repoModules: Record<string, string> = {
            ...(import.meta.glob<string>('/apps/web/src/**/*.{ts,vue}', {
                query: '?raw',
                import: 'default',
                eager: true
            }) as Record<string, string>),
            ...(import.meta.glob<string>('/packages/**/*.{ts,vue}', {
                query: '?raw',
                import: 'default',
                eager: true
            }) as Record<string, string>)
        }
        const offenders = Object.entries(repoModules)
            .filter(([path]) => !path.includes('__tests__'))
            .filter(([path]) => !path.endsWith('/records/detail-panel.vue'))
            .filter(([, source]) => source.includes(DRAWER_NAMESPACE))
            .map(([path]) => path)
        console.log('[AC10-②′] 命名空间外部引用：', offenders)

        expect(offenders, '`records-full` 命名空间在其它文件被引用 ⇒ 不是本抽屉独有').toEqual([])
    })
})

describe('T549 AC10 ③ 两条关闭路径', () => {
    it('AC10 ③a ≤480px：✕ 命中区 ≥40px（伪元素扩展 + overflow:visible，仅窄屏分支）', () => {
        const rules = detailPanelRules()
        const evidence = hitAreaEvidence(rules, 480, {
            selectorPattern: new RegExp(DRAWER_NAMESPACE)
        })
        console.log(
            '[AC10-③a] ✕ 命中区推演：',
            JSON.stringify(
                { boxes: evidence.boxes, directHeights: evidence.directHeights },
                null,
                1
            )
        )

        const satisfied = evidence.boxes.filter((box) => box.satisfied && box.narrow)
        expect(
            satisfied.length,
            '✕ 未推演出 ≥40px 命中区（需 ≤480 分支内 `::after/::before` + content + 按钮 overflow:visible + 每侧 ≥6px）'
        ).toBeGreaterThan(0)
        expect(
            evidence.directHeights.filter((decl) => decl.narrow && decl.px >= 40),
            '✕ 按钮本体被撑到 ≥40px ⇒ 视觉不再是 28px icon 按钮'
        ).toEqual([])
    })

    it('AC10 ③b 360px：Esc 关闭抽屉（overlay 原生 keydown.esc；兜底 document 派发）', async () => {
        const target = await openDrawer(VIEWPORT_NARROW)
        const overlay = overlayOf(target)
        expect(overlay, '未找到 `.nue-overlay`（Teleport 取节点失败）').not.toBeNull()

        const before = drawerOf(target)?.getAttribute('data-visible')
        let viaPath = 'overlay-keydown'

        // 路径 1：NueOverlay 自身的 `@keydown.esc`（组件原生路径）
        overlay!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        await flushPromises()
        await nextTick()

        if (!isClosed(target)) {
            // 路径 2：兜底 —— rd-fe 若自挂 document/window 监听
            viaPath = 'document-keydown'
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
            await flushPromises()
            await nextTick()
        }

        console.log('[AC10-③b] Esc 实测：', {
            before,
            after: drawerOf(target)?.getAttribute('data-visible'),
            emitted: target.emitted('update:visible') ?? [],
            viaPath
        })

        expect(
            isClosed(target),
            'Esc 未关闭抽屉（窄屏 `allowCloseByOverlay` 或自挂 keydown 缺失）'
        ).toBe(true)
    })
})

describe('T549 AC10 ④ ≤480px：抽屉内容不引入横向溢出', () => {
    it('AC10 ④ 480px：抽屉内容区无「min-width ≥320px」、无 `overflow-x: hidden` 掩盖', () => {
        const rules = detailPanelRules()
        const contentPattern = /nue-drawer__(content|main)|pomodoro-records-detail/
        const offenders = effectiveRules(rules, 480)
            .filter((rule) => rule.selectors.some((selector) => contentPattern.test(selector)))
            .flatMap((rule) =>
                rule.decls
                    .filter(
                        (decl) =>
                            (decl.prop === 'min-width' && (resolvePx(decl.value) ?? 0) >= 320) ||
                            (decl.prop === 'overflow-x' && decl.value === 'hidden')
                    )
                    .map((decl) => `${rule.selectors.join(', ')} { ${decl.prop}: ${decl.value} }`)
            )
        console.log('[AC10-④] 抽屉内容横向溢出成因：', offenders)

        expect(offenders).toEqual([])
    })
})

describe('T549 AC10 ⑤ >480px：遮罩点击仍不可关（钉住默认 false 未被改成无条件）', () => {
    it('AC10 ⑤ 1280px：遮罩 mousedown 不得关闭抽屉', async () => {
        const target = await openDrawer(DESKTOP)
        const overlay = overlayOf(target)
        expect(overlay, '未找到 `.nue-overlay`').not.toBeNull()

        const before = drawerOf(target)?.getAttribute('data-visible')
        overlay!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
        await flushPromises()
        await nextTick()

        console.log('[AC10-⑤] >480 遮罩点击实测：', {
            before,
            after: drawerOf(target)?.getAttribute('data-visible'),
            emitted: target.emitted('update:visible') ?? []
        })

        expect(
            isClosed(target),
            '>480px 点遮罩竟关闭了抽屉 ⇒ `allowCloseByOverlay` 被无条件开启，改了桌面/平板行为（硬约束：>480 零变化）'
        ).toBe(false)
    })
})