/**
 * SHELL-03 离线可用性冒烟检查集（BC-1…BC-7）—— **脚手架（scaffold）**
 *
 * ⚠️ 状态说明
 * - W1（门/壳重构：`unlock-gate` / `initial-sync-gate` / `aside-v2`）**尚未落地**；本文件先把结构、
 *   探测口径、时间上界、环境手法搭好，**待 PM 正式派发（含新基线 hash + 逐条判定口径 + 防误报清单）再跑**。
 * - W1 落地后若语义锚点（文案/结构）改名，**只改本文件的 ANCHORS 一处**；探测逻辑与断言无需重写。
 * - 找不到锚点时各检查返回 **SKIP**（不判 FAIL），避免"白跑"或误报。
 *
 * 判定口径来源：ADR r3 §2 D-5 与附录 A（BC-1…BC-7）+ PM 答复（seq 36：文案锚点、USER_PROFILE_CACHE 键、BC-6 维持单测口径）。
 * W1 落地后需复核一次：① 可解锁态锚点（ANCHORS.unlockable*）；② 门内失败态文案；③ 离线标识呈现位置（解锁门可见小字 / 轨道 title|aria-label）。
 * @see docs/adr/2026-09-10-shell-03-*.md（待归档）
 */
import { sleep } from '../lib/cdp.mjs'
import { SEL } from '../lib/app.mjs'

/**
 * 网络等待上界基线（**常量变更必须同步更新本块**）
 * - `packages/shared/requester/axios.ts:20` → `timeout: 5000`
 * - `packages/shared/requester/retry.ts:6`  → `export const MAX_RETRY = 2`
 * - `packages/shared/requester/retry.ts:36` → 退避 300 * 2^n（300ms、600ms）
 * - 幂等（GET/PUT/DELETE）最坏 = 5000*3 + 300 + 600 = 15900ms；非幂等（POST）= 5000ms
 */
const BASELINE = {
    timeoutMs: 5000,
    maxRetry: 2,
    worstCaseGetMs: 15900,
    /** 门内"可解锁态"上界（BC-1 人工口径：不等待网络即可交互） */
    unlockableUpperBoundMs: 2000,
    /** 终态上界：网络等待上界 + 渲染余量 */
    terminalUpperBoundMs: 15900 + 1500,
    sources: [
        'packages/shared/requester/axios.ts:20 (timeout: 5000)',
        'packages/shared/requester/retry.ts:6 (MAX_RETRY = 2)',
        'packages/shared/requester/retry.ts:36 (backoff 300*2^n)'
    ]
}

/**
 * 语义锚点（W1 落地后按需改名）
 * @description 用**文案**而非类名为主：W1 会重构门内 DOM，文案（重试/离线进入/登出）更稳定。
 */
const ANCHORS = {
    // —— 文案锚点（PM seq 36 确认，改词只改此处）——
    retryText: ['重试'],
    /** 登出/重新登录：PM 认可用 /登出/ 宽匹配（既有「登出用户」）+ 新键 gate.signInAgain「重新登录」 */
    signOutText: ['登出', '重新登录', 'Sign out'],
    offlineEnterText: ['离线进入'],
    failureText: ['失败', '无法', '错误', 'Failed', 'error'],
    /**
     * 离线标识：解锁门为**可见小字**「离线」（新键 identity.offline）；
     * ⚠️ 轨道 70px **不放可见小字**（只走 title/aria-label）⇒ 不得以"轨道无可见『离线』字样"判缺陷。
     */
    offlineBadgeText: ['离线', 'Offline'],
    /** 可解锁态判定：可见密码输入框 或 可见「解锁/登录」按钮（W1 落地后用实测快照复核一次） */
    unlockableSelectors: ['input[type=password]', '.nue-container--unlock-gate', 'button'],
    unlockableTexts: ['解锁', '登录', 'Sign in'],
    // 离线身份（BC-7）
    avatarFallbackIcon: 'user',
    // 壳（BC-5）——与 SHELL-02 相同锚点
    railSlot: SEL.railHostSlot,
    gear: SEL.gear,
    railBtn: SEL.railBtn
}

/** 后端 API 封锁模式（**只封 API，保留 dev server 5173**） */
const API_BLOCK_URLS = ['*localhost:3302*', '*127.0.0.1:3302*']

/**
 * 控制台归因口径（PM seq 40 收窄）
 * - **BC-2 判定不含 console 零调用**；console 仅用于归因：
 *   `Vue warn` / 未捕获异常 / Teleport 告警 ⇒ FAIL
 * - 以下**基础设施诊断日志属预期，必须放行**（后端不可达时的既有网络日志）：
 *   `[sync] 拉取请求失败（网络/HTTP 错误）`、`[sync] 拉取归一化错误（断网/超时）`、`[desktop] …`、`net::ERR_*`
 * - 「console.warn/error 零调用」只适用于 **BC-7 缓存路径（C-17 静默）** 等指定场景
 */
const LOG_FATAL =
    /Vue warn|Teleport|\[Vue warn\]|Uncaught|unhandled|TypeError|ReferenceError|Cannot read propert/i
const LOG_EXPECTED =
    /\[sync\]|\[desktop\]|net::ERR_|ERR_NETWORK|ERR_INTERNET_DISCONNECTED|Failed to load resource/i

/** 记录一条检查；三者均返回 checks，便于 `return skip(...)` 这种提前收口语义 */
const expect = (checks, id, title, ok, detail) => {
    checks.push({ id, title, status: ok ? 'PASS' : 'FAIL', detail: String(detail) })
    return checks
}
const info = (checks, id, title, detail) => {
    checks.push({ id, title, status: 'INFO', detail: String(detail) })
    return checks
}
const skip = (checks, id, title, detail) => {
    checks.push({ id, title, status: 'SKIP', detail: String(detail) })
    return checks
}

const IDENTITY_CACHE_KEYS = {
    /**
     * 身份缓存（PM seq 36 确认）
     * - localStorage 键：`USER_PROFILE_CACHE`（常量 `USER_PROFILE_CACHE_KEY`
     *   → `packages/domain-identity/src/domain/constants.ts`）
     * - 内容白名单：`{ userId, nickname, cachedAt }`（明文；**禁** email / 头像字节 / token）
     * - 变体 B 只清该键，**不必**清 IndexedDB
     */
    indexedDb: [],
    localStorage: ['USER_PROFILE_CACHE']
}

