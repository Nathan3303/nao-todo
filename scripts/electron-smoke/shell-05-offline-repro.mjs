/**
 * SHELL-05 离线进入复现 / 证据抓取（**只测不改**）
 *
 * 目的：复现「断网冷启动 → 解锁 → 点『离线进入』无反应」，并抓取判定 H1…H5 所需的原始证据。
 *
 * 用法（先手动起 Electron，共享 `run.mjs --launch` 同款开关）：
 *   pnpm --filter @nao-todo/desktopapp dev --noSandbox --remoteDebuggingPort 9333
 *   node scripts/electron-smoke/shell-05-offline-repro.mjs \
 *     --email <qa> --password <qa> --out /tmp/shell05
 *
 * 说明：
 * - 本脚本**不修改任何功能代码**；仅在渲染进程注入只读探针（console/unhandledrejection/error 监听）。
 * - 账号：建议使用一次性 QA 账号（本脚本会在线登录并建立本地密钥包，随后封锁后端模拟离线）。
 * - 证据：把关键 JSON/文本写入 `--out`，供报告引用。
 */
import fs from 'node:fs'
import { join } from 'node:path'
import { connectRenderer, sleep } from './lib/cdp.mjs'

const API_BLOCK_URLS = ['*localhost:3302*', '*127.0.0.1:3302*']

const args = parseArgs(process.argv.slice(2))
const outDir = args.out ?? '/tmp/shell05'
const email = args.email
const password = args.password
const lastVisited = args.lastVisited
const lastTasks = args.lastTasks
if (!email || !password) {
    console.error('缺少 --email / --password')
    process.exit(2)
}
fs.mkdirSync(outDir, { recursive: true })

/** 渲染进程探针（只读：包装 console + 捕获未处理拒绝/全局错误） */
const INJECT = `
(() => {
    if (window.__shell05) return 'already'
    const store = (window.__shell05 = { inline: [], console: [], rejections: [], errors: [], startedAt: Date.now() })
    for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
        const orig = console[level].bind(console)
        console[level] = (...a) => {
            try {
                store.console.push({
                    t: Date.now(),
                    level,
                    msg: a.map((x) => {
                        try { return typeof x === 'string' ? x : (x && (x.stack || x.message)) || JSON.stringify(x) } catch { return String(x) }
                    }).join(' ').slice(0, 800)
                })
            } catch {}
            orig(...a)
        }
    }
    window.addEventListener('unhandledrejection', (e) => {
        const r = e.reason
        store.rejections.push({
            t: Date.now(),
            name: r && r.name,
            reason: String(r && (r.stack || r.message || r)).slice(0, 2000)
        })
    })
    window.addEventListener('error', (e) => {
        store.errors.push({ t: Date.now(), msg: String(e.message).slice(0, 500), stack: String(e.error && e.error.stack).slice(0, 2000) })
    })
    return 'installed'
})()
`

const cdp = await connectRenderer({ port: args.port, urlMatch: args.urlMatch })
await cdp.focusPage()
// 让探针在每个新文档（reload/冷启动）自动安装
await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: INJECT })
await cdp.evaluate(INJECT)

const evidence = { meta: { email, startedAt: new Date().toISOString() }, phases: {} }

