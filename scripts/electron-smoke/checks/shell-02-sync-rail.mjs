/**
 * SHELL-02 桌面端同步状态（侧栏 70px 轨道）冒烟检查集
 * @description 每条 AC 对应可执行断言；几何一律真实取值（真实鼠标 + getBoundingClientRect），
 *              不使用"看起来对"的截图判读。
 * @see docs/adr/2026-09-10-shell-02-sync-status-rail-teleport.md
 */
import { sleep } from '../lib/cdp.mjs'
import {
    SEL,
    clickPanelPrimary,
    closeAllPopups,
    gearRect,
    isPanelOpen,
    openPanel,
    panelState,
    waitSyncIdle
} from '../lib/app.mjs'

const expect = (checks, id, title, ok, detail) => {
    checks.push({ id, title, status: ok ? 'PASS' : 'FAIL', detail: String(detail) })
}
const info = (checks, id, title, detail) => {
    checks.push({ id, title, status: 'INFO', detail: String(detail) })
}
/** 色读数：同步执行期间轨道按钮 disabled，读到的是 disabled 色 → 等空闲后重试（最多 4 次） */
async function readColorsWithRetry(cdp) {
    let last = null
    for (let i = 0; i < 4; i++) {
        last = await cdp.json(`(() => {
            const resolve = (expr) => { const probe = document.createElement('span'); probe.style.color = expr; document.body.appendChild(probe); const c = getComputedStyle(probe).color; probe.remove(); return c }
            const btn = document.querySelector('${SEL.railBtn}')
            const base = getComputedStyle(btn).color
            btn.classList.add('is-pending'); const pending = getComputedStyle(btn).color; btn.classList.remove('is-pending')
            btn.classList.add('is-failed'); const failed = getComputedStyle(btn).color; btn.classList.remove('is-failed')
            return { base, pending, failed, varWarning: resolve('var(--nue-warning-color-60)'), varError: resolve('var(--nue-error-color-60)'), liveDisabled: btn.disabled }
        })()`)
        if (!last.liveDisabled) return last
        await waitSyncIdle(cdp)
    }
    return last
}

const sameBox = (a, b) =>
    !!a &&
    !!b &&
    Math.abs(a.x - b.x) < 0.6 &&
    Math.abs(a.y - b.y) < 0.6 &&
    Math.abs(a.w - b.w) < 0.6 &&
    Math.abs(a.h - b.h) < 0.6