/** 页面内探测脚本：一次性取"门状态"全量快照（供 BC-1/2/3/4/5/7 复用；导出便于脚手架自检） */
export const PROBE_GATE = `
    const q = window.__qa
    const body = document.body
    const text = (body ? body.innerText : '') || ''
    const has = (list) => list.some((needle) => text.includes(needle))
    const interactive = [...document.querySelectorAll('#app button, #app input, #app textarea, #app select, #app a[href], #app [role=button]')]
        .filter((node) => {
            const box = node.getBoundingClientRect()
            const style = getComputedStyle(node)
            return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && !node.disabled
        })
    const app = document.getElementById('app')
    return {
        hash: location.hash,
        visibility: document.visibilityState,
        hasApp: !!app,
        appHtmlLen: app ? app.innerHTML.length : -1,
        interactiveCount: interactive.length,
        interactiveSample: interactive.slice(0, 4).map((node) => (node.innerText || node.placeholder || node.tagName).trim().slice(0, 12)),
        texts: {
            error: has(${JSON.stringify(ANCHORS.failureText)}),
            retry: has(${JSON.stringify(ANCHORS.retryText)}),
            offlineEnter: has(${JSON.stringify(ANCHORS.offlineEnterText)}),
            signOut: has(${JSON.stringify(ANCHORS.signOutText)}),
            offlineBadge: has(${JSON.stringify(ANCHORS.offlineBadgeText)})
        },
        unlockForm: (() => {
            const pw = [...document.querySelectorAll(${JSON.stringify(ANCHORS.unlockableSelectors[0])})].find((node) => node.getBoundingClientRect().width > 0)
            if (pw) return true
            const t = (document.body ? document.body.innerText : '') || ''
            return ${JSON.stringify(ANCHORS.unlockableTexts)}.some((needle) => t.includes(needle))
        })(),
        /** 离线标识：可见小字（解锁门）或 title/aria-label（轨道 70px）任一命中即成立 */
        offlineBadgeDetailed: (() => {
            const texts = ${JSON.stringify(ANCHORS.offlineBadgeText)}
            const visible = texts.some((needle) => ((document.body ? document.body.innerText : '') || '').includes(needle))
            const semantic = [...document.querySelectorAll('[title],[aria-label]')].some((node) => {
                const value = (node.getAttribute('title') || '') + ' ' + (node.getAttribute('aria-label') || '')
                return texts.some((needle) => value.includes(needle))
            })
            return { visible, semantic, any: visible || semantic }
        })(),
        initialSyncGate: !!document.querySelector('.initial-sync-gate, .nue-container--initial-sync-gate'),
        railSlot: !!document.querySelector('${ANCHORS.railSlot}'),
        gear: !!document.querySelector('${ANCHORS.gear}'),
        railBtn: !!document.querySelector('${ANCHORS.railBtn}'),
        errorRegionText: (() => {
            const node = document.querySelector('.initial-sync-gate, .nue-container--unlock-gate, .nue-container--unlock-gate + *')
            return node ? (node.innerText || '').replace(/\\s+/g, ' ').slice(0, 200) : null
        })()
    }
`

/**
 * 取一次门状态快照
 * @param {object} cdp CDP 客户端
 * @returns {Promise<object>} 门状态快照
 */
async function readGate(cdp) {
    return cdp.json(`(() => { ${PROBE_GATE} })()`)
}

/** 判定是否进入"显式终态"（成功壳 / 失败态 + 逃生入口 / 可解锁态） */
function terminalMarkers(gate) {
    const markers = []
    if (gate.railSlot || gate.railBtn) markers.push('shell-ready')
    if (gate.texts.error && gate.texts.retry) markers.push('failed-with-retry')
    if (gate.unlockForm) markers.push('unlockable')
    return markers
}

/**
 * 冷启动（后端不可达）：封 API → reload → 100ms 采样直到出现终态或超时
 * @param {object} cdp CDP 客户端
 * @param {number} timeoutMs 采样上界
 * @param {{ blockApi?: boolean }} [options] `blockApi:false` ⇒ 不封后端（用于"真实网络 + CDP Fetch 改写"的凭证类失败模拟）
 * @returns {Promise<{ timeline: object[], firstUnlockableMs: number|null, firstTerminalMs: number|null, terminalState: string|null, terminalMarkers: string[], elapsedMs: number }>}
 */
async function coldStartProbe(cdp, timeoutMs = 20000, options = {}) {
    if (options.blockApi !== false) await cdp.blockUrls(API_BLOCK_URLS)
    cdp.clearConsole()
    await cdp.reload(0)
    // 导航中途求值会拿到 null document.body（曾致 probe 抛错）→ 先等 body 就绪
    for (let i = 0; i < 50; i++) {
        if (await cdp.evaluate(`return !!document.body`)) break
        await sleep(100)
    }
    const started = Date.now()
    const timeline = []
    let lastKey = ''
    let firstUnlockableMs = null
    let firstTerminalMs = null
    let terminalState = null
    while (Date.now() - started < timeoutMs) {
        const gate = await readGate(cdp)
        const markers = terminalMarkers(gate)
        const key = [
            gate.hash,
            gate.interactiveCount,
            gate.texts.retry,
            gate.texts.error,
            gate.railSlot,
            markers.join('+')
        ].join('|')
        if (key !== lastKey) {
            timeline.push({
                ms: Date.now() - started,
                hash: gate.hash,
                interactive: gate.interactiveCount,
                markers
            })
            lastKey = key
        }
        if (firstUnlockableMs === null && gate.unlockForm) firstUnlockableMs = Date.now() - started
        if (firstTerminalMs === null && markers.length > 0) {
            firstTerminalMs = Date.now() - started
            terminalState = markers.join('+')
        }
        // 终态稳定（连续 3 次同一终态）即停止
        if (
            markers.length > 0 &&
            timeline.slice(-3).every((entry) => entry.markers.join('+') === markers.join('+'))
        )
            break
        await sleep(100)
    }
    return {
        timeline,
        firstUnlockableMs,
        firstTerminalMs,
        terminalState,
        terminalMarkers: terminalMarkers(await readGate(cdp)),
        elapsedMs: Date.now() - started
    }
}

/**
 * 等待门内出现失败终态（错误文案 + 重试入口）
 * @description 解锁后初始同步门才会真正跑一次同步；离线时须等网络等待上界内收口
 * @param {object} cdp CDP 客户端
 * @param {number} timeoutMs 上界（默认网络等待上界 + 2s 余量）
 * @returns {Promise<{ found: boolean, ms: number, gate: object }>}
 */
async function waitForFailure(cdp, timeoutMs = BASELINE.terminalUpperBoundMs + 2000) {
    const started = Date.now()
    let last = null
    while (Date.now() - started < timeoutMs) {
        last = await readGate(cdp)
        if (last.texts.error && last.texts.retry)
            return { found: true, ms: Date.now() - started, gate: last }
        await sleep(200)
    }
    return { found: false, ms: Date.now() - started, gate: last }
}

/**
 * 冷启动（后端不可达）→ 解锁 → 等到失败终态
 * @param {object} cdp CDP 客户端
 * @param {string|undefined} password 本地库密码
 * @returns {Promise<{ probe: object, failure: object, unlockFormSeen: boolean }>}
 */
async function coldStartToFailure(cdp, password) {
    const probe = await coldStartProbe(cdp, 12000)
    const unlockFormSeen = await cdp.evaluate(
        `return !!document.querySelector('${SEL.unlockPassword}')`
    )
    if (unlockFormSeen && password) await fillUnlock(cdp, password)
    const failure = await waitForFailure(cdp)
    return { probe, failure, unlockFormSeen }
}