/** 门/壳状态快照 */
async function snapshot(label) {
    const dom = await cdp.json(`(() => {
        const app = document.getElementById('app')
        const interactive = [...document.querySelectorAll('#app button, #app input, #app textarea, #app select, #app a[href], #app [role=button]')]
            .filter((n) => {
                const b = n.getBoundingClientRect()
                const s = getComputedStyle(n)
                return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !n.disabled
            })
        let routerState = null
        try {
            const r = app && app.__vue_app__ && app.__vue_app__.config.globalProperties.$router
            const cur = r && r.currentRoute && r.currentRoute.value
            if (cur) routerState = {
                name: cur.name,
                path: cur.path,
                fullPath: cur.fullPath,
                params: cur.params,
                query: cur.query,
                matched: cur.matched.map((m) => m.name)
            }
        } catch (e) { routerState = 'ERR:' + e.message }
        return {
            hash: location.hash,
            router: routerState,
            interactiveCount: interactive.length,
            interactiveSample: interactive.slice(0, 6).map((n) => (n.innerText || n.placeholder || n.tagName).trim().slice(0, 16)),
            initialSyncGate: !!document.querySelector('.initial-sync-gate, .nue-container--initial-sync-gate'),
            unlockGate: !!document.querySelector('.nue-container--unlock-gate'),
            railSlot: !!document.querySelector('#AppAsideRailBottomSlot'),
            railBtn: !!document.querySelector('.sync-rail-btn'),
            gear: !!document.querySelector('#AppAsideSettingsGearBtn'),
            appHtmlLen: app ? app.innerHTML.length : -1,
            bodyText: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 320),
            offlineEnterBtn: [...document.querySelectorAll('#app button')].some((b) => /离线进入/.test(b.innerText || ''))
        }
    })()`)
    return { label, at: Date.now(), dom }
}

/** 渲染进程探针事件（保留最近 N 条） */
async function events(limit = 120) {
    return cdp.json(`(() => {
        const s = window.__shell05
        if (!s) return null
        const tail = (arr) => arr.slice(-${limit})
        return {
            console: tail(s.console),
            rejections: tail(s.rejections),
            errors: tail(s.errors)
        }
    })()`)
}

async function fillUnlock(pwd) {
    // 等路由稳定
    let stable = 0
    let last = null
    for (let i = 0; i < 25; i++) {
        const hash = await cdp.evaluate('return location.hash')
        stable = hash === last ? stable + 1 : 0
        last = hash
        if (stable >= 2) break
        await sleep(400)
    }
    for (let attempt = 0; attempt < 3; attempt++) {
        const gone = await cdp.evaluate(`
            const input = document.querySelector('.nue-container--unlock-gate input[type=password]')
            if (!input) return true
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(pwd)})
            input.dispatchEvent(new Event('input', { bubbles: true }))
            await new Promise((r) => setTimeout(r, 300))
            const btn = [...document.querySelectorAll('#app button')].find((b) => /解锁/.test(b.innerText || ''))
            btn?.click()
            return false
        `)
        if (gone) return true
        await sleep(4000)
        if (!(await cdp.evaluate(`return !!document.querySelector('.nue-container--unlock-gate input[type=password]')`))) return true
    }
    return false
}

/** 在线引导：登录（必要时）→ 到壳 */
async function ensureOnlineShell(maxIters = 40) {
    const notes = []
    for (let i = 0; i < maxIters; i++) {
        const st = await cdp.json(`(() => ({
            rail: !!document.querySelector('.sync-rail-btn'),
            hash: location.hash,
            hasSignin: !!document.querySelector('input[type=email]'),
            hasUnlock: !!document.querySelector('.nue-container--unlock-gate input[type=password]'),
            hasGate: !!document.querySelector('.initial-sync-gate, .nue-container--initial-sync-gate')
        }))()`)
        if (st.rail) return { ok: true, notes }
        if (st.hasSignin) {
            notes.push(`#${i} 登录页 → 登录`)
            await cdp.evaluate(`
                const setValue = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
                setValue(document.querySelector('input[type=email]'), ${JSON.stringify(email)})
                setValue(document.querySelector('input[type=password]'), ${JSON.stringify(password)})
                await new Promise((r) => setTimeout(r, 300))
                document.querySelector('button[type=submit]')?.click()
                return 'submitted'
            `)
            await sleep(6000)
            continue
        }
        if (st.hasUnlock) {
            notes.push(`#${i} 解锁门 → 解锁`)
            await fillUnlock(password)
            await sleep(3000)
            continue
        }
        if (st.hasGate) {
            // 门失败态：优先「重新登录」回登录页
            const clicked = await cdp.evaluate(`
                const btn = [...document.querySelectorAll('#app button')].find((b) => /重新登录|登出用户/.test(b.innerText || ''))
                if (!btn) return false
                btn.click(); return true
            `)
            if (clicked) notes.push(`#${i} 门失败态 → 重新登录`)
        }
        await sleep(1200)
    }
    return { ok: false, notes }
}