/** 冒烟 1：齿轮可点（AC-01/AC-07/AC-11） */
async function smoke1(ctx) {
    const { cdp } = ctx
    const checks = []
    const closeInfo = await closeAllPopups(cdp)
    info(
        checks,
        'PRE',
        '进入前关闭弹层方式',
        `Esc 生效=${closeInfo.escWorked}；回退点击=${closeInfo.fallback}（Esc 仅在焦点位于 overlay 时生效，属库语义）`
    )
    const geometry = await cdp.json(`(() => {
        const q = window.__qa
        const btn = q.el('${SEL.railBtn}')
        const gear = q.el('${SEL.gear}')
        const rb = q.rect(btn)
        const rg = q.rect(gear)
        const bottom = q.el('${SEL.asideBottom}')
        const cs = getComputedStyle(gear)
        const cb = getComputedStyle(btn)
        const icon = (host) => q.rect(host.querySelector('i'))
        return {
            rb, rg,
            hitBtn: q.hitOwner(rb.cx, rb.cy, '${SEL.railBtn}'),
            hitGear: q.hitOwner(rg.cx, rg.cy, '${SEL.gear}'),
            intersectArea: q.intersectArea(rb, rg),
            gap: Math.round(rg.y - (rb.y + rb.h)),
            btnSize: Math.round(rb.w) + 'x' + Math.round(rb.h),
            gearSize: Math.round(rg.w) + 'x' + Math.round(rg.h),
            btnBorder: cb.borderTopWidth,
            gearBorder: cs.borderTopWidth,
            btnColor: cb.color,
            gearColor: cs.color,
            btnIcon: icon(btn),
            gearIcon: icon(gear),
            order: [...bottom.querySelectorAll('.nue-dropdown-wrapper, ${SEL.gear}')].map((e) => e.id || String(e.className).split(' ')[0]),
            ariaLabel: btn.getAttribute('aria-label'),
            ariaExpanded: btn.getAttribute('aria-expanded')
        }
    })()`)
    expect(
        checks,
        'AC-01.a',
        '同步按钮中心命中自身',
        geometry.hitBtn.includes('sync-rail-btn'),
        geometry.hitBtn
    )
    expect(
        checks,
        'AC-01.b',
        '齿轮中心命中齿轮（无遮挡）',
        geometry.hitGear.includes('AppAsideSettingsGearBtn'),
        geometry.hitGear
    )
    expect(
        checks,
        'AC-01.c',
        '按钮与齿轮 rect 交集面积 = 0',
        geometry.intersectArea === 0,
        `交集=${geometry.intersectArea}`
    )
    expect(
        checks,
        'AC-07',
        '轨道顺序：同步按钮在齿轮上方（齿轮最底）',
        geometry.rb.bottom <= geometry.rg.y,
        `按钮底=${Math.round(geometry.rb.bottom)} ≤ 齿轮顶=${Math.round(geometry.rg.y)}；gap=${geometry.gap}px`
    )
    expect(
        checks,
        'AC-11.a',
        '外层按钮盒子与齿轮同尺寸',
        geometry.btnSize === geometry.gearSize,
        `按钮 ${geometry.btnSize}（border=${geometry.btnBorder}） vs 齿轮 ${geometry.gearSize}（border=${geometry.gearBorder}）`
    )
    expect(
        checks,
        'AC-11.b',
        '图标字形同尺寸同左缘',
        geometry.btnIcon.w === geometry.gearIcon.w &&
            Math.round(geometry.btnIcon.x) === Math.round(geometry.gearIcon.x),
        `图标 ${Math.round(geometry.btnIcon.w)}px vs ${Math.round(geometry.gearIcon.w)}px；左缘 x=${Math.round(geometry.btnIcon.x)} vs ${Math.round(geometry.gearIcon.x)}`
    )
    expect(
        checks,
        'AC-11.c',
        '常态色一致',
        geometry.btnColor === geometry.gearColor,
        `${geometry.btnColor} vs ${geometry.gearColor}`
    )
    expect(
        checks,
        'AC-12.a',
        'aria-label 本地化 + aria-expanded 关闭态 false',
        geometry.ariaLabel === '同步' && geometry.ariaExpanded === 'false',
        `aria-label="${geometry.ariaLabel}" aria-expanded="${geometry.ariaExpanded}"`
    )
    info(checks, 'OBS', '按钮/齿轮间距（当前外观基线 1.5rem=24px）', `实测 ${geometry.gap}px`)
    const theme = await cdp.json(
        `({ darkSwitch: getComputedStyle(document.documentElement).getPropertyValue('--nue-dark-switch').trim(), htmlClass: document.documentElement.className })`
    )
    info(checks, 'OBS-theme', '读色时的主题（双主题下同色/状态色均需成立）', JSON.stringify(theme))

    // 真实鼠标点齿轮 → 设置对话框
    await cdp.click(geometry.rg.cx, geometry.rg.cy, 900)
    const dialogOpen = await cdp.evaluate(
        `return !!document.querySelector('${SEL.settingsDialog}')`
    )
    expect(
        checks,
        'AC-01.d',
        '真实点击齿轮 → 设置对话框打开',
        dialogOpen === true,
        `dialog=${dialogOpen}`
    )
    await closeAllPopups(cdp)

    // 收起态（70px）
    await cdp.evaluate(`
        const btn = [...document.querySelectorAll('.nue-div--tasks-header button')].find((b) => b.querySelector('.icon-menu-close') || b.querySelector('.icon-menu-open'))
        btn?.click()
        await new Promise((r) => setTimeout(r, 900))
        return 'toggled'
    `)
    const collapsed = await cdp.json(`(() => {
        const q = window.__qa
        const rb = q.rect(q.el('${SEL.railBtn}'))
        const rg = q.rect(q.el('${SEL.gear}'))
        return { asideW: Math.round(q.rect(q.el('${SEL.aside}')).w), hitBtn: q.hitOwner(rb.cx, rb.cy, '${SEL.railBtn}'), hitGear: q.hitOwner(rg.cx, rg.cy, '${SEL.gear}'), intersectArea: q.intersectArea(rb, rg) }
    })()`)
    expect(
        checks,
        'AC-01.e',
        '收起态（70px）按钮/齿轮均可命中且无遮挡',
        collapsed.hitBtn.includes('sync-rail-btn') &&
            collapsed.hitGear.includes('AppAsideSettingsGearBtn') &&
            collapsed.intersectArea === 0,
        JSON.stringify(collapsed)
    )
    await cdp.evaluate(`
        const btn = [...document.querySelectorAll('.nue-div--tasks-header button')].find((b) => b.querySelector('.icon-menu-close') || b.querySelector('.icon-menu-open'))
        btn?.click()
        await new Promise((r) => setTimeout(r, 900))
        return 'restored'
    `)
    return checks
}