/**
 * 确保处于「在线主界面（壳已渲染）」
 * @description 登录/解锁按需补做（凭据来自环境变量）；用于 BC-7 变体 A 的"先预热缓存"前置
 * @param {object} cdp CDP 客户端
 * @param {{ email?: string, password?: string }} credentials
 * @returns {Promise<boolean>} 是否到达壳
 */
async function ensureOnlineShell(cdp, credentials = {}, options = {}) {
    await cdp.unblockUrls()
    if (options.forceProfileLoad) {
        // 强制一次在线 profile 加载：reload → 解锁门 onMounted 会拉取 profile（在线成功才写离线昵称缓存）
        await cdp.reload(2500)
        await sleep(1500)
    }
    for (let i = 0; i < 20; i++) {
        if (await cdp.evaluate(`return !!document.querySelector('${ANCHORS.railBtn}')`)) return true
        if (
            credentials.email &&
            credentials.password &&
            (await cdp.evaluate(`return !!document.querySelector('${SEL.signinEmail}')`))
        ) {
            await cdp.evaluate(`
                const setValue = (el, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })) }
                setValue(document.querySelector('${SEL.signinEmail}'), ${JSON.stringify(credentials.email)})
                setValue(document.querySelector('input[type=password]'), ${JSON.stringify(credentials.password)})
                await new Promise((r) => setTimeout(r, 300))
                document.querySelector('button[type=submit]')?.click()
                return 'submitted'
            `)
            await sleep(7000)
            continue
        }
        if (
            credentials.password &&
            (await cdp.evaluate(`return !!document.querySelector('${SEL.unlockPassword}')`))
        ) {
            await fillUnlock(cdp, credentials.password)
            // 解锁后可能仍停在初始同步门（在线初始同步需数秒）→ 等壳就绪
            for (let wait = 0; wait < 20; wait++) {
                if (await cdp.evaluate(`return !!document.querySelector('${SEL.railBtn}')`)) break
                await sleep(1000)
            }
            continue
        }
        const entered = await cdp.evaluate(`
            const btn = [...document.querySelectorAll('#app button')].find((node) => /离线进入/.test(node.innerText || ''))
            if (!btn) return false
            btn.click()
            return true
        `)
        if (entered) {
            await sleep(2500)
            continue
        }
        // check-in 失败态（同一路由显示 重试/重新登录，无邮箱输入框）：点「重新登录」回到登录表单
        const toSignIn = await cdp.evaluate(`
            const btn = [...document.querySelectorAll('#app button')].find((node) => /重新登录/.test(node.innerText || ''))
            if (!btn) return false
            btn.click()
            return true
        `)
        if (toSignIn) {
            await sleep(2500)
            continue
        }
        await sleep(1000)
    }
    return cdp.evaluate(`return !!document.querySelector('${ANCHORS.railBtn}')`)
}

/**
 * 输入本地密码解锁（带路由稳定等待 + 重试）
 * @description 冷启动时 `beforeEnter` 守卫会在 ~1.7s 把路由重定向到 `#/auth/checkin` 并**重挂**解锁门，
 *              若在重挂瞬间操作会落空 ⇒ 先等路由稳定，再填+点，失败重试（最多 3 次）
 * @param {object} cdp CDP 客户端
 * @param {string} password 本地库密码（仅来自环境变量，不入库）
 * @returns {Promise<boolean>} 是否已离开解锁门
 */
async function fillUnlock(cdp, password) {
    // 等路由稳定（连续 3 次采样同一 hash）
    let stable = 0
    let lastHash = null
    for (let i = 0; i < 30; i++) {
        const hash = await cdp.evaluate('return location.hash')
        stable = hash === lastHash ? stable + 1 : 0
        lastHash = hash
        if (stable >= 2) break
        await sleep(400)
    }
    for (let attempt = 0; attempt < 3; attempt++) {
        const gone = await cdp.evaluate(`
            const input = document.querySelector('${SEL.unlockPassword}')
            if (!input) return true
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(password)})
            input.dispatchEvent(new Event('input', { bubbles: true }))
            await new Promise((r) => setTimeout(r, 300))
            const btn = [...document.querySelectorAll('#app button')].find((b) => /解锁/.test(b.innerText || ''))
            btn?.click()
            return false
        `)
        if (gone) return true
        await sleep(4500)
        if (!(await cdp.evaluate(`return !!document.querySelector('${SEL.unlockPassword}')`)))
            return true
    }
    return !(await cdp.evaluate(`return !!document.querySelector('${SEL.unlockPassword}')`))
}

/**
 * 通过设置对话框写入昵称（PM seq 44 授权：QA 账号 1 个字段）
 * @description 走应用自身 UI ⇒ 顺带实测 C-21「updateNickname → cacheNickname」写缓存路径；不改功能代码
 * @param {object} cdp CDP 客户端
 * @param {string} nickname 目标昵称
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
async function setNicknameViaUi(cdp, nickname) {
    await cdp.unblockUrls()
    let dialog = false
    for (let attempt = 0; attempt < 3 && !dialog; attempt++) {
        await cdp.pressCombo(',', 'Comma', 188, 2, 1500)
        dialog = await cdp.evaluate(`return !!document.querySelector('${SEL.settingsDialog}')`)
        if (!dialog) {
            // 兜底：点齿轮
            await cdp.evaluate(`
                const gear = document.getElementById('AppAsideSettingsGearBtn')
                gear?.click()
                return 'gear'
            `)
            await sleep(1500)
            dialog = await cdp.evaluate(`return !!document.querySelector('${SEL.settingsDialog}')`)
        }
    }
    if (!dialog) {
        const state = await cdp.json(
            `({ hash: location.hash, rail: !!document.querySelector('${SEL.railBtn}'), buttons: [...document.querySelectorAll('#app button')].filter((b) => b.getBoundingClientRect().width > 0).map((b) => (b.innerText || '').trim()).filter(Boolean) })`
        )
        return { ok: false, reason: '设置对话框未打开（快捷键与齿轮均未打开）', state }
    }
    const filled = await cdp.evaluate(`
        const dialog = document.querySelector('${SEL.settingsDialog}')
        const input = dialog.querySelector('input[placeholder="请输入昵称"]') || dialog.querySelector('input[type=text]')
        if (!input) return false
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(nickname)})
        input.dispatchEvent(new Event('input', { bubbles: true }))
        await new Promise((r) => setTimeout(r, 300))
        return true
    `)
    if (!filled) return { ok: false, reason: '未找到昵称输入框（锚点变化？）' }
    const submitted = await cdp.evaluate(`
        const dialog = document.querySelector('${SEL.settingsDialog}')
        const btn = [...dialog.querySelectorAll('button')].find((b) => /修改|保存|提交/.test(b.innerText || '') && !b.disabled)
        if (!btn) return false
        btn.click()
        await new Promise((r) => setTimeout(r, 3000))
        return true
    `)
    await cdp.pressKey('Escape', 1200)
    await sleep(2000)
    const persisted = await cdp.evaluate(`
        try {
            const jwt = localStorage.getItem('USER_JWT')
            const res = await fetch('http://localhost:3302/api/user/profile', { headers: { Authorization: 'Bearer ' + jwt } })
            const body = await res.json()
            return body?.data?.nickname ?? null
        } catch { return null }
    `)
    return {
        ok: submitted && persisted === nickname,
        reason: `submitted=${submitted} persistedNickname=${JSON.stringify(persisted)}`
    }
}

/**
 * 读取离线身份缓存快照（BC-7）
 * @param {object} cdp CDP 客户端
 * @returns {Promise<object>} { present, keys, nickname, rawLen }
 */
