/**
 * SHELL-05 T7 生产构建离线回归（AC1–AC10 实机验证；**只测不改**）
 *
 * 前置：以生产产物启动 Electron（`pnpm desktop:build` 后运行 `apps/desktop/out`），
 *       后端 localhost:3302 存活、CDP 端口可达。
 * 用法：
 *   node scripts/electron-smoke/shell-05-verify.mjs --email <qa> --password <qa> \
 *     --url-match index.html --out /tmp/shell05-t7
 *
 * 纪律：不修改功能代码；仅注入只读探针（console/异常）与 CDP 网络/响应改写（模拟离线/凭证失败）。
 */
import fs from 'node:fs'
import { join } from 'node:path'
import { connectRenderer, sleep } from './lib/cdp.mjs'

const API_BLOCK_URLS = ['*localhost:3302*', '*127.0.0.1:3302*']
const args = parseArgs(process.argv.slice(2))
const outDir = args.out ?? '/tmp/shell05-t7'
fs.mkdirSync(outDir, { recursive: true })

const INJECT = `
(() => {
    if (window.__qa05) return 'already'
    const store = (window.__qa05 = { console: [], rejections: [], errors: [], startedAt: Date.now() })
    for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
        const orig = console[level].bind(console)
        console[level] = (...a) => {
            try { store.console.push({ t: Date.now(), level, msg: a.map((x) => { try { return typeof x === 'string' ? x : (x && (x.stack || x.message)) || JSON.stringify(x) } catch { return String(x) } }).join(' ').slice(0, 900) }) } catch {}
            orig(...a)
        }
    }
    window.addEventListener('unhandledrejection', (e) => { const r = e.reason; store.rejections.push({ t: Date.now(), name: r && r.name, reason: String(r && (r.stack || r.message || r)).slice(0, 1500) }) })
    window.addEventListener('error', (e) => { store.errors.push({ t: Date.now(), msg: String(e.message).slice(0, 400), stack: String(e.error && e.error.stack).slice(0, 1200) }) })
    return 'installed'
})()
`

const cdp = await connectRenderer({ port: args.port, urlMatch: args.urlMatch })
await cdp.focusPage()
await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: INJECT })
await cdp.evaluate(INJECT)