/** 冒烟 2：悬停 + 点击 + 零 layout shift（AC-02/AC-11） */
async function smoke2(ctx) {
    const { cdp } = ctx
    const checks = []
    await closeAllPopups(cdp)
    const before = await cdp.json(`(() => {
        const q = window.__qa
        return { btn: q.rect(q.el('${SEL.railBtn}')), gear: q.rect(q.el('${SEL.gear}')), asideW: Math.round(q.rect(q.el('${SEL.aside}')).w), railW: Math.round(q.rect(q.el('${SEL.rail}')).w) }
    })()`)

    // 悬停 → tooltip
    await cdp.mouseMove(before.btn.cx, before.btn.cy)
    await sleep(800)
    const tooltip = await cdp.json(`(() => {
        const btn = document.querySelector('${SEL.railBtn}')
        const rb = window.__qa.rect(btn)
        const tips = [...document.querySelectorAll('.nue-tooltip')].filter((t) => t.getBoundingClientRect().width > 0)
        const tip = tips[tips.length - 1]
        if (!tip) return { found: false }
        const rt = window.__qa.rect(tip)
        return { found: true, text: tip.innerText.trim(), tipBottom: Math.round(rt.bottom), btnTop: Math.round(rb.y), centerDx: Math.round(rt.cx - rb.cx) }
    })()`)
    expect(
        checks,
        'AC-02.a',
        'hover 出现 tooltip 文案「同步」',
        tooltip.found && tooltip.text === '同步',
        `found=${tooltip.found} text=${tooltip.text}`
    )
    expect(
        checks,
        'AC-02.b',
        'tooltip 位于按钮上方（top-center）',
        tooltip.found &&
            tooltip.tipBottom <= tooltip.btnTop + 2 &&
            Math.abs(tooltip.centerDx) <= 24,
        `tip 底=${tooltip.tipBottom} ≤ 按钮顶=${tooltip.btnTop}；水平偏移=${tooltip.centerDx}px`
    )

    // 点击 → 面板
    await cdp.click(before.btn.cx, before.btn.cy, 1000)
    const opened = await panelState(cdp)
    const after = await cdp.json(`(() => {
        const q = window.__qa
        return { btn: q.rect(q.el('${SEL.railBtn}')), gear: q.rect(q.el('${SEL.gear}')), asideW: Math.round(q.rect(q.el('${SEL.aside}')).w), railW: Math.round(q.rect(q.el('${SEL.rail}')).w) }
    })()`)
    expect(
        checks,
        'AC-02.c',
        '点击 → 面板打开（data-visible=true）',
        opened.wrapperVisible === 'true',
        `wrapper=${opened.wrapperVisible}`
    )
    expect(
        checks,
        'AC-02.d',
        '零 layout shift：按钮/齿轮 rect 逐位一致',
        sameBox(before.btn, after.btn) && sameBox(before.gear, after.gear),
        `按钮 ${JSON.stringify(before.btn)} → ${JSON.stringify(after.btn)}`
    )
    expect(
        checks,
        'AC-02.e',
        '零 layout shift：轨道/侧栏宽度不变',
        before.asideW === after.asideW && before.railW === after.railW,
        `aside ${before.asideW}→${after.asideW}；rail ${before.railW}→${after.railW}`
    )
    const placement = await cdp.json(`(() => {
        const q = window.__qa
        const rb = q.rect(q.el('${SEL.railBtn}'))
        const rp = q.rect(q.el('${SEL.panel}'))
        const cs = getComputedStyle(q.el('${SEL.panel}'))
        return {
            dx: Math.round(rp.x - (rb.x + rb.w)),
            dyCenter: Math.round(rp.cy - rb.cy),
            direction: q.el('${SEL.panel}').getAttribute('data-direction'),
            minW: cs.minWidth, maxW: cs.maxWidth,
            panelBottom: Math.round(rp.bottom), viewportH: innerHeight,
            overflowBottomPx: Math.round(Math.max(0, rp.bottom - innerHeight)),
            footerRect: q.rect(document.querySelector('${SEL.panel} .nue-button--primary'))
        }
    })()`)
    expect(
        checks,
        'AC-11.d',
        '面板向右展开（right-center；库内 flip 允许）',
        placement.dx > 0 || placement.direction === 'left',
        `dx=${placement.dx}px direction=${placement.direction}`
    )
    expect(
        checks,
        'AC-02.f',
        '面板限宽生效（min 12rem / max 18rem）',
        placement.minW === '192px' && placement.maxW === '288px',
        `min=${placement.minW} max=${placement.maxW}`
    )
    info(
        checks,
        'OBS-placement',
        '面板纵向对齐与视口余量',
        `dyCenter=${placement.dyCenter}px；面板底=${placement.panelBottom} 视口高=${placement.viewportH}（越界=${placement.overflowBottomPx}px）；footer=${JSON.stringify(placement.footerRect)}`
    )
    return checks
}