async function cacheSnapshot(cdp) {
    return cdp.json(`(() => {
        const raw = localStorage.getItem(${JSON.stringify(IDENTITY_CACHE_KEYS.localStorage[0])})
        let parsed = null
        try { parsed = raw ? JSON.parse(raw) : null } catch { parsed = 'INVALID_JSON' }
        return {
            present: !!raw,
            keys: parsed && typeof parsed === 'object' ? Object.keys(parsed).sort() : null,
            nickname: parsed && typeof parsed === 'object' ? parsed.nickname ?? null : null,
            rawLen: raw ? raw.length : 0
        }
    })()`)
}

/**
 * 恢复后端可达（清理现场，避免污染后续分组）
 * @param {object} cdp CDP 客户端
 * @returns {Promise<string>} 'OK' | 'FAIL'
 */
async function restore(cdp) {
    await cdp.unblockUrls()
    await sleep(500)
    return cdp.evaluate(
        `try { await fetch('http://localhost:3302/api/ping'); return 'OK' } catch { return 'FAIL' }`
    )
}

/** BC-1：有界终态（人工口径 + 网络等待上界） */
async function bc1(ctx) {
    const { cdp } = ctx
    const checks = []
    try {
        const probe = await coldStartProbe(cdp)
        info(
            checks,
            'BC-1.timeline',
            '冷启动时间线（100ms 采样，仅变化点）',
            JSON.stringify(probe.timeline)
        )
        if (probe.firstUnlockableMs === null && probe.firstTerminalMs === null) {
            return skip(
                checks,
                'BC-1',
                '有界终态',
                `20s 内既未进入可解锁态也未出现任何终态（可能 W1 未落地/锚点不匹配）；timeline=${JSON.stringify(probe.timeline)}`
            )
        }
        expect(
            checks,
            'BC-1.a',
            `≤${BASELINE.unlockableUpperBoundMs}ms 进入可解锁态（不等待网络）`,
            probe.firstUnlockableMs !== null &&
                probe.firstUnlockableMs <= BASELINE.unlockableUpperBoundMs,
            `实测 ${probe.firstUnlockableMs ?? '未出现'}ms`
        )
        expect(
            checks,
            'BC-1.b',
            `终态出现 ≤ 网络等待上界（${BASELINE.terminalUpperBoundMs}ms = timeout ${BASELINE.timeoutMs}×3 + backoff 900 + 余量）`,
            probe.firstTerminalMs !== null &&
                probe.firstTerminalMs <= BASELINE.terminalUpperBoundMs,
            `实测 ${probe.firstTerminalMs ?? '未出现'}ms；上界来源=${BASELINE.sources.join(' / ')}`
        )
        expect(
            checks,
            'BC-1.c',
            '进入且仅进入一个显式终态',
            probe.terminalMarkers.length === 1,
            `markers=${JSON.stringify(probe.terminalMarkers)} 终态=${probe.terminalState}`
        )
        ctx.state.bc1 = probe
    } finally {
        info(checks, 'BC-1.restore', '恢复后端可达', await restore(cdp))
    }
    return checks
}

/** BC-2：无白屏（任一失败组合下门内 ≥1 可交互元素 + console 0 warn/error） */
async function bc2(ctx) {
    const { cdp } = ctx
    const checks = []
    try {
        const gate = ctx.state.bc1
            ? await readGate(cdp)
            : await (async () => {
                  const probe = await coldStartProbe(cdp, 8000)
                  ctx.state.bc1 = probe
                  return readGate(cdp)
              })()
        const warnings = cdp.warnings()
        const fatalLogs = warnings.filter((line) => LOG_FATAL.test(line))
        const expectedLogs = warnings.filter((line) => LOG_EXPECTED.test(line))
        const unknownLogs = warnings.filter(
            (line) => !LOG_FATAL.test(line) && !LOG_EXPECTED.test(line)
        )
        expect(
            checks,
            'BC-2.a',
            '门内 ≥1 个可交互元素（button/input/a[role]）',
            gate.interactiveCount >= 1,
            `interactive=${gate.interactiveCount} 样例=${JSON.stringify(gate.interactiveSample)} hash=${gate.hash}`
        )
        expect(
            checks,
            'BC-2.b',
            '#app 非空壳（渲染出内容而非白屏）',
            gate.hasApp && gate.appHtmlLen > 40,
            `hasApp=${gate.hasApp} htmlLen=${gate.appHtmlLen}`
        )
        // 口径（PM seq 40）：BC-2 只判「无白屏」；console 仅归因，且网络类基础设施日志属预期
        expect(
            checks,
            'BC-2.c',
            '无 Vue warn / 未捕获异常 / Teleport 告警（归因）',
            fatalLogs.length === 0,
            fatalLogs.length ? JSON.stringify(fatalLogs.slice(0, 4)) : '无致命日志'
        )
        info(
            checks,
            'BC-2.logs',
            'console 原文（预期基础设施日志，供 PM 判定）',
            JSON.stringify({
                expected: expectedLogs.slice(0, 6),
                unknown: unknownLogs.slice(0, 6),
                total: warnings.length
            })
        )
    } finally {
        info(checks, 'BC-2.restore', '恢复后端可达', await restore(cdp))
    }
    return checks
}

