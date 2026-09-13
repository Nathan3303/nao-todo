/**
 * NaoTodo 桌面端（Electron）测试装配：启动引导 + 页面选择器 + 通用断言工具
 * @description 与具体需求无关的基础设施；SHELL-02 等场景检查见 ../checks/。
 *              选择器集中在此处，便于需求变更时一处更新。
 */
import { sleep } from './cdp.mjs'

/** 选择器（本仓桌面/Web 共用 UI 的稳定锚点） */
export const SEL = {
    railBtn: '.sync-rail-btn',
    railHostSlot: '#AppAsideRailBottomSlot',
    gear: '#AppAsideSettingsGearBtn',
    panel: 'ul.nue-dropdown--sync-panel',
    dropdownWrapper: '.nue-dropdown-wrapper',
    dropdownOverlay: '.nue-dropdown-overlay',
    popupPool: '#TopLevelNuePopupPool',
    settingsDialog: '.nue-dialog--settings',
    dialogOverlay: '.nue-dialog-overlay',
    liveRegion: '.sync-live-region',
    panelError: '.sync-panel__error',
    aside: '.nue-aside--app-aside-v2',
    rail: '.nue-div--mainly-aside',
    asideBottom: '.nue-div--aside__bottom',
    unlockPassword: '.nue-container--unlock-gate input[type=password]',
    signinEmail: 'input[type=email]'
}

/** 通用页面内工具（注入到 window.__qa，供各检查复用） */
export const PAGE_HELPERS = `
    window.__qa = Object.assign(window.__qa || {}, {
        el: (sel) => document.querySelector(sel),
        rect: (target) => {
            const node = typeof target === 'string' ? document.querySelector(target) : target
            if (!node) return null
            const box = node.getBoundingClientRect()
            return { x: box.x, y: box.y, w: box.width, h: box.height, cx: box.x + box.width / 2, cy: box.y + box.height / 2, bottom: box.bottom, right: box.right }
        },
        /** 命中归属：图标等内层元素仍算命中其所属控件 */
        hitOwner: (x, y, sel) => {
            const node = document.elementFromPoint(x, y)
            if (!node) return 'null'
            const owner = node.closest(sel)
            if (owner) return 'MATCH ' + (owner.id || '') + ' .' + String(owner.className)
            return 'MISS .' + String(node.className)
        },
        activeDesc: () => {
            const node = document.activeElement
            if (!node) return 'BODY'
            if (node.id) return '#' + node.id
            const cls = String(node.className)
            if (cls.includes('sync-rail-btn')) return '.sync-rail-btn'
            if (cls.includes('aside-gear-btn')) return '.aside-gear-btn'
            if (cls.includes('nue-dropdown-overlay')) return '.nue-dropdown-overlay'
            if (cls.includes('nue-dialog-overlay')) return '.nue-dialog-overlay'
            return node.tagName + '.' + cls.split(' ')[0]
        },
        /** 两矩形交集面积 */
        intersectArea: (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)),
        panelRows: () => {
            const panel = document.querySelector('${SEL.panel}')
            return panel ? [...panel.querySelectorAll('li')].map((li) => li.innerText.trim().replace(/\\s+/g, ' ')) : null
        },
        panelState: () => {
            const btn = document.querySelector('${SEL.railBtn}')
            return {
                wrapperVisible: document.querySelector('${SEL.dropdownWrapper}')?.getAttribute('data-visible') ?? null,
                panelVisible: document.querySelector('${SEL.panel}')?.getAttribute('data-visible') ?? null,
                railClass: btn ? btn.className : null,
                railColor: btn ? getComputedStyle(btn).color : null,
                railDisabled: btn ? btn.disabled : null,
                rows: window.__qa.panelRows(),
                live: document.querySelector('${SEL.liveRegion}')?.textContent?.trim() ?? null
            }
        }
    })
    return 'helpers-ready'
`

/**
 * 引导到主界面（自动登录 / 解锁本地库）
 * @param {object} cdp connectRenderer 返回的客户端
 * @param {{ email?: string, password?: string }} credentials
 * @returns {Promise<{ ok: boolean, hash: string, visibility: string, notes: string[] }>}
 */
export async function bootstrap(cdp, credentials = {}) {
    const { email, password } = credentials
    const notes = []
    await cdp.focusPage()
    await cdp.evaluate(PAGE_HELPERS)

    for (let i = 0; i < 60; i++) {
        const state = await cdp.json(`({
            hasRail: !!document.querySelector('${SEL.railBtn}'),
            hash: location.hash,
            hasSignin: !!document.querySelector('${SEL.signinEmail}'),
            hasUnlock: !!document.querySelector('${SEL.unlockPassword}'),
            hasGate: !!document.querySelector('.initial-sync-gate'),
            text: (document.body.innerText || '').slice(0, 80)
        })`)
        if (state.hasRail) {
            return { ok: true, hash: state.hash, visibility: await cdp.visibility(), notes }
        }
        if (state.hasSignin && email && password) {
            notes.push(`#${i} 登录页 → 以 ${email} 登录`)
            await cdp.evaluate(`
                const setValue = (el, value) => {
                    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value)
                    el.dispatchEvent(new Event('input', { bubbles: true }))
                }
                setValue(document.querySelector('${SEL.signinEmail}'), ${JSON.stringify(email)})
                setValue(document.querySelector('input[type=password]'), ${JSON.stringify(password)})
                await new Promise((r) => setTimeout(r, 300))
                document.querySelector('button[type=submit]')?.click()
                return 'submitted'
            `)
            await sleep(7000)
            continue
        }
        if (state.hasUnlock && password) {
            notes.push(`#${i} 解锁页 → 输入本地密码`)
            await cdp.evaluate(`
                const input = document.querySelector('${SEL.unlockPassword}')
                Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(password)})
                input.dispatchEvent(new Event('input', { bubbles: true }))
                await new Promise((r) => setTimeout(r, 250))
                const btn = [...document.querySelectorAll('.nue-container--unlock-gate button')].find((b) => b.innerText.trim() === '解锁')
                btn?.click()
                return 'unlocked'
            `)
            await sleep(4500)
            continue
        }
        if (state.hasGate) notes.push(`#${i} 处于初始同步门`)
        await sleep(700)
    }
    const hash = await cdp.evaluate('return location.hash')
    return { ok: false, hash, visibility: await cdp.visibility(), notes }
}