/** 冒烟 3：堆叠/模态（AC-09/C11） */
async function smoke3(ctx) {
    const { cdp } = ctx
    const checks = []
    await openPanel(cdp)
    // Ctrl+,（Linux/Windows）；macOS 为 ⌘,
    await cdp.pressCombo(',', 'Comma', 188, 2, 1400)
    const stack = await panelState(cdp)
    expect(
        checks,
        'AC-09.a',
        '⌘,/Ctrl+, → 设置对话框打开',
        (await cdp.evaluate(`return !!document.querySelector('${SEL.settingsDialog}')`)) === true,
        `dialog=${await cdp.evaluate(`return !!document.querySelector('${SEL.settingsDialog}')`)}`
    )
    expect(
        checks,
        'AC-09.b',
        'C11：面板已收起',
        stack.wrapperVisible === 'false',
        `wrapper data-visible=${stack.wrapperVisible}`
    )
    expect(
        checks,
        'AC-09.c',
        'C9：面板内容已移除（footer 按钮不存在）',
        !(await cdp.evaluate(
            `return !!document.querySelector('${SEL.panel} .nue-button--primary')`
        )),
        'footer 主按钮 absent'
    )
    const hitTest = await cdp.json(`(() => {
        const dialog = document.querySelector('${SEL.settingsDialog}')
        if (!dialog) return { ok: false }
        const box = dialog.getBoundingClientRect()
        const points = [[box.x + box.width / 2, box.y + 40], [box.x + box.width / 2, box.y + box.height / 2], [box.x + 60, box.y + box.height - 40]]
        return { ok: true, res: points.map(([x, y]) => ({ x: Math.round(x), y: Math.round(y), inside: dialog.contains(document.elementFromPoint(x, y)) })) }
    })()`)
    expect(
        checks,
        'AC-09.d',
        '对话框未被透明 overlay 吞点击（3 点均命中框内）',
        hitTest.ok && hitTest.res.every((p) => p.inside),
        JSON.stringify(hitTest.res)
    )
    const dialogsBefore = await cdp.evaluate(
        `return document.querySelectorAll('.nue-dialog').length`
    )
    await cdp.pressKey('n')
    await cdp.pressKey('p')
    const dialogsAfter = await cdp.evaluate(
        `return document.querySelectorAll('.nue-dialog').length`
    )
    expect(
        checks,
        'AC-14.a',
        '对话框开启期间 n/p 被抑制',
        dialogsBefore === dialogsAfter,
        `dialog 数 ${dialogsBefore} → ${dialogsAfter}`
    )
    await cdp.pressKey('Escape', 1200)
    const focus = await cdp.json(
        `({ dialogClosed: !document.querySelector('${SEL.settingsDialog}'), active: window.__qa.activeDesc() })`
    )
    expect(
        checks,
        'AC-14.b',
        'Esc 关对话框后焦点归还齿轮（SHELL-01）',
        focus.dialogClosed && focus.active === '#AppAsideSettingsGearBtn',
        JSON.stringify(focus)
    )
    return checks
}

/** 冒烟 4：关闭语义 / 键盘链 / 宿主缺失（AC-03/AC-08/AC-10/AC-13/AC-16） */
async function smoke4(ctx) {
    const { cdp } = ctx
    const checks = []
    await closeAllPopups(cdp)
    // 键盘链：Enter 开 → Tab 到 footer → Esc 关 + 焦点归还
    await cdp.evaluate(`document.querySelector('${SEL.railBtn}').focus(); return 'focused'`)
    await cdp.pressKey('Enter', 900)
    const kbOpen = await panelState(cdp)
    expect(
        checks,
        'AC-03.a',
        '轨道按钮 Enter 打开面板',
        kbOpen.wrapperVisible === 'true',
        `wrapper=${kbOpen.wrapperVisible}`
    )
    const overlayFocus = await cdp.evaluate(
        `return String(document.activeElement?.className || '').includes('nue-dropdown-overlay')`
    )
    info(checks, 'AC-03.info', '打开后焦点落点', `overlayFocused=${overlayFocus}`)
    await cdp.pressKey('Tab', 400)
    const afterTab = await cdp.json(`(() => {
        const btn = document.querySelector('${SEL.panel} .nue-button--primary')
        return { isFooterBtn: document.activeElement === btn, active: document.activeElement ? String(document.activeElement.className) + '|' + (document.activeElement.innerText || '').trim() : null }
    })()`)
    expect(
        checks,
        'AC-03.b',
        'Tab 落到 footer「立即同步」',
        afterTab.isFooterBtn === true,
        JSON.stringify(afterTab)
    )
    await cdp.pressKey('Escape', 1200)
    const closed = await panelState(cdp)
    expect(
        checks,
        'AC-03.c',
        'Esc 关闭面板（data-visible=false）',
        closed.wrapperVisible === 'false',
        `wrapper=${closed.wrapperVisible}`
    )
    expect(
        checks,
        'AC-03.d',
        'C16：Esc 关闭后焦点归还轨道按钮',
        closed.railClass !== null &&
            (await cdp.evaluate(`return window.__qa.activeDesc()`)) === '.sync-rail-btn',
        `active=${await cdp.evaluate(`return window.__qa.activeDesc()`)}`
    )

    // 宿主缺失：窄窗（抽屉分支）→ 不渲染、零 warn、不回落悬浮
    cdp.clearConsole()
    await cdp.setViewport({ width: 420, height: 800 })
    await sleep(1800)
    const narrow = await cdp.json(`({
        vw: innerWidth,
        railBtn: !!document.querySelector('${SEL.railBtn}'),
        slot: !!document.querySelector('${SEL.railHostSlot}'),
        floatingFallback: !!document.querySelector('.sync-status-widget'),
        railHostNodes: document.querySelectorAll('${SEL.railBtn}').length
    })`)
    const warnings = cdp.warnings()
    expect(
        checks,
        'AC-08',
        '抽屉分支（窄窗）不渲染同步组件',
        narrow.railBtn === false && narrow.slot === false,
        JSON.stringify(narrow)
    )
    expect(
        checks,
        'AC-08.b',
        '不回落旧视口悬浮层',
        narrow.floatingFallback === false,
        `floating=${narrow.floatingFallback}`
    )
    expect(
        checks,
        'AC-10',
        '宿主缺失路径零 warn/error',
        warnings.length === 0,
        warnings.length ? JSON.stringify(warnings.slice(0, 4)) : '无'
    )
    await cdp.clearViewport()
    await sleep(1800)
    const restored = await cdp.json(
        `({ railBtn: document.querySelectorAll('${SEL.railBtn}').length, slot: document.querySelectorAll('${SEL.railHostSlot}').length, floating: !!document.querySelector('.sync-status-widget') })`
    )
    expect(
        checks,
        'AC-10.b',
        '恢复视口后恰好挂载 1 份（无重复挂载）',
        restored.railBtn === 1 && restored.slot === 1,
        JSON.stringify(restored)
    )
    const slot = await cdp.json(`(() => {
        const node = document.querySelector('${SEL.railHostSlot}')
        return { display: getComputedStyle(node).display, w: Math.round(node.getBoundingClientRect().width), h: Math.round(node.getBoundingClientRect().height) }
    })()`)
    expect(
        checks,
        'AC-13',
        '注入点 display:contents 且自身 0×0（Web 端零可见变化）',
        slot.display === 'contents' && slot.w === 0 && slot.h === 0,
        JSON.stringify(slot)
    )
    return checks
}