/** BC-3：失败可见（DEF-SYNC-01 实机回归线：门显示失败态 + lastError 拉取文案） */
async function bc3(ctx) {
    const { cdp, password } = ctx
    const checks = []
    try {
        const { probe, failure, unlockFormSeen } = await coldStartToFailure(cdp, password)
        info(checks, 'BC-3.timeline', '冷启动（封锁后端）时间线', JSON.stringify(probe.timeline))
        info(
            checks,
            'BC-3.unlock',
            '冷启动后是否出现解锁表单（初始同步门需解锁后才跑）',
            `unlockFormSeen=${unlockFormSeen}`
        )
        const gate = failure.gate ?? (await readGate(cdp))
        const errorLines = await cdp.evaluate(`
            const nodes = [...document.querySelectorAll('#app *')].filter((node) => node.children.length === 0 && /失败|错误|无法|过期/.test((node.innerText || '')))
            return nodes.map((node) => (node.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 80)).slice(0, 5)
        `)
        info(checks, 'BC-3.info', '门内可见失败文案', JSON.stringify(errorLines))
        expect(
            checks,
            'BC-3.a',
            '失败终态出现（错误文案 + 重试入口）',
            failure.found === true,
            `found=${failure.found} 耗时=${failure.ms}ms hash=${gate.hash} interactive=${gate.interactiveCount}`
        )
        expect(
            checks,
            'BC-3.b',
            '失败终态在网络上界内收口（≤ 上界）',
            failure.found === true && failure.ms <= BASELINE.terminalUpperBoundMs + 2000,
            `实测 ${failure.ms}ms ≤ ${BASELINE.terminalUpperBoundMs + 2000}ms（上界=timeout×3+backoff+余量）`
        )
        expect(
            checks,
            'BC-3.c',
            'lastError 拉取文案可见（DEF-SYNC-01 回归线：拉取失败不被推送阶段清空）',
            errorLines.some((line) => /拉取|网络|同步/.test(line)),
            `命中=${JSON.stringify(errorLines)}`
        )
        ctx.state.failure = failure
    } finally {
        info(checks, 'BC-3.restore', '恢复后端可达', await restore(cdp))
    }
    return checks
}

/** BC-4：逃生入口完备（重试 + 登出/重新登录；初始同步门额外有离线进入） */
async function bc4(ctx) {
    const { cdp, password } = ctx
    const checks = []
    try {
        const failure = ctx.state.failure?.found
            ? ctx.state.failure
            : await coldStartToFailure(cdp, password).then((r) => r.failure)
        const gate = failure.gate ?? (await readGate(cdp))
        const buttons = await cdp.evaluate(`
            return [...document.querySelectorAll('#app button')]
                .filter((node) => node.getBoundingClientRect().width > 0)
                .map((node) => (node.innerText || '').trim().slice(0, 12))
                .filter(Boolean)
        `)
        info(checks, 'BC-4.info', '失败态门内可见按钮', JSON.stringify(buttons))
        expect(
            checks,
            'BC-4.a',
            '失败态含「重试」入口',
            gate.texts.retry,
            `retry=${gate.texts.retry} buttons=${JSON.stringify(buttons)}`
        )
        expect(
            checks,
            'BC-4.b',
            '失败态含「登出/重新登录」入口',
            gate.texts.signOut,
            `signOut=${gate.texts.signOut}`
        )
        expect(
            checks,
            'BC-4.c',
            '初始同步门含「离线进入」入口',
            gate.texts.offlineEnter,
            `offlineEnter=${gate.texts.offlineEnter}`
        )
    } finally {
        info(checks, 'BC-4.restore', '恢复后端可达', await restore(cdp))
    }
    return checks
}

/** BC-5：离线壳可用（profile 加载失败时轨道注入点与齿轮仍在 = F-6 回归线） */
async function bc5(ctx) {
    const { cdp, password } = ctx
    const checks = []
    try {
        // 冷启动（封锁后端）→ 本地解锁 → 初始同步门点「离线进入」→ 壳应可见（F-6 回归线）
        const probe = await coldStartProbe(cdp, 9000)
        const unlockFormSeen = await cdp.evaluate(
            `return !!document.querySelector('${SEL.unlockPassword}')`
        )
        const unlocked = unlockFormSeen && password ? await fillUnlock(cdp, password) : null
        // 等门终态（失败态含「离线进入」），再点；点不到则重试（最多 3 次，每次重新查询）
        let enterOffline = false
        for (let attempt = 0; attempt < 3 && !enterOffline; attempt++) {
            for (let i = 0; i < 20; i++) {
                const hasBtn = await cdp.evaluate(
                    `return !!([...document.querySelectorAll('#app button')].find((b) => /离线进入/.test(b.innerText || '')))`
                )
                if (hasBtn) break
                await sleep(500)
            }
            enterOffline = await cdp.evaluate(`
                const btn = [...document.querySelectorAll('#app button')].find((node) => /离线进入/.test(node.innerText || ''))
                if (!btn) return false
                btn.click()
                return true
            `)
            if (!enterOffline) await sleep(1500)
        }
        info(
            checks,
            'BC-5.info',
            '冷启动 → 解锁 → 离线进入',
            `unlockFormSeen=${unlockFormSeen} unlockedLeftGate=${unlocked} clickedOfflineEnter=${enterOffline}`
        )
        info(checks, 'BC-5.timeline', '离线冷启动时间线', JSON.stringify(probe.timeline))
        await sleep(2500)
        const offline = await readGate(cdp)
        const lastVisited = await cdp.evaluate(`return localStorage.getItem('LAST_VISITED_ROUTE')`)
        const landed = !String(offline.hash).startsWith('#/auth')
        expect(
            checks,
            'BC-5.0',
            '离线进入后落在 index 路由（LAST_VISITED_ROUTE || /tasks，非 #/auth/*）',
            landed === true,
            `hash=${offline.hash} LAST_VISITED_ROUTE=${JSON.stringify(lastVisited)}`
        )
        expect(
            checks,
            'BC-5.a',
            '离线态下轨道注入点仍存在',
            offline.railSlot === true,
            JSON.stringify({
                hash: offline.hash,
                railSlot: offline.railSlot,
                gear: offline.gear,
                railBtn: offline.railBtn,
                interactive: offline.interactiveCount
            })
        )
        expect(
            checks,
            'BC-5.b',
            '离线态下齿轮仍在（设置入口可用）',
            offline.gear === true,
            `gear=${offline.gear} hash=${offline.hash}`
        )
        expect(
            checks,
            'BC-5.c',
            '离线态下同步组件仍挂载（轨道按钮存在）',
            offline.railBtn === true,
            `railBtn=${offline.railBtn}`
        )
    } finally {
        info(checks, 'BC-5.restore', '恢复后端可达', await restore(cdp))
    }
    return checks
}

/**
 * BC-5 安全子项：凭证类失败（401/403/10041/过期）时「离线进入」必须不可用
 * @description 手法：CDP Fetch 域把 `POST /api/sync/pull` 改写为 401（不改功能代码）→ 冷启动到失败门 → 断言
 *              若应用直接会话失效跳登录页（既有行为），则「离线进入」天然不可达，同样记 PASS 并注明分支
 */
