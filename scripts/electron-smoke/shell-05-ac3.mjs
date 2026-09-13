/**
 * SHELL-05 T7 · AC3 专项：注入导航 reject（真实 router.beforeEach 抛错）→ 门必达 + 结构化记录
 * 只测不改：仅通过 app 级 $router 注册一个临时守卫（用完即移除）。
 */
import fs from 'node:fs'
import { join } from 'node:path'
import { connectRenderer, sleep } from './lib/cdp.mjs'

const API_BLOCK_URLS = ['*localhost:3302*', '*127.0.0.1:3302*']
const args = parseArgs(process.argv.slice(2))
const outDir = args.out ?? '/tmp/shell05-ac3'
fs.mkdirSync(outDir, { recursive: true })

const cdp = await connectRenderer({ port: args.port, urlMatch: args.urlMatch })
await cdp.focusPage()

const snap = async (label) =>
    cdp.json(`(() => {
        const app = document.getElementById('app')
        const text = (document.body.innerText || '').replace(/\\s+/g, ' ')
        let routerState = null
        try { const r = app && app.__vue_app__ && app.__vue_app__.config.globalProperties.$router; const c = r && r.currentRoute.value; if (c) routerState = { name: c.name, fullPath: c.fullPath } } catch (e) { routerState = 'ERR:' + e.message }
        let log = null; try { log = window.__NAO_ERROR_LOG__ ? [...window.__NAO_ERROR_LOG__] : null } catch (e) { log = 'ERR' }
        return { label: ${JSON.stringify(label)}, hash: location.hash, router: routerState, gate: !!document.querySelector('.initial-sync-gate'), rail: !!document.querySelector('.sync-rail-btn'), bodyText: text.slice(0, 200), errorLog: log }
    })()`)

async function fillUnlock(pwd) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const gone = await cdp.evaluate(`
            const input = document.querySelector('.nue-container--unlock-gate input[type=password]')
            if (!input) return true
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(pwd)})
            input.dispatchEvent(new Event('input', { bubbles: true }))
            await new Promise((r) => setTimeout(r, 300))
            const btn = [...document.querySelectorAll('#app button')].find((b) => /解锁/.test(b.innerText || ''))
            btn?.click(); return false
        `)
        if (gone) return true
        await sleep(4000)
        if (!(await cdp.evaluate(`return !!document.querySelector('.nue-container--unlock-gate input[type=password]')`))) return true
    }
    return false
}

async function ensureOnline() {
    await cdp.emulateNetwork({ offline: false })
    await cdp.unblockUrls()
    await cdp.evaluate(`localStorage.removeItem('LAST_VISITED_ROUTE'); localStorage.removeItem('LAST_TASKS_ROUTE'); location.hash='#/'; return 'reset'`)
    await sleep(500)
    await cdp.reload(0)
    for (let i = 0; i < 40; i++) { if (await cdp.evaluate('return !!document.body')) break; await sleep(100) }
    for (let i = 0; i < 30; i++) {
        const st = await cdp.json(`({ rail: !!document.querySelector('.sync-rail-btn'), signin: !!document.querySelector('input[type=email]'), unlock: !!document.querySelector('.nue-container--unlock-gate input[type=password]'), gate: !!document.querySelector('.initial-sync-gate') })`)
        if (st.rail) return true
        if (st.signin) {
            await cdp.evaluate(`
                const setValue = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
                setValue(document.querySelector('input[type=email]'), ${JSON.stringify(args.email)})
                setValue(document.querySelector('input[type=password]'), ${JSON.stringify(args.password)})
                await new Promise((r) => setTimeout(r, 300))
                document.querySelector('button[type=submit]')?.click(); return 'submitted'
            `)
            await sleep(6000); continue
        }
        if (st.unlock) { await fillUnlock(args.password); await sleep(3000); continue }
        if (st.gate) { const c = await cdp.evaluate(`const b=[...document.querySelectorAll('#app button')].find((x)=>/重新登录|登出用户/.test(x.innerText||'')); if(!b) return false; b.click(); return true`); if (c) { await sleep(2500); continue } }
        await sleep(1000)
    }
    return false
}