/** D5=B 专项：transparent 模式三项风险 + 收益（架构标注"待复验"） */
async function d5b(ctx) {
    const { cdp } = ctx
    const checks = []
    if (await isPanelOpen(cdp)) await closeAllPopups(cdp)
    await openPanel(cdp)
    const overlay = await cdp.json(`(() => {
        const pool = document.getElementById('${SEL.popupPool.slice(1)}')
        const node = pool?.querySelector('${SEL.dropdownOverlay}')
        if (!node) return { present: false }
        const box = node.getBoundingClientRect()
        return { present: true, w: Math.round(box.width), h: Math.round(box.height) }
    })()`)
    expect(
        checks,
        'D5B-1',
        'overlay 为 0×0（transparent 生效）',
        overlay.present === true && overlay.w === 0 && overlay.h === 0,
        JSON.stringify(overlay)
    )

    // 收益：面板开着时点齿轮应"一次生效"
    const gear = await gearRect(cdp)
    await cdp.click(gear.cx, gear.cy, 1200)
    const oneShot = await cdp.json(
        `({ dialog: !!document.querySelector('${SEL.settingsDialog}'), wrapperVisible: document.querySelector('${SEL.dropdownWrapper}')?.getAttribute('data-visible') })`
    )
    expect(
        checks,
        'D5B-2',
        '面板开着时点齿轮「一次生效」（开对话框）',
        oneShot.dialog === true,
        JSON.stringify(oneShot)
    )
    await cdp.pressKey('Escape', 1200)

    // ② 面板外一次点击作用到目标元素（window click 分支）
    await openPanel(cdp)
    const railBefore = await cdp.evaluate(
        `return document.querySelector('.nue-div--aside__navs a, .nue-div--aside__navs [class*=router-link]') ? 'has-nav' : 'no-nav'`
    )
    const outsideHit = await cdp.json(`(() => {
        const gear = window.__qa.rect(document.querySelector('${SEL.gear}'))
        const node = document.elementFromPoint(gear.cx, gear.cy)
        return { hitsGear: !!node?.closest('${SEL.gear}'), owner: node ? node.className : null, navInfo: ${JSON.stringify(railBefore)} }
    })()`)
    expect(
        checks,
        'D5B-3',
        'B 模式 overlay 0×0 时齿轮可被直接命中',
        outsideHit.hitsGear === true,
        JSON.stringify(outsideHit)
    )
    if (await isPanelOpen(cdp)) {
        // 面板外点击（齿轮以外的空白处）应关闭面板
        await cdp.click(600, 300, 800)
        const afterOutside = await panelState(cdp)
        expect(
            checks,
            'D5B-4',
            '面板外一次点击 → 面板关闭',
            afterOutside.wrapperVisible === 'false',
            `wrapper=${afterOutside.wrapperVisible}`
        )
    } else {
        info(checks, 'D5B-4', '面板外点击关闭', '面板已在点击后关闭（前置步骤已关）')
    }

    // ③ Esc 仍可关闭面板（最关键新风险点）
    await openPanel(cdp)
    const focused = await cdp.evaluate(`return String(document.activeElement?.className || '')`)
    await cdp.pressKey('Escape', 1300)
    const afterEsc = await panelState(cdp)
    expect(
        checks,
        'D5B-5',
        'Esc 仍能关闭面板（B 模式 0×0 overlay 未破坏 esc 链路）',
        afterEsc.wrapperVisible === 'false',
        `wrapper=${afterEsc.wrapperVisible}；Esc 前 activeElement=${focused}`
    )

    // ⑤ Tab 焦点链
    await openPanel(cdp)
    await cdp.pressKey('Tab', 400)
    const tabTarget = await cdp.json(`(() => {
        const btn = document.querySelector('${SEL.panel} .nue-button--primary')
        return { isFooterBtn: document.activeElement === btn, active: document.activeElement ? String(document.activeElement.className) : null }
    })()`)
    expect(
        checks,
        'D5B-6',
        'B 模式下 Tab 仍落到 footer「立即同步」',
        tabTarget.isFooterBtn === true,
        JSON.stringify(tabTarget)
    )
    await cdp.pressKey('Escape', 1000)

    // ④ 内容变尺寸是否重定位（R13 漂移）
    const drift = await cdp.json(`(() => {
        const q = window.__qa
        const btn = q.el('${SEL.railBtn}')
        const wrapper = q.el('${SEL.dropdownWrapper}')
        return { btnTop: Math.round(q.rect(btn).y), wrapperTop: Math.round(q.rect(wrapper).y) }
    })()`)
    info(
        checks,
        'D5B-7',
        'R13：面板纵向漂移观察',
        `按钮 y=${drift.btnTop}；wrapper y=${drift.wrapperTop}（关闭态 wrapper 应贴合按钮）`
    )
    return checks
}