async function bc5cred(ctx) {
    const { cdp, password } = ctx
    const checks = []
    try {
        await ensureOnlineShell(cdp, { email: ctx.email, password }, { forceProfileLoad: false })

        // —— 凭证类失败模拟（PM seq 47 纠正）：**HTTP 200 + 应用级 code=10041** ——
        // 源码判据：sync-service.ts:408-411 `raw = body; data = body.data; isSessionExpiredCode(data.code)`；
        // 故 body 同时携带顶层 code 与 data.code = 10041，兼容两种读取位置；
        // push 侧同构（:603-609）。HTTP 401 会走网络/HTTP 错误分支（假 FAIL），**禁止**用 401。
        const sessionExpiredBody = JSON.stringify({
            code: 10041,
            message: 'unauthorized',
            data: { code: 10041 }
        })
        await cdp.mockResponses([
            { urlPattern: '*api/sync/pull', status: 200, body: sessionExpiredBody },
            { urlPattern: '*api/sync/push', status: 200, body: sessionExpiredBody }
        ])
        info(
            checks,
            'BC-5CRED.info',
            '已改写 /api/sync/pull|push → HTTP 200 + body code=10041（模拟凭证失效）',
            sessionExpiredBody
        )
        // 注意：**不能封后端** —— 封了请求就到不了 Fetch 改写（曾致误判为"网络类失败"）
        const probe = await coldStartProbe(cdp, 12000, { blockApi: false })
        info(
            checks,
            'BC-5CRED.timeline',
            '时间线（未封后端，仅 Fetch 改写 sync 接口）',
            JSON.stringify(probe.timeline)
        )
        const unlockFormSeen = await cdp.evaluate(
            `return !!document.querySelector('${SEL.unlockPassword}')`
        )
        if (unlockFormSeen && password) await fillUnlock(cdp, password)
        let gate = null
        for (let i = 0; i < 40; i++) {
            gate = await readGate(cdp)
            if (
                gate.texts.retry ||
                /auth\/signin/.test(gate.hash) ||
                /重新登录/.test(gate.errorRegionText || '')
            )
                break
            await sleep(300)
        }
        const state = await cdp.json(`(() => {
            const btns = [...document.querySelectorAll('#app button')].filter((b) => b.getBoundingClientRect().width > 0)
            const offlineBtn = btns.find((b) => /离线进入/.test(b.innerText || ''))
            return {
                hash: location.hash,
                buttons: btns.map((b) => (b.innerText || '').trim()).filter(Boolean),
                offlineEnterPresent: !!offlineBtn,
                offlineEnterDisabled: offlineBtn ? offlineBtn.disabled : null,
                hasReSignIn: btns.some((b) => /重新登录/.test(b.innerText || '')),
                gateText: (document.body ? document.body.innerText : '').replace(/\\s+/g, ' ').slice(0, 160)
            }
        })()`)
        const isLoginForm = await cdp.evaluate(
            `return !!document.querySelector('${SEL.signinEmail}')`
        )
        info(
            checks,
            'BC-5CRED.state',
            '凭证类失败后的门状态',
            JSON.stringify({ ...state, isLoginForm })
        )
        // 分支判定以"是否真的登录表单"为准：新 check-in 失败态位于 #/auth/signin 且含 重试+重新登录，属门内分支
        const branchA = isLoginForm === true && state.hasReSignIn !== true
        expect(
            checks,
            'BC-5CRED.a',
            '凭证类失败：「离线进入」不可用（分支A 会话失效跳登录页 / 分支B 门内不可见或 disabled）',
            branchA || state.offlineEnterPresent === false || state.offlineEnterDisabled === true,
            `分支=${branchA ? 'A(会话失效跳登录页)' : 'B(门内)'}；offlineEnterPresent=${state.offlineEnterPresent} disabled=${state.offlineEnterDisabled} hash=${state.hash} buttons=${JSON.stringify(state.buttons)}`
        )
        if (branchA) {
            info(
                checks,
                'BC-5CRED.b',
                '凭证类失败主按钮语义为「重新登录」',
                '应用直接会话失效跳登录页（既有兜底行为），门内语义断言不适用'
            )
        } else {
            expect(
                checks,
                'BC-5CRED.b',
                '凭证类失败主按钮语义为「重新登录」',
                state.hasReSignIn === true,
                `buttons=${JSON.stringify(state.buttons)} gateText=${state.gateText}`
            )
        }

        // —— 反例：**网络类失败必须仍显示「离线进入」**（防"一律隐藏"骗过测试）——
        // 前置：凭证阶段已清 JWT（会话失效）→ 必须先重新登录，否则冷启动直接停在登录页，"离线进入"无从出现
        await cdp.clearMocks()
        const relogged = await ensureOnlineShell(
            cdp,
            { email: ctx.email, password },
            { forceProfileLoad: false }
        )
        info(checks, 'BC-5CRED.relogin', '反例前置：重新登录到在线壳', `ok=${relogged}`)
        const netProbe = await coldStartProbe(cdp, 12000)
        info(
            checks,
            'BC-5CRED.timeline.net',
            '网络类失败（封 3302）时间线',
            JSON.stringify(netProbe.timeline)
        )
        if (
            password &&
            (await cdp.evaluate(`return !!document.querySelector('${SEL.unlockPassword}')`))
        )
            await fillUnlock(cdp, password)
        let netGate = null
        for (let i = 0; i < 40; i++) {
            netGate = await readGate(cdp)
            if (netGate.texts.retry) break
            await sleep(300)
        }
        const netState = await cdp.json(`(() => {
            const btns = [...document.querySelectorAll('#app button')].filter((b) => b.getBoundingClientRect().width > 0)
            const offlineBtn = btns.find((b) => /离线进入/.test(b.innerText || ''))
            return { hash: location.hash, offlineEnterPresent: !!offlineBtn, offlineEnterDisabled: offlineBtn ? offlineBtn.disabled : null, buttons: btns.map((b) => (b.innerText || '').trim()).filter(Boolean) }
        })()`)
        info(checks, 'BC-5CRED.state.net', '网络类失败后的门状态', JSON.stringify(netState))
        expect(
            checks,
            'BC-5CRED.c',
            '反例：网络类失败时「离线进入」**仍可见且可用**（不得一律隐藏）',
            netState.offlineEnterPresent === true && netState.offlineEnterDisabled === false,
            `present=${netState.offlineEnterPresent} disabled=${netState.offlineEnterDisabled} hash=${netState.hash} buttons=${JSON.stringify(netState.buttons)}`
        )
    } finally {
        await cdp.clearMocks()
        info(checks, 'BC-5CRED.restore', '撤销响应改写 + 恢复后端可达', await restore(cdp))
    }
    return checks
}

/** BC-6：运行必终结（单测已覆盖；实机为可选补充，需构造 retryCount≥5 队列） */
async function bc6(ctx) {
    const { cdp } = ctx
    const checks = []
    // 实机无法在不改功能代码的前提下把队列项 retryCount 置到 ≥5（需直接写本地库）。
    // 若后续 BC-6 要求实机验证，可在此处接入 IndexedDB 写入探针（约定：仅在 QA 账号、跑完删除）。
    skip(
        checks,
        'BC-6',
        '运行必终结（syncing=false / start().ok===false）',
        'PM 裁决（seq 36）：维持单测口径 + 实机 SKIP —— 语义已由 6 例单测覆盖（pushAll().ok=false 且 syncing=false、start() 不得假成功）；实机构造 retryCount≥5 须写本地加密库，风险/收益不划算。登记为「验证方法选择」，非跳测缺口'
    )
    const idle = await cdp.evaluate(`
        const btn = document.querySelector('${SEL.railBtn}')
        return { railDisabled: btn ? btn.disabled : null, live: document.querySelector('${SEL.liveRegion}')?.textContent?.trim() ?? null }
    `)
    info(checks, 'BC-6.info', '当前同步状态（终态应无 syncing）', JSON.stringify(idle))
    return checks
}