async function gotoOfflineGate() {
    await cdp.blockUrls(API_BLOCK_URLS)
    await cdp.reload(0)
    for (let i = 0; i < 40; i++) { if (await cdp.evaluate('return !!document.body')) break; await sleep(100) }
    for (let i = 0; i < 40; i++) { if (await cdp.evaluate(`return !!document.querySelector('.nue-container--unlock-gate input[type=password]')`)) break; await sleep(250) }
    await fillUnlock(args.password)
    for (let i = 0; i < 120; i++) {
        const st = await cdp.json(`({ offline: [...document.querySelectorAll('#app button')].some((b)=> /离线进入/.test(b.innerText||'')), gate: !!document.querySelector('.initial-sync-gate'), hash: location.hash })`)
        if (st.offline) return st
        await sleep(250)
    }
    return { timeout: true }
}

const results = {}
const pass = (id, ok, detail) => { results[id] = { status: ok ? 'PASS' : 'FAIL', detail }; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id} — ${detail}`) }

console.log('=== AC3: 注入导航 reject ===')
const online = await ensureOnline()
pass('AC3.前置在线壳', online, `ensureOnline=${online}`)
if (online) {
    const gate = await gotoOfflineGate()
    results.gate = gate
    const guard = await cdp.evaluate(`
        const app = document.getElementById('app').__vue_app__
        const r = app.config.globalProperties.$router
        window.__qa05_rmGuard = r.beforeEach(() => { throw new Error('QA-INJECT-NAV-REJECT') })
        return typeof window.__qa05_rmGuard
    `)
    results.guardRegistered = guard
    const rect = await cdp.evaluate(`
        const btn = [...document.querySelectorAll('#app button')].find((b) => /离线进入/.test(b.innerText || ''))
        if (!btn) return null
        const r = btn.getBoundingClientRect(); return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 }
    `)
    if (rect) await cdp.click(rect.cx, rect.cy, 250)
    await sleep(300)
    const t300 = await snap('AC3+300ms')
    await sleep(3200)
    const t35 = await snap('AC3+3.5s')
    results.t300 = t300
    results.t3500 = t35
    const sources = (t35.errorLog || []).map((e) => e.source)
    pass('AC3.门不永久停留（gatePassed 必达）', t35.gate === false, `gate@3.5s=${t35.gate} hash=${t35.hash} rail=${t35.rail}`)
    pass('AC3.有界终结（有限时间内离开门）', t300.gate === false || t35.gate === false, `gate@300ms=${t300.gate} @3.5s=${t35.gate}`)
    pass('AC3.结构化记录导航失败', sources.includes('app-root:offline-navigation') || sources.includes('router:onError'), `sources=${JSON.stringify(sources)}`)
    pass('AC3.记录含注入标记', (t35.errorLog || []).some((e) => String(e.message || '').includes('QA-INJECT')), `matched=${(t35.errorLog || []).some((e) => String(e.message || '').includes('QA-INJECT'))}`)
    // 清理注入守卫
    await cdp.evaluate(`if (window.__qa05_rmGuard) { window.__qa05_rmGuard(); window.__qa05_rmGuard = null } return 'removed'`)
}
await cdp.emulateNetwork({ offline: false })
await cdp.unblockUrls()
const fail = Object.values(results).filter((x) => x && x.status === 'FAIL').length
fs.writeFileSync(join(outDir, 'shell-05-ac3.json'), JSON.stringify({ results }, null, 2))
console.log(`\nAC3 FAIL=${fail}`)
cdp.close()

function parseArgs(argv) {
    const r = { port: 9333, out: '/tmp/shell05-ac3', urlMatch: 'index.html', email: process.env.NAO_QA_EMAIL, password: process.env.NAO_QA_PASSWORD }
    for (let i = 0; i < argv.length; i++) {
        const next = () => argv[++i]
        if (argv[i] === '--email') r.email = next()
        else if (argv[i] === '--password') r.password = next()
        else if (argv[i] === '--port') r.port = Number(next())
        else if (argv[i] === '--out') r.out = next()
        else if (argv[i] === '--url-match') r.urlMatch = next()
    }
    return r
}