// ============ 阶段 0：在线引导，建立本地密钥包 ============
console.log('[phase0] online bootstrap …')
// 确保起手在线（上一轮可能遗留 offline/封锁或空白路由）
await cdp.emulateNetwork({ offline: false })
await cdp.unblockUrls()
// 清掉上一轮可能写入的失效深链 + 重置 hash，保证能回到壳
await cdp.evaluate(`localStorage.removeItem('LAST_VISITED_ROUTE'); localStorage.removeItem('LAST_TASKS_ROUTE'); location.hash = '#/'; return 'reset'`)
await sleep(600)
await cdp.reload(0)
for (let i = 0; i < 40; i++) {
    if (await cdp.evaluate('return !!document.body')) break
    await sleep(100)
}
await sleep(1200)
const boot = await ensureOnlineShell()
evidence.phases.bootstrap = { ok: boot.ok, notes: boot.notes }
console.log('[phase0]', boot.ok ? 'shell OK' : 'shell FAILED', boot.notes.join(' | '))
if (!boot.ok) {
    evidence.phases.bootstrap.final = await snapshot('bootstrap-failed')
    writeEvidence()
    cdp.close()
    process.exit(1)
}
await sleep(2500)
evidence.phases.onlineShell = await snapshot('online-shell')
evidence.phases.onlineIdentity = await cdp.json(`(() => {
    const jwt = localStorage.getItem('USER_JWT') || ''
    let userId = null
    try { userId = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).userId } catch {}
    return { hasJwt: !!jwt, userId, lastVisited: localStorage.getItem('LAST_VISITED_ROUTE'), lastTasks: localStorage.getItem('LAST_TASKS_ROUTE') }
})()`)
console.log('[phase0] identity =', JSON.stringify(evidence.phases.onlineIdentity))

// ============ 阶段 1：断网冷启动（封锁后端 + reload） ============
console.log('[phase1] offline cold start …')
if (lastVisited !== undefined || lastTasks !== undefined) {
    await cdp.evaluate(`
        ${lastVisited !== undefined ? `localStorage.setItem('LAST_VISITED_ROUTE', ${JSON.stringify(lastVisited)})` : ''}
        ${lastTasks !== undefined ? `localStorage.setItem('LAST_TASKS_ROUTE', ${JSON.stringify(lastTasks)})` : ''}
        return { lv: localStorage.getItem('LAST_VISITED_ROUTE'), lt: localStorage.getItem('LAST_TASKS_ROUTE') }
    `)
}
evidence.meta.lastVisitedBeforeOffline = await cdp.evaluate(`({ lv: localStorage.getItem('LAST_VISITED_ROUTE'), lt: localStorage.getItem('LAST_TASKS_ROUTE') })`)
await cdp.blockUrls(API_BLOCK_URLS)
cdp.clearConsole()
cdp.clearRequests()
await cdp.reload(0)
for (let i = 0; i < 40; i++) {
    if (await cdp.evaluate('return !!document.body')) break
    await sleep(100)
}
// 等解锁门出现
let unlockSeen = false
for (let i = 0; i < 40; i++) {
    unlockSeen = await cdp.evaluate(`return !!document.querySelector('.nue-container--unlock-gate input[type=password]')`)
    if (unlockSeen) break
    await sleep(300)
}
evidence.phases.offlineAfterReload = await snapshot('offline-after-reload')
evidence.phases.offlineUnlockSeen = unlockSeen
console.log('[phase1] unlock form seen =', unlockSeen, 'hash =', evidence.phases.offlineAfterReload.dom.hash)