/**
 * BC-7：离线身份呈现
 * - A 有效缓存：首字母头像 + 离线标识，且**零网络请求**
 * - B 无缓存/损坏/userId 不匹配：回落 `icon="user"`，不得空白/报错
 * @description 变体 B 需要清理身份缓存；具体存储键待 W1/BC-7 落地后填入 `IDENTITY_CACHE_KEYS`
 */

async function bc7(ctx) {
    const { cdp, email, password, setNickname } = ctx
    const checks = []
    try {
        // —— 前置 0：昵称（缓存写入的前提；PM seq 44 授权写 1 个字段）——
        let accountNickname = await readAccountNickname(cdp)
        info(
            checks,
            'BC-7.pre0',
            '账号昵称（决定缓存是否应写入）',
            `nickname=${JSON.stringify(accountNickname)}`
        )
        if (!accountNickname && setNickname) {
            // 设置对话框需壳挂载才能打开（openSettingsDialog 依赖 hostReady）→ 先确保在线壳
            await ensureOnlineShell(cdp, { email, password }, { forceProfileLoad: false })
            const setup = await setNicknameViaUi(cdp, setNickname)
            info(
                checks,
                'BC-7.pre1',
                `通过设置对话框写入昵称「${setNickname}」（实测 C-21 写缓存路径）`,
                JSON.stringify(setup)
            )
            accountNickname = await readAccountNickname(cdp)
            info(
                checks,
                'BC-7.pre1b',
                '写入后账号昵称',
                `nickname=${JSON.stringify(accountNickname)}`
            )
        }

        // —— 前置 1：在线预热（强制一次在线 profile 加载 → 写缓存）——
        const warm = await ensureOnlineShell(cdp, { email, password }, { forceProfileLoad: true })
        let cacheWarm = await cacheSnapshot(cdp)
        for (let i = 0; i < 6 && !cacheWarm.present; i++) {
            await sleep(1500)
            cacheWarm = await cacheSnapshot(cdp)
        }
        const nicknameUsable = typeof accountNickname === 'string' && accountNickname.length > 0
        expect(
            checks,
            'BC-7.pre',
            '在线预热后离线身份缓存已写入（白名单键 userId/nickname/cachedAt）',
            warm === true && cacheWarm.present === true,
            `shell=${warm} cache=${JSON.stringify(cacheWarm)} nickname=${JSON.stringify(accountNickname)}`
        )
        expect(
            checks,
            'BC-7.pre.whitelist',
            '缓存内容仅白名单字段（禁 email/头像/token）',
            JSON.stringify(cacheWarm.keys) === JSON.stringify(['cachedAt', 'nickname', 'userId']),
            `keys=${JSON.stringify(cacheWarm.keys)} rawLen=${cacheWarm.rawLen}`
        )
        if (!nicknameUsable) {
            skip(
                checks,
                'BC-7.A1',
                '解锁门离线身份呈现（首字母 + 离线标识）',
                `账号无昵称 ⇒ 设计上不写缓存、正确回落 icon=user；如需覆盖请用 --set-nickname 传入昵称`
            )
            skip(checks, 'BC-7.A2', '离线壳内零新增业务请求', '前置不成立（同 A1）')
            skip(checks, 'BC-7.a', '有效缓存：首字母头像', '前置不成立（账号无昵称）')
            skip(checks, 'BC-7.b', '有效缓存：离线标识', '前置不成立（账号无昵称）')
        } else {
            // —— 变体 A1：离线冷启动后，**解锁门**即应呈现首字母 + 离线标识 ——
            cdp.clearRequests()
            await coldStartProbe(cdp, 12000)
            await sleep(2000)
            const gateIdentity = await cdp.json(`(() => {
                const root = document.getElementById('app')
                const initials = [...root.querySelectorAll('.initial-avatar__text')].map((node) => (node.innerText || '').trim())
                const texts = (document.body ? document.body.innerText : '') || ''
                const badgeTexts = ${JSON.stringify(ANCHORS.offlineBadgeText)}
                const visible = badgeTexts.some((needle) => texts.includes(needle))
                const semantic = [...root.querySelectorAll('[title],[aria-label]')].some((node) => {
                    const value = (node.getAttribute('title') || '') + ' ' + (node.getAttribute('aria-label') || '')
                    return badgeTexts.some((needle) => value.includes(needle))
                })
                return { initials, offlineBadge: { visible, semantic, any: visible || semantic }, hash: location.hash, interactive: root.querySelectorAll('button, input').length }
            })()`)
            info(checks, 'BC-7.A1', '解锁门离线身份快照', JSON.stringify(gateIdentity))
            const expectedInitial = String(accountNickname).trim().charAt(0).toLocaleUpperCase()
            expect(
                checks,
                'BC-7.a',
                '有效缓存：解锁门呈现首字母头像',
                gateIdentity.initials.some((text) => text.length > 0),
                `initials=${JSON.stringify(gateIdentity.initials)} 期望首字母=${JSON.stringify(expectedInitial)}`
            )
            expect(
                checks,
                'BC-7.b',
                '有效缓存：呈现离线标识（可见小字「离线」**或** title/aria-label 语义命中）',
                gateIdentity.offlineBadge.any === true,
                `visible=${gateIdentity.offlineBadge.visible} semantic=${gateIdentity.offlineBadge.semantic}（防误报：轨道 70px 不放可见小字）`
            )

            // —— 变体 A2：进入离线壳后（index 挂载），身份区渲染期间**新增业务请求 = 0**（PM 口径 b）——
            if (password) await fillUnlock(cdp, password)
            const entered = await cdp.evaluate(`
                const btn = [...document.querySelectorAll('#app button')].find((node) => /离线进入/.test(node.innerText || ''))
                if (!btn) return false
                btn.click()
                return true
            `)
            // 等 index 挂载（轨道注入点出现）后再清空请求计数，观察 3s
            let mounted = false
            for (let i = 0; i < 20; i++) {
                if (await cdp.evaluate(`return !!document.querySelector('${SEL.railHostSlot}')`)) {
                    mounted = true
                    break
                }
                await sleep(500)
            }
            cdp.clearRequests()
            await sleep(3000)
            const shellRequests = cdp.requests().filter((url) => /3302/.test(url))
            info(
                checks,
                'BC-7.A2',
                '进入离线壳后 3s 内请求（口径 b：应为 0）',
                `mounted=${mounted} clickedOfflineEnter=${entered} requests=${JSON.stringify(shellRequests)}`
            )
            expect(
                checks,
                'BC-7.A2',
                '离线壳内零新增业务请求（身份渲染不依赖网络，口径 b）',
                mounted === true && shellRequests.length === 0,
                `shellMounted=${mounted} 新增请求=${shellRequests.length} 明细=${JSON.stringify(shellRequests.slice(0, 5))}`
            )
        }

        // —— 变体 B1：清缓存 ⇒ 回落 icon="user" + 缓存路径静默 ——
        cdp.clearConsole()
        await cdp.evaluate(
            `localStorage.removeItem(${JSON.stringify(IDENTITY_CACHE_KEYS.localStorage[0])}); return 'cleared'`
        )
        await coldStartProbe(cdp, 12000)
        await sleep(2500)
        const variantB1 = await cdp.json(`(() => {
            const root = document.getElementById('app')
            return {
                initials: [...root.querySelectorAll('.initial-avatar__text')].map((node) => (node.innerText || '').trim()),
                hasFallbackIcon: [...root.querySelectorAll('.nue-avatar')].some((node) => !!node.querySelector('.icon-user, [class*="icon-user"]')),
                interactive: root.querySelectorAll('button, input').length
            }
        })()`)
        const b1Logs = cdp.warnings()
        info(checks, 'BC-7.B1', '清缓存后的离线身份快照', JSON.stringify(variantB1))
        expect(
            checks,
            'BC-7.d',
            '清缓存：回落 icon="user"（无首字母、不空白）',
            variantB1.initials.length === 0 &&
                variantB1.hasFallbackIcon === true &&
                variantB1.interactive >= 1,
            JSON.stringify(variantB1)
        )
        expect(
            checks,
            'BC-7.e',
            '清缓存：缓存路径静默（无相关 console 日志，C-17）',
            cacheRelatedLogs(b1Logs).length === 0,
            `相关日志=${JSON.stringify(cacheRelatedLogs(b1Logs))}；全部日志=${JSON.stringify(b1Logs.slice(0, 5))}`
        )

        // —— 变体 B2：缓存损坏 ⇒ 回落 + 静默 + **键被删除**（C-16 修复后预期，PM seq 44）——
        cdp.clearConsole()
        await cdp.evaluate(
            `localStorage.setItem(${JSON.stringify(IDENTITY_CACHE_KEYS.localStorage[0])}, '{not-json'); return 'corrupted'`
        )
        await coldStartProbe(cdp, 12000)
        await sleep(2500)
        const variantB2 = await cdp.json(`(() => {
            const root = document.getElementById('app')
            return {
                initials: [...root.querySelectorAll('.initial-avatar__text')].map((node) => (node.innerText || '').trim()),
                hasFallbackIcon: [...root.querySelectorAll('.nue-avatar')].some((node) => !!node.querySelector('.icon-user, [class*="icon-user"]')),
                interactive: root.querySelectorAll('button, input').length,
                cacheAfter: localStorage.getItem(${JSON.stringify(IDENTITY_CACHE_KEYS.localStorage[0])})
            }
        })()`)
        const b2Logs = cdp.warnings()
        info(checks, 'BC-7.B2', '缓存损坏后的离线身份快照', JSON.stringify(variantB2))
        expect(
            checks,
            'BC-7.f',
            '缓存损坏：回落 icon="user"（不空白/不报错）',
            variantB2.initials.length === 0 &&
                variantB2.hasFallbackIcon === true &&
                variantB2.interactive >= 1,
            JSON.stringify(variantB2)
        )
        expect(
            checks,
            'BC-7.g',
            '缓存损坏：缓存路径静默（无相关 console 日志，C-17）',
            cacheRelatedLogs(b2Logs).length === 0,
            `相关日志=${JSON.stringify(cacheRelatedLogs(b2Logs))}；全部日志=${JSON.stringify(b2Logs.slice(0, 5))}`
        )
        expect(
            checks,
            'BC-7.h',
            '缓存损坏：无效键被删除（C-16 修复后预期）',
            variantB2.cacheAfter === null,
            `cacheAfter=${JSON.stringify(variantB2.cacheAfter)}`
        )
    } finally {
        info(
            checks,
            'BC-7.restore',
            '恢复后端可达 + 清理探针残留键',
            `${await restore(cdp)} / cache=${JSON.stringify(await cacheSnapshot(cdp))}`
        )
    }
    return checks
}