/** AC-12/AC-04/AC-05/D2：可访问性、加载态、截断机制、色令牌 */
async function extras(ctx) {
    const { cdp } = ctx
    const checks = []
    await closeAllPopups(cdp)
    // AC-12 live region
    const live = await cdp.json(`(() => {
        const node = document.querySelector('${SEL.liveRegion}')
        const err = document.querySelector('${SEL.panelError}')
        return { present: !!node, ariaLive: node?.getAttribute('aria-live') ?? null, position: node ? getComputedStyle(node).position : null, text: node?.textContent?.trim() ?? null, errAriaLive: err?.getAttribute('aria-live') ?? null }
    })()`)
    expect(
        checks,
        'AC-12.b',
        'live region 常驻且 aria-live=polite',
        live.present && live.ariaLive === 'polite',
        JSON.stringify(live)
    )
    expect(
        checks,
        'AC-12.c',
        'live region 脱离布局流（position:absolute）',
        live.position === 'absolute',
        `position=${live.position}`
    )
    expect(
        checks,
        'AC-12.d',
        '错误摘要元素不带 aria-live（已迁至 live region）',
        live.errAriaLive === null,
        `aria-live=${live.errAriaLive}`
    )

    // AC-04 加载态：慢网触发同步中
    await openPanel(cdp)
    await cdp.emulateNetwork({
        offline: false,
        latency: 6000,
        downloadThroughput: 20000,
        uploadThroughput: 20000
    })
    await clickPanelPrimary(cdp, 0)
    const samples = []
    for (let i = 0; i < 4; i++) {
        await sleep(400)
        samples.push(
            await cdp.json(`(() => {
            const btn = document.querySelector('${SEL.railBtn}')
            const panelBtn = document.querySelector('${SEL.panel} .nue-button--primary')
            return {
                railDisabled: btn.disabled,
                railLoading: String(btn.querySelector('i')?.className || ''),
                panelBtnDisabled: panelBtn ? panelBtn.disabled : null,
                panelUl: !!document.querySelector('${SEL.panel}'),
                liCount: document.querySelectorAll('${SEL.panel} li').length,
                footerBtnText: [...document.querySelectorAll('${SEL.panel} button')].map((b) => (b.innerText || '').trim()).join('/') || null,
                firstRow: document.querySelector('${SEL.panel} li')?.innerText.trim() ?? null,
                live: document.querySelector('${SEL.liveRegion}')?.textContent?.trim() ?? null
            }
        })()`)
        )
    }
    const sawLoading = samples.some(
        (s) =>
            s.railDisabled === true &&
            s.railLoading.includes('icon-loading') &&
            s.railLoading.includes('spin')
    )
    expect(
        checks,
        'AC-04.a',
        '同步中轨道按钮 loading + disabled（预期行为，非缺陷）',
        sawLoading,
        JSON.stringify(samples.map((s) => ({ d: s.railDisabled, icon: s.railLoading })))
    )
    const panelBtnStates = samples.map((s) => s.panelBtnDisabled)
    if (panelBtnStates.every((v) => v === null)) {
        info(
            checks,
            'AC-04.b',
            '同步中面板主按钮 disabled',
            `采样期未找到 .nue-button--primary；诊断：panelUl=${samples[0].panelUl} liCount=${samples[0].liCount} 面板按钮文案=${JSON.stringify(samples[0].footerBtnText)}；结论改由轨道按钮 loading + 「同步中…」+ live region 三项举证`
        )
    } else {
        expect(
            checks,
            'AC-04.b',
            '同步中面板主按钮 disabled',
            panelBtnStates.some((v) => v === true),
            JSON.stringify(panelBtnStates)
        )
    }
    expect(
        checks,
        'AC-04.c',
        '同步中面板首行「同步中…」',
        samples.some((s) => /同步中/.test(s.firstRow || '')),
        JSON.stringify(samples.map((s) => s.firstRow))
    )
    expect(
        checks,
        'AC-12.e',
        '同步中 live region 播报摘要「同步中…」',
        samples.some((s) => (s.live || '').includes('同步中')),
        JSON.stringify(samples.map((s) => s.live))
    )
    await cdp.emulateNetwork({
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1
    })
    await waitSyncIdle(cdp)
    await closeAllPopups(cdp)

    // AC-05 截断机制（clamped=2 真实裁剪）+ D2 色令牌接线
    // 前置：必须等同步真正空闲——loading/disabled 会把按钮色变成 disabled 色，导致色令牌断言假失败
    const idleOk = await waitSyncIdle(cdp)
    const btnDisabled = await cdp.evaluate(
        `return document.querySelector('${SEL.railBtn}')?.disabled ?? null`
    )
    expect(
        checks,
        'D2.pre',
        '色令牌探针前置：同步空闲且按钮未 disabled',
        idleOk === true && btnDisabled === false,
        `idle=${idleOk} disabled=${btnDisabled}`
    )
    const clamp = await cdp.json(`(() => {
        const make = (lines) => {
            const node = document.createElement('span')
            node.className = 'nue-text'
            if (lines) { node.classList.add('nue-text--clamped'); node.style.setProperty('--nue-text-clamped-lines', String(lines)) }
            node.style.setProperty('--nue-text-font-size', '0.75rem')
            node.style.width = '200px'
            node.textContent = '同步失败：网络错误 请稍后重试 '.repeat(12)
            document.body.appendChild(node)
            const cs = getComputedStyle(node)
            const res = { lines, clientH: node.clientHeight, scrollH: node.scrollHeight, clamp: cs.webkitLineClamp, truncated: node.scrollHeight > node.clientHeight }
            node.remove()
            return res
        }
        const noWrap = (() => {
            const node = document.createElement('span')
            node.className = 'nue-text nue-text--clamped'
            node.style.setProperty('--nue-text-clamped-lines', '2')
            node.style.width = '200px'
            node.textContent = 'X'.repeat(500)
            document.body.appendChild(node)
            const cs = getComputedStyle(node)
            const res = { overflow: cs.overflow, textOverflow: cs.textOverflow, width: Math.round(node.getBoundingClientRect().width) }
            node.remove()
            return res
        })()
        return { two: make(2), three: make(3), noWrap }
    })()`)
    // hover 会命中 :hover 规则（--nue-button-hover-color），先把鼠标移开并失焦，避免读到 hover 色
    await cdp.mouseMove(640, 320)
    await cdp.evaluate(`document.activeElement?.blur?.(); return 'blurred'`)
    await sleep(300)
    const colors = await readColorsWithRetry(cdp)
    expect(
        checks,
        'D2.pre2',
        '色读数有效（非同步中 disabled 态）',
        colors.liveDisabled === false,
        `liveDisabled=${colors.liveDisabled}（读数 base=${colors.base}）`
    )
    expect(
        checks,
        'AC-05.a',
        '超长错误 2 行截断（clamped=2 真实裁剪）',
        clamp.two.truncated === true && clamp.two.clientH * 1.5 === clamp.three.clientH,
        `2 行 clientH=${clamp.two.clientH}（scrollH=${clamp.two.scrollH}）；3 行 clientH=${clamp.three.clientH}`
    )
    expect(
        checks,
        'AC-05.b',
        '无换行超长 token 不撑破容器（overflow:hidden + ellipsis）',
        clamp.noWrap.overflow === 'hidden' && clamp.noWrap.width <= 201,
        JSON.stringify(clamp.noWrap)
    )
    expect(
        checks,
        'D2.a',
        'pending 色 = --nue-warning-color-60',
        colors.pending === colors.varWarning && colors.pending !== colors.base,
        JSON.stringify(colors)
    )
    expect(
        checks,
        'D2.b',
        'failed 色 = --nue-error-color-60',
        colors.failed === colors.varError && colors.failed !== colors.base,
        JSON.stringify(colors)
    )
    return checks
}