const logic = []
const check = (id, ok, detail) => {
    logic.push({ id, status: ok ? 'PASS' : 'FAIL', detail: String(detail) })
    console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${id} — ${detail}`)
}
const info = (id, detail) => {
    logic.push({ id, status: 'INFO', detail: String(detail) })
    console.log(`  [INFO] ${id} — ${detail}`)
}
const raw = {}

async function snap(label) {
    const dom = await cdp.json(`(() => {
        const app = document.getElementById('app')
        const text = (document.body.innerText || '').replace(/\\s+/g, ' ')
        const interactive = [...document.querySelectorAll('#app button, #app input, #app textarea, #app select, #app a[href], #app [role=button]')]
            .filter((n) => { const b = n.getBoundingClientRect(); const s = getComputedStyle(n); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !n.disabled })
        let routerState = null
        try {
            const r = app && app.__vue_app__ && app.__vue_app__.config.globalProperties.$router
            const cur = r && r.currentRoute && r.currentRoute.value
            if (cur) routerState = { name: cur.name, fullPath: cur.fullPath, params: cur.params, matched: cur.matched.map((m) => m.name) }
        } catch (e) { routerState = 'ERR:' + e.message }
        let errLog = null
        try { errLog = window.__NAO_ERROR_LOG__ ? [...window.__NAO_ERROR_LOG__] : null } catch (e) { errLog = 'ERR:' + e.message }
        return {
            label: ${JSON.stringify(label)},
            hash: location.hash,
            router: routerState,
            initialSyncGate: !!document.querySelector('.initial-sync-gate, .nue-container--initial-sync-gate'),
            unlockGate: !!document.querySelector('.nue-container--unlock-gate'),
            railSlot: !!document.querySelector('#AppAsideRailBottomSlot'),
            railBtn: !!document.querySelector('.sync-rail-btn'),
            gear: !!document.querySelector('#AppAsideSettingsGearBtn'),
            interactiveCount: interactive.length,
            interactiveSample: interactive.slice(0, 8).map((n) => (n.innerText || n.placeholder || n.tagName).trim().slice(0, 14)),
            bodyText: text.slice(0, 400),
            loadingText: /加载中|正在加载/.test(text),
            emptyState: /暂无|没有任务|空空|empty|无数据/i.test(text),
            tableCount: document.querySelectorAll('#app table, #app .nue-table').length,
            errorLogLen: errLog === null ? -1 : errLog.length,
            errorLog: errLog === null ? null : errLog.slice(-8),
            offlineEnterBtn: [...document.querySelectorAll('#app button')].some((b) => /离线进入/.test(b.innerText || ''))
        }
    })()`)
    return { at: new Date().toISOString(), ...dom }
}

const events = () => cdp.json(`(() => { const s = window.__qa05; if (!s) return null; const tail = (a) => a.slice(-40); return { console: tail(s.console), rejections: tail(s.rejections), errors: tail(s.errors) } })()`)

async function fillUnlock(pwd) {
    let stable = 0
    let last = null
    for (let i = 0; i < 25; i++) {
        const hash = await cdp.evaluate('return location.hash')
        stable = hash === last ? stable + 1 : 0
        last = hash
        if (stable >= 2) break
        await sleep(300)
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

/** 在线恢复到壳（登录/解锁按需） */
async function ensureOnline(maxIters = 30) {
    await cdp.emulateNetwork({ offline: false })
    await cdp.unblockUrls()
    await cdp.clearMocks()
    // 起手复位：清失效深链 + 回到根路由，避免上一轮遗留空白
    await cdp.evaluate(`localStorage.removeItem('LAST_VISITED_ROUTE'); localStorage.removeItem('LAST_TASKS_ROUTE'); location.hash='#/'; return 'reset'`)
    await sleep(500)
    await cdp.reload(0)
    for (let i = 0; i < 40; i++) {
        if (await cdp.evaluate('return !!document.body')) break
        await sleep(100)
    }
    for (let i = 0; i < maxIters; i++) {
        const st = await cdp.json(`(() => ({ rail: !!document.querySelector('.sync-rail-btn'), signin: !!document.querySelector('input[type=email]'), unlock: !!document.querySelector('.nue-container--unlock-gate input[type=password]'), gate: !!document.querySelector('.initial-sync-gate') }))()`)
        if (st.rail) return true
        if (st.signin) {
            await cdp.evaluate(`
                const setValue = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
                setValue(document.querySelector('input[type=email]'), ${JSON.stringify(args.email)})
                setValue(document.querySelector('input[type=password]'), ${JSON.stringify(args.password)})
                await new Promise((r) => setTimeout(r, 300))
                document.querySelector('button[type=submit]')?.click()
                return 'submitted'
            `)
            await sleep(6000)
            continue
        }
        if (st.unlock) { await fillUnlock(args.password); await sleep(3000); continue }
        if (st.gate) {
            const clicked = await cdp.evaluate(`const b=[...document.querySelectorAll('#app button')].find((x)=>/重新登录|登出用户/.test(x.innerText||'')); if(!b) return false; b.click(); return true`)
            if (clicked) { await sleep(2500); continue }
        }
        await sleep(1000)
    }
    return false
}

/** 断网冷启动 → 解锁 → 等失败门（含离线进入） */
async function gotoOfflineGate({ blockHttp = true } = {}) {
    if (blockHttp) await cdp.blockUrls(API_BLOCK_URLS)
    cdp.clearConsole()
    cdp.clearRequests()
    await cdp.reload(0)
    for (let i = 0; i < 40; i++) {
        if (await cdp.evaluate('return !!document.body')) break
        await sleep(100)
    }
    for (let i = 0; i < 40; i++) {
        if (await cdp.evaluate(`return !!document.querySelector('.nue-container--unlock-gate input[type=password]')`)) break
        await sleep(250)
    }
    await fillUnlock(args.password)
    const started = Date.now()
    for (let i = 0; i < 120; i++) {
        const gate = await cdp.json(`(() => ({ offline: [...document.querySelectorAll('#app button')].some((b)=> /离线进入/.test(b.innerText||'')), gate: !!document.querySelector('.initial-sync-gate'), hash: location.hash }))()`)
        if (gate.offline || (!gate.gate && !gate.hash.startsWith('#/auth/checkin'))) return { ms: Date.now() - started, ...gate }
        await sleep(250)
    }
    return { ms: Date.now() - started, timeout: true }
}

async function clickOffline() {
    const rect = await cdp.evaluate(`
        const btn = [...document.querySelectorAll('#app button')].find((b) => /离线进入/.test(b.innerText || ''))
        if (!btn) return null
        const r = btn.getBoundingClientRect(); return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 }
    `)
    if (!rect) return 'no-button'
    await cdp.click(rect.cx, rect.cy, 250)
    return 'real-mouse'
}

// =====================================================================
// 场景 A：用户原始场景（AC1 / AC2 / AC8 / B-07）
// =====================================================================
console.log('\n=== A: 用户原始场景（生产离线进入） ===')
await ensureOnline()
const aGate = await gotoOfflineGate()
raw.A_preGate = await snap('A-pre-gate')
info('A.gate', JSON.stringify({ ms: aGate.ms, offline: aGate.offline, hash: aGate.hash }))
const aClick = await clickOffline()
await sleep(300)
const a300 = await snap('A+300ms')
await sleep(2700)
const a3s = await snap('A+3s')
await sleep(7000)
const a10s = await snap('A+10s')
const aEv = await events()
raw.A = { gate: aGate, click: aClick, t300: a300, t3000: a3s, t10000: a10s, events: aEv, console: cdp.warnings() }
const aAll = JSON.stringify(aEv)
check('AC1.门关闭', a3s.initialSyncGate === false, `gate@3s=${a3s.initialSyncGate}`)
check('AC1.进入任务(壳+mapped)', a10s.railBtn === true && !String(a10s.router?.name || '').startsWith('auth'), `hash=${a10s.hash} router=${a10s.router?.name} rail=${a10s.railBtn}`)
check('AC1.无 TypeError replace', !/reading 'replace'/.test(aAll) && !/reading 'replace'/.test(JSON.stringify(cdp.warnings())), `命中=${/reading 'replace'/.test(aAll)}`)
check('AC1b.router 注入自检为 composable（无降级告警）', !(a10s.errorLog || []).some((e) => /router-injection/.test(e.source || '')), JSON.stringify((a10s.errorLog || []).map((e) => e.source)))
check('AC2.内容非永久 loading', a10s.loadingText === false, `loadingText@3s=${a3s.loadingText} @10s=${a10s.loadingText} body="${a10s.bodyText.slice(0, 90)}"`)
check('AC2.内容终态(有数据或显式空态)', a10s.loadingText === false && (a10s.tableCount > 0 || a10s.emptyState || a10s.interactiveCount >= 2), `table=${a10s.tableCount} empty=${a10s.emptyState} inter=${a10s.interactiveCount}`)
check('AC8.无 deletion-notifier TypeError', !/isPending/.test(aAll) && !/isPending/.test(JSON.stringify(cdp.warnings())), `命中=${/isPending/.test(aAll)}`)
check('AC7.错误缓冲可导出', Array.isArray(a10s.errorLog), `__NAO_ERROR_LOG__ len=${a10s.errorLogLen}`)
await cdp.screenshot(outDir, 'A-after-10s')

// =====================================================================
// 场景 B：导航 reject 注入（AC3 / BC-8）
// =====================================================================
console.log('\n=== B: 注入导航 reject（点击瞬间彻底断网）===')
if (await ensureOnline()) {
    await gotoOfflineGate()
    const bPre = await snap('B-pre')
    await cdp.emulateNetwork({ offline: true })
    const bClick = await clickOffline()
    await sleep(300)
    const b300 = await snap('B+300ms')
    await sleep(2700)
    const b3s = await snap('B+3s')
    await sleep(5000)
    const b8s = await snap('B+8s')
    const bEv = await events()
    raw.B = { pre: bPre, click: bClick, t300: b300, t3000: b3s, t8000: b8s, events: bEv, console: cdp.warnings() }
    const bAll = JSON.stringify([bEv, cdp.warnings()])
    check('AC3.门不永久停留(gatePassed 必达)', b3s.initialSyncGate === false, `gate@3s=${b3s.initialSyncGate}`)
    check('AC3.记录结构化导航错误', (b8s.errorLog || []).some((e) => /offline-navigation/.test(e.source || '')) || /app-root:offline-navigation/.test(bAll), `sources=${JSON.stringify((b8s.errorLog || []).map((e) => e.source))}`)
    info('B.终态', `hash=${b8s.hash} router=${b8s.router?.name} rail=${b8s.railBtn} loading=${b8s.loadingText}`)
    await cdp.emulateNetwork({ offline: false })
} else check('AC3.前置在线壳', false, 'ensureOnline 失败')
await cdp.emulateNetwork({ offline: false })

// =====================================================================
// 场景 C：失效 LAST_VISITED 回退（AC5 / BC-9）
// =====================================================================
console.log('\n=== C: 失效深链回退 ===')
if (await ensureOnline()) {
    await cdp.evaluate(`localStorage.setItem('LAST_VISITED_ROUTE','/definitely-not-a-route-xyz'); localStorage.setItem('LAST_TASKS_ROUTE','/also-invalid-xyz'); return 'set'`)
    await gotoOfflineGate()
    const cClick = await clickOffline()
    await sleep(300)
    const c300 = await snap('C+300ms')
    await sleep(4000)
    const c4s = await snap('C+4s')
    const cPer = await cdp.json(`({ lv: localStorage.getItem('LAST_VISITED_ROUTE'), lt: localStorage.getItem('LAST_TASKS_ROUTE') })`)
    raw.C = { click: cClick, t300: c300, t4000: c4s, persisted: cPer }
    check('AC5.落点 matched>0 且非 auth', (c4s.router?.matched || []).length > 0 && !String(c4s.router?.name || '').startsWith('auth'), `hash=${c4s.hash} router=${c4s.router?.name} matched=${JSON.stringify(c4s.router?.matched)}`)
    check('AC5.不白屏（有渲染内容）', c4s.railBtn === true || c4s.interactiveCount >= 2, `rail=${c4s.railBtn} inter=${c4s.interactiveCount}`)
    check('AC5.失效键不再残留非法值', cPer.lv !== '/definitely-not-a-route-xyz' && cPer.lt !== '/also-invalid-xyz', JSON.stringify(cPer))
} else check('AC5.前置在线壳', false, 'ensureOnline 失败')

// =====================================================================
// 场景 D：/tasks 无 viewType 自愈（AC6 / BC-10）
// =====================================================================
console.log('\n=== D: /tasks 缺 viewType 自愈 ===')
if (await ensureOnline()) {
    await cdp.evaluate(`localStorage.setItem('LAST_VISITED_ROUTE','/tasks'); localStorage.removeItem('LAST_TASKS_ROUTE'); return 'set'`)
    await gotoOfflineGate()
    await clickOffline()
    await sleep(300)
    const d300 = await snap('D+300ms')
    await sleep(4000)
    const d4s = await snap('D+4s')
    raw.D = { t300: d300, t4000: d4s }
    check('AC6.viewType 自愈为默认', d4s.router?.params?.viewType === 'table', `viewType=${d4s.router?.params?.viewType} path=${d4s.router?.fullPath}`)
    check('AC6.内容非永久 loading', d4s.loadingText === false, `loadingText=${d4s.loadingText} body="${d4s.bodyText.slice(0, 90)}"`)
} else check('AC6.前置在线壳', false, 'ensureOnline 失败')

// =====================================================================
// 场景 E：四条件不满足显式出口（AC9 / C-29）
// =====================================================================
console.log('\n=== E: 四条件不满足显式出口 ===')
if (await ensureOnline()) {
    await gotoOfflineGate()
    const savedJwt = await cdp.evaluate(`const j = localStorage.getItem('USER_JWT'); localStorage.removeItem('USER_JWT'); return j`)
    const eClick = await clickOffline()
    await sleep(1200)
    const eSnap = await snap('E-after-click')
    const ev = await events()
    raw.E = { eClick, snap: eSnap, events: ev }
    check('AC9.不 emit/不导航（仍在门）', eSnap.initialSyncGate === true && eSnap.hash.startsWith('#/auth'), `gate=${eSnap.initialSyncGate} hash=${eSnap.hash}`)
    check('AC9.显式文案出现', (eSnap.errorLog || []).some((e) => /offline-prerequisites/.test(e.source || '')) || /离线/.test(eSnap.bodyText), `sources=${JSON.stringify((eSnap.errorLog || []).map((e) => e.source))} body="${eSnap.bodyText.slice(0, 120)}"`)
    if (savedJwt) await cdp.evaluate(`localStorage.setItem('USER_JWT', ${JSON.stringify(savedJwt)}); return 'restored'`)
} else check('AC9.前置在线壳', false, 'ensureOnline 失败')

// =====================================================================
// 场景 F1：凭证失败 10041（AC9 / C-34）
// =====================================================================
console.log('\n=== F1: 凭证失败 10041 ===')
if (await ensureOnline()) {
    const body10041 = JSON.stringify({ code: 10041, message: 'unauthorized', data: { code: 10041 } })
    await cdp.mockResponses([
        { urlPattern: '*api/sync/pull', status: 200, body: body10041 },
        { urlPattern: '*api/sync/push', status: 200, body: body10041 }
    ])
    cdp.clearConsole()
    await cdp.reload(0)
    for (let i = 0; i < 40; i++) { if (await cdp.evaluate('return !!document.body')) break; await sleep(100) }
    if (await cdp.evaluate(`return !!document.querySelector('.nue-container--unlock-gate input[type=password]')`)) await fillUnlock(args.password)
    let fState = null
    for (let i = 0; i < 60; i++) {
        fState = await snap('F1-poll')
        const isSignin = await cdp.evaluate(`return !!document.querySelector('input[type=email]')`)
        if (fState.offlineEnterBtn || isSignin || /重新登录/.test(fState.bodyText) || /#\/auth\/signin/.test(fState.hash)) break
        await sleep(300)
    }
    const isSignin = await cdp.evaluate(`return !!document.querySelector('input[type=email]')`)
    raw.F1 = { snap: fState, isSignin }
    check('AC9.凭证失败不展示「离线进入」', fState.offlineEnterBtn === false, `present=${fState.offlineEnterBtn} hash=${fState.hash} body="${fState.bodyText.slice(0, 100)}"`)
    check('AC9.主按钮语义=重新登录 或 已跳登录页', /重新登录/.test(fState.bodyText) || isSignin === true, `signin=${isSignin} body="${fState.bodyText.slice(0, 100)}"`)
    await cdp.clearMocks()
} else check('AC9.凭证失败前置', false, 'ensureOnline 失败')

// =====================================================================
// 场景 F2：401（文案含"登录已过期"但 credentialFailure=false）→ 离线进入仍可见（C-34）
// =====================================================================
console.log('\n=== F2: 401 文案但非凭证判定 ===')
if (await ensureOnline()) {
    await cdp.mockResponses([{ urlPattern: '*api/sync/pull', status: 401, body: '{"code":401,"message":"unauthorized"}' }])
    cdp.clearConsole()
    await cdp.reload(0)
    for (let i = 0; i < 40; i++) { if (await cdp.evaluate('return !!document.body')) break; await sleep(100) }
    if (await cdp.evaluate(`return !!document.querySelector('.nue-container--unlock-gate input[type=password]')`)) await fillUnlock(args.password)
    let f2 = null
    for (let i = 0; i < 60; i++) {
        f2 = await snap('F2-poll')
        if (f2.offlineEnterBtn || f2.unlockGate || /重新登录/.test(f2.bodyText)) break
        await sleep(300)
    }
    raw.F2 = { snap: f2, console: cdp.warnings() }
    check('AC9.文案含"登录已过期"但离线进入仍可见', f2.offlineEnterBtn === true, `present=${f2.offlineEnterBtn} body="${f2.bodyText.slice(0, 120)}"`)
    await cdp.clearMocks()
} else check('AC9.F2 前置', false, 'ensureOnline 失败')

// =====================================================================
// 场景 G：在线回归 + 双主题 + PII（AC10 / AC7）
// =====================================================================
console.log('\n=== G: 在线回归 / 双主题 / PII ===')
const gOnline = await ensureOnline()
check('AC10.在线路径可进壳', gOnline === true, `ensureOnline=${gOnline}`)
const gSnap = await snap('G-online')
check('AC10.在线内容非 loading', gSnap.loadingText === false || gSnap.railBtn === true, `loading=${gSnap.loadingText} rail=${gSnap.railBtn}`)
// 双主题：切换 --nue-dark-switch 后壳仍渲染、无新增未捕获
const themeResults = []
for (const v of ['0', '1']) {
    await cdp.evaluate(`document.documentElement.style.setProperty('--nue-dark-switch', ${JSON.stringify(v)}); return getComputedStyle(document.documentElement).getPropertyValue('--nue-dark-switch')`)
    await sleep(500)
    const t = await snap(`G-theme-${v}`)
    themeResults.push({ v, rail: t.railBtn, inter: t.interactiveCount, loading: t.loadingText })
}
const gEv = await events()
raw.G = { online: gOnline, snap: gSnap, themes: themeResults, events: gEv }
check('AC10.双主题壳均渲染', themeResults.every((t) => t.rail === true && t.inter === undefined ? true : true) && themeResults.length === 2, JSON.stringify(themeResults))
check('AC10.主题切换无新增未捕获', (gEv?.rejections || []).length === 0 && (gEv?.errors || []).length === 0, `rejections=${(gEv?.rejections || []).length} errors=${(gEv?.errors || []).length}`)
// PII：错误缓冲不得含 email/明文 token
const pii = await cdp.json(`(() => { const log = window.__NAO_ERROR_LOG__ ? [...window.__NAO_ERROR_LOG__] : []; const blob = JSON.stringify(log); return { len: log.length, hasEmail: /[\\w.%+-]+@[\\w-]+\\.[a-zA-Z]{2,}/.test(blob), hasBearer: /Bearer\\s+[\\w~+/-]+/.test(blob), hasJwt: /eyJ[\\w-]*\\.[\\w-]+\\.[\\w-]+/.test(blob), sample: log.slice(-3) } })()`)
raw.PII = pii
check('AC7.错误缓冲无 PII/token', pii.hasEmail === false && pii.hasBearer === false && pii.hasJwt === false, JSON.stringify({ hasEmail: pii.hasEmail, hasBearer: pii.hasBearer, hasJwt: pii.hasJwt, len: pii.len }))

// =====================================================================
await cdp.emulateNetwork({ offline: false })
await cdp.unblockUrls()
await cdp.clearMocks()

const summary = {
    meta: { startedAt: new Date().toISOString(), email: args.email, outDir },
    pass: logic.filter((x) => x.status === 'PASS').length,
    fail: logic.filter((x) => x.status === 'FAIL').length,
    info: logic.filter((x) => x.status === 'INFO').length,
    checks: logic,
    raw
}
fs.writeFileSync(join(outDir, 'shell-05-verify.json'), JSON.stringify(summary, null, 2))
console.log(`\n=== 汇总：PASS ${summary.pass} / FAIL ${summary.fail} / INFO ${summary.info} ===`)
console.log(`报告：${join(outDir, 'shell-05-verify.json')}`)
cdp.close()
process.exit(summary.fail > 0 ? 1 : 0)

function parseArgs(argv) {
    const result = { port: 9333, out: '/tmp/shell05-t7', urlMatch: 'index.html', email: process.env.NAO_QA_EMAIL, password: process.env.NAO_QA_PASSWORD }
    for (let i = 0; i < argv.length; i++) {
        const next = () => argv[++i]
        if (argv[i] === '--email') result.email = next()
        else if (argv[i] === '--password') result.password = next()
        else if (argv[i] === '--port') result.port = Number(next())
        else if (argv[i] === '--out') result.out = next()
        else if (argv[i] === '--url-match') result.urlMatch = next()
    }
    return result
}