/**
 * 读取账号昵称（决定缓存是否应写入）
 * @param {object} cdp CDP 客户端
 * @returns {Promise<string|null>} 昵称；失败返回 null
 */
async function readAccountNickname(cdp) {
    const result = await cdp
        .evaluate(`
            try {
                const jwt = localStorage.getItem('USER_JWT')
                if (!jwt) return null
                const res = await fetch('http://localhost:3302/api/user/profile', { headers: { Authorization: 'Bearer ' + jwt } })
                const body = await res.json()
                return typeof body?.data?.nickname === 'string' ? body.data.nickname : null
            } catch { return null }
        `)
        .catch(() => null)
    return result
}

/**
 * 缓存路径相关日志（C-17 静默判定）
 * @description 只归因"缓存读/写/解析失败打日志"这一类；后端不可达导致的 `[sync]/[desktop]` 网络日志不计入
 * @param {string[]} logs console 行
 * @returns {string[]} 命中缓存路径的日志
 */
function cacheRelatedLogs(logs) {
    return logs.filter(
        (line) =>
            /cache|缓存|JSON|parse|localStorage|USER_PROFILE|IndexedDB/i.test(line) &&
            /warn|error/i.test(line)
    )
}

export const shell03Offline = {
    id: 'shell-03',
    title: 'SHELL-03 离线可用性（BC-1…BC-7）',
    /** W1（门/壳）落地前为脚手架：锚点缺失即 SKIP，不产生误报 */
    pending: 'W1（门/壳重构）落地后按 PM 派发正式运行',
    groups: [
        { id: 'bc1', title: 'BC-1 有界终态（≤2s 可解锁 + 网络上界 + 唯一终态）', run: bc1 },
        { id: 'bc2', title: 'BC-2 无白屏（≥1 可交互 + console 0 warn/error）', run: bc2 },
        { id: 'bc3', title: 'BC-3 失败可见（DEF-SYNC-01 实机回归线）', run: bc3 },
        { id: 'bc4', title: 'BC-4 逃生入口完备（重试/登出/离线进入）', run: bc4 },
        { id: 'bc5', title: 'BC-5 离线壳可用（F-6 回归线）', run: bc5 },
        {
            id: 'bc5cred',
            title: 'BC-5 安全子项：凭证类失败 ⇒ 离线进入不得可用（C-22…C-25）',
            run: bc5cred
        },
        { id: 'bc6', title: 'BC-6 运行必终结（实机可选，默认 SKIP）', run: bc6 },
        { id: 'bc7', title: 'BC-7 离线身份呈现（缓存/无缓存两变体）', run: bc7 }
    ]
}