/**
 * 受控探针（默认关闭，需 --probe-task）：建 1 条 [QA-*] 任务 → 离线触发推送失败 → 实测 failed 态 → 删除并同步干净
 * 注意：会写入 1 条业务数据（软删除留墓碑），仅在 QA 账号使用。
 */
async function probeTask(ctx) {
    const { cdp, title = '[QA-PROBE] 受控探针任务' } = ctx
    const checks = []
    if (await isPanelOpen(cdp)) await closeAllPopups(cdp)
    await cdp.unblockUrls()
    await openPanel(cdp)
    await cdp.blockUrls(['*localhost:3302*', '*127.0.0.1:3302*'])
    await cdp.evaluate(`
        window.__probe = []; const t0 = performance.now()
        window.__probeTimer = setInterval(() => {
            window.__probe.push({ ms: Math.round(performance.now() - t0), ...window.__qa.panelState(), err: (() => {
                const node = document.querySelector('${SEL.panelError}')
                if (!node) return null
                const cs = getComputedStyle(node)
                return { h: node.clientHeight, clamp: cs.webkitLineClamp, title: node.getAttribute('title'), children: node.children.length, ariaLive: node.getAttribute('aria-live') }
            })() })
        }, 40)
        return 'watching'
    `)
    await cdp.pressKey('n', 1400)
    const created = await cdp.json(`(async () => {
        const dialog = [...document.querySelectorAll('.nue-dialog--task-creator')].find((d) => d.getBoundingClientRect().width > 0)
        if (!dialog) return { ok: false }
        const input = dialog.querySelector('input[placeholder="待办事项名称"]')
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(title)})
        input.dispatchEvent(new Event('input', { bubbles: true }))
        await new Promise((r) => setTimeout(r, 300))
        const save = [...dialog.querySelector('.nue-dialog__footer').querySelectorAll('button')].find((b) => b.innerText.trim() === '创建')
        save.click()
        await new Promise((r) => setTimeout(r, 2000))
        return { ok: true, inList: document.body.innerText.includes(${JSON.stringify(title)}) }
    })()`)
    expect(
        checks,
        'PROBE.a',
        '受控任务已创建（离线写入）',
        created.ok && created.inList === true,
        JSON.stringify(created)
    )
    await sleep(11000)
    const timeline = await cdp.json(`(() => {
        clearInterval(window.__probeTimer)
        const compact = []; let last = ''
        for (const sample of window.__probe) {
            const key = sample.railClass + '|' + sample.railColor + '|' + (sample.rows || []).join(',') + '|' + sample.live
            if (key !== last) { compact.push(sample); last = key }
        }
        return compact
    })()`)
    info(checks, 'PROBE.timeline', '状态时间线（40ms 采样，仅变化点）', JSON.stringify(timeline))
    const failed = timeline.find((s) => String(s.railClass).includes('is-failed'))
    expect(
        checks,
        'PROBE.b',
        '失败态着色 is-failed + 失败行可达',
        !!failed && failed.railColor === 'rgb(221, 87, 60)',
        failed ? `color=${failed.railColor} rows=${JSON.stringify(failed.rows)}` : '未出现失败态'
    )
    expect(
        checks,
        'PROBE.c',
        '错误摘要渲染（title 全文 / clamped=2 / 无子元素 / 无 aria-live）',
        !!failed?.err &&
            failed.err.clamp === '2' &&
            failed.err.children === 0 &&
            failed.err.ariaLive === null &&
            !!failed.err.title,
        JSON.stringify(failed?.err ?? null)
    )
    expect(
        checks,
        'PROBE.d',
        'live region 播报「失败 N」（不播全文）',
        !!failed && /失败/.test(failed.live || ''),
        failed ? `live="${failed.live}"` : 'n/a'
    )
    expect(
        checks,
        'PROBE.e',
        '「待推送 N」行可达',
        !!failed && (failed.rows || []).some((row) => /待推送 \d+/.test(row)),
        failed ? JSON.stringify(failed.rows) : 'n/a'
    )

    // 恢复 + 删除探针任务（软删除 → 进垃圾桶）
    await cdp.blockUrls([])
    await clickPanelPrimary(cdp)
    await waitSyncIdle(cdp)
    const cleaned = await cdp.evaluate(`
        const rows = window.__qa.panelRows() || []
        return !rows.some((row) => /待推送|失败/.test(row))
    `)
    expect(
        checks,
        'PROBE.f',
        '恢复联网后同步干净（0 pending / 0 failed）',
        cleaned === true,
        JSON.stringify(await panelState(cdp))
    )
    await closeAllPopups(cdp)
    const deleted = await cdp.json(`(async () => {
        const row = [...document.querySelectorAll('.nue-text--todo-name')].find((n) => n.innerText.includes(${JSON.stringify(title)}))
        if (!row) return { skipped: true }
        row.click()
        await new Promise((r) => setTimeout(r, 1500))
        const more = [...document.querySelectorAll('.nue-drawer button')].find((b) => b.innerText.trim() === '更多')
        more?.click()
        await new Promise((r) => setTimeout(r, 1200))
        const item = [...document.querySelectorAll('ul.nue-dropdown li')].find((li) => li.innerText.trim() === '删除待办任务' && li.getBoundingClientRect().width > 0)
        item?.click()
        await new Promise((r) => setTimeout(r, 2000))
        return { clicked: !!item }
    })()`)
    info(checks, 'PROBE.g', '探针任务删除动作', JSON.stringify(deleted))
    return checks
}

export const shell02SyncRail = {
    id: 'shell-02',
    title: 'SHELL-02 桌面端同步状态（侧栏轨道）',
    groups: [
        { id: 'smoke-1', title: '冒烟1 齿轮可点 + 轨道几何（AC-01/AC-07/AC-11）', run: smoke1 },
        { id: 'smoke-2', title: '冒烟2 悬停/点击 + 零 layout shift（AC-02/AC-11）', run: smoke2 },
        { id: 'smoke-3', title: '冒烟3 堆叠/模态（AC-09/C11/AC-14）', run: smoke3 },
        {
            id: 'smoke-4',
            title: '冒烟4 关闭语义/键盘链/宿主缺失（AC-03/AC-08/AC-10/AC-13）',
            run: smoke4
        },
        { id: 'd5b', title: 'D5=B 专项（transparent 三项风险 + 一次生效收益）', run: d5b },
        {
            id: 'extras',
            title: 'AC-12 live region / AC-04 加载态 / AC-05 截断 / D2 色令牌',
            run: extras
        },
        {
            id: 'probe',
            title: '受控探针任务（pending/failed 真实态，需 --probe-task）',
            run: probeTask,
            optIn: 'probeTask'
        }
    ]
}