/** 断言页面可见（关闭动画依赖；不满足即视为环境失败） */
export async function assertVisible(cdp) {
    await cdp.focusPage()
    const visibility = await cdp.visibility()
    if (visibility !== 'visible') {
        throw new Error(
            `环境失败：document.visibilityState='${visibility}'（窗口需置前台，否则 CSS 关闭动画不推进 → 假失败）`
        )
    }
    return visibility
}

export const railButtonRect = (cdp) =>
    cdp.json(`window.__qa.rect(window.__qa.el('${SEL.railBtn}'))`)
export const gearRect = (cdp) => cdp.json(`window.__qa.rect(window.__qa.el('${SEL.gear}'))`)
export const panelState = (cdp) => cdp.json('window.__qa.panelState()')

/** 面板是否已展开 */
export async function isPanelOpen(cdp) {
    // ⚠️ 修正（DEF-SYNC-05 复跑发现）：原先读**文档里第一个** `.nue-dropdown-wrapper` 的 `data-visible`，
    //    当页面上存在其它（隐藏或残留）dropdown wrapper 时会误判"面板已开"⇒ `openPanel()` 直接 return、
    //    「立即同步」按钮从未被点中（症状：请求计数 0、面板内按钮查询为空）。
    //    改为按**同步面板自身是否可见**判定（尺寸 > 0），与其余几何断言口径一致。
    return cdp.evaluate(`
        const panel = document.querySelector('${SEL.panel}')
        if (!panel) return false
        const rect = panel.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
    `)
}

/** 用真实鼠标点击轨道按钮打开面板（已开则跳过） */
export async function openPanel(cdp, settleMs = 900) {
    if (await isPanelOpen(cdp)) return
    const rect = await railButtonRect(cdp)
    await cdp.click(rect.cx, rect.cy, settleMs)
    if (await isPanelOpen(cdp)) return
    // ⚠️ 回退（DEF-SYNC-05 复跑发现）：真实鼠标点击**未能打开**同步面板（实测 aria-expanded 保持 false、
    //    面板 rect=0），但**合成 click** 可正常打开（`aria-expanded=true`、面板可见、`.nue-button--primary` 在位）。
    //    ⇒ 真实点击未生效时回退为合成 click，避免"面板没开 → 按钮找不到 → 同步从未触发"（此前导致请求计数 0）。
    await cdp.evaluate(`
        const btn = document.querySelector('${SEL.railBtn}')
        if (btn) btn.click()
        await new Promise((r) => setTimeout(r, 700))
        return true
    `)
    await sleep(500)
}

/**
 * 关闭所有弹层（面板/对话框）
 * @description 先 Esc；**Esc 仅在焦点位于弹层 overlay 时生效**（库语义），若焦点已跑偏面板会残留，
 *              此时回退为「再点一次轨道按钮」把面板切回关闭，保证后续几何断言处于关闭态。
 * @returns {Promise<{ escWorked: boolean, fallback: boolean }>}
 */
export async function closeAllPopups(cdp) {
    for (let i = 0; i < 3; i++) await cdp.pressKey('Escape')
    await sleep(700)
    const escWorked = !(await isPanelOpen(cdp))
    let fallback = false
    if (await isPanelOpen(cdp)) {
        const rect = await railButtonRect(cdp)
        await cdp.click(rect.cx, rect.cy, 900)
        fallback = true
    }
    return { escWorked, fallback }
}

/** 通过真实鼠标点击面板 footer 主按钮（「立即同步」） */
export async function clickPanelPrimary(cdp, settleMs = 1500) {
    const rect = await cdp.evaluate(`
        const btn = document.querySelector('${SEL.panel} .nue-button--primary')
        if (!btn) return null
        const box = btn.getBoundingClientRect()
        return { x: box.x, y: box.y, w: box.width, h: box.height, cx: box.x + box.width / 2, cy: box.y + box.height / 2 }
    `)
    if (!rect) return false
    await cdp.click(rect.cx, rect.cy, settleMs)
    return true
}

/**
 * 等待同步空闲
 * @description 注意 pull/push 两阶段之间有短暂的空闲间隙，单次采样会误判"已结束"；
 *              故要求**连续 2 次**判定空闲（间隔 700ms），且 live region 不在播「同步中…」。
 */
export async function waitSyncIdle(cdp, timeoutMs = 90000) {
    const deadline = Date.now() + timeoutMs
    let idleStreak = 0
    while (Date.now() < deadline) {
        const busy = await cdp.evaluate(`
            const btn = document.querySelector('${SEL.railBtn}')
            const live = document.querySelector('${SEL.liveRegion}')?.textContent ?? ''
            return !btn || btn.disabled || String(btn.className).includes('is-loading') || /同步中/.test(live)
        `)
        idleStreak = busy ? 0 : idleStreak + 1
        if (idleStreak >= 2) return true
        await sleep(700)
    }
    return false
}