// ============ 阶段 2：解锁 → 等初始同步失败态 ============
console.log('[phase2] unlock …')
cdp.clearConsole()
await fillUnlock(password)
// 等失败态（错误文案 + 重试 + 离线进入）
let failure = null
const failStart = Date.now()
for (let i = 0; i < 120; i++) {
    failure = await snapshot('gate-poll')
    if (failure.dom.offlineEnterBtn) break
    // 若已被踢到 signin / checkin，则记录后停止
    if (/^#\/auth\/(signin|checkin)/.test(failure.dom.hash) && !failure.dom.unlockGate && !failure.dom.initialSyncGate) break
    await sleep(250)
}
evidence.phases.failureGate = failure
evidence.phases.failureWaitMs = Date.now() - failStart
evidence.phases.failureEvents = await events()
console.log('[phase2] gate hash =', failure?.dom.hash, 'offlineEnterBtn =', failure?.dom.offlineEnterBtn, `wait=${evidence.phases.failureWaitMs}ms`)

// ============ 阶段 3：点击「离线进入」前后证据 ============
console.log('[phase3] click 离线进入 …')
evidence.phases.beforeClick = await snapshot('before-click')
evidence.phases.beforeClickEvents = await events()
cdp.clearRequests()
if (args.emulateOfflineAtClick) {
    await cdp.emulateNetwork({ offline: true })
    evidence.phases.emulateOfflineAtClick = true
    console.log('[phase3] 已在点击前切换为 Chromium offline=true（模拟点击瞬间彻底断网）')
}

const rect = await cdp.evaluate(`
    const btn = [...document.querySelectorAll('#app button')].find((b) => /离线进入/.test(b.innerText || ''))
    if (!btn) return null
    const r = btn.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 }
`)
evidence.phases.clickRect = rect
let clickMode = 'none'
if (rect) {
    await cdp.click(rect.cx, rect.cy, 200)
    clickMode = 'real-mouse'
} else {
    const done = await cdp.evaluate(`
        const btn = [...document.querySelectorAll('#app button')].find((b) => /离线进入/.test(b.innerText || ''))
        if (!btn) return false
        btn.click(); return true
    `)
    clickMode = done ? 'synthetic' : 'no-button'
    await sleep(200)
}
evidence.phases.clickMode = clickMode
console.log('[phase3] click mode =', clickMode)

const windows = {}
// 三个时间窗：+300ms / +3s / +10s
await sleep(300)
windows.t300 = await snapshot('after-click+300ms')
await sleep(2700)
windows.t3000 = await snapshot('after-click+3s')
await sleep(7000)
windows.t10000 = await snapshot('after-click+10s')
await sleep(20000)
windows.t30000 = await snapshot('after-click+30s')
evidence.phases.afterClick = windows
evidence.phases.afterClickEvents = await events()
evidence.phases.requests = cdp.requests().filter((u) => /3302|5173|\.js|\.vue/.test(u)).slice(-60)
evidence.phases.console = cdp.warnings()
await cdp.screenshot(outDir, 'after-click-10s')
console.log('[phase3] t300 hash =', windows.t300.dom.hash, 'gate =', windows.t300.dom.initialSyncGate, 'rail =', windows.t300.dom.railBtn)
console.log('[phase3] t10s hash =', windows.t10000.dom.hash, 'gate =', windows.t10000.dom.initialSyncGate, 'rail =', windows.t10000.dom.railBtn)

// ============ 阶段 4：尝试恢复在线（清理现场） ============
await cdp.emulateNetwork({ offline: false })
await cdp.unblockUrls()

writeEvidence()
cdp.close()
console.log(`\n[out] ${join(outDir, 'shell-05-evidence.json')}`)

function writeEvidence() {
    fs.writeFileSync(join(outDir, 'shell-05-evidence.json'), JSON.stringify(evidence, null, 2))
}

function parseArgs(argv) {
    const result = { port: 9333, out: '/tmp/shell05', urlMatch: 'localhost:5173', email: process.env.NAO_QA_EMAIL, password: process.env.NAO_QA_PASSWORD }
    for (let i = 0; i < argv.length; i++) {
        const next = () => argv[++i]
        if (argv[i] === '--email') result.email = next()
        else if (argv[i] === '--password') result.password = next()
        else if (argv[i] === '--last-visited') result.lastVisited = next()
        else if (argv[i] === '--last-tasks') result.lastTasks = next()
        else if (argv[i] === '--emulate-offline-at-click') result.emulateOfflineAtClick = true
        else if (argv[i] === '--port') result.port = Number(next())
        else if (argv[i] === '--url-match') result.urlMatch = next()
        else if (argv[i] === '--out') result.out = next()
    }
    return result
}
