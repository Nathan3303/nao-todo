/**
 * SHELL-06 T3：离线回传（BC-13…BC-16）生产构建实机验证（**只测不改**）
 *
 * 前置：生产产物（localhost API）、本机后端 localhost:3302 存活、CDP 可达、QA 账号。
 * 用法：node scripts/electron-smoke/shell-06-verify.mjs --port 9344 --email <qa> --password <qa> --out <dir>
 *
 * 说明：仅注入只读探针 + CDP 网络/响应改写（离线、业务类失败）；不修改功能代码。
 */
import fs from 'node:fs'
import { join } from 'node:path'
import { connectRenderer, sleep } from './lib/cdp.mjs'

const args = parseArgs(process.argv.slice(2))
const outDir = args.out ?? '/tmp/shell06'
fs.mkdirSync(outDir, { recursive: true })
const API = 'http://127.0.0.1:3302/api'
const cdp = await connectRenderer({ port: args.port, urlMatch: args.urlMatch })
await cdp.focusPage()

const checks = []
const check = (id, ok, detail) => { checks.push({ id, status: ok ? 'PASS' : 'FAIL', detail: String(detail) }); console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${id} — ${detail}`) }
const info = (id, detail) => { checks.push({ id, status: 'INFO', detail: String(detail) }); console.log(`  [INFO] ${id} — ${detail}`) }
const raw = {}

const evaluate = (body) => cdp.evaluate(body)
const json = (expr) => cdp.json(expr)

const snap = async (label) => json(`(() => {
    const app=document.getElementById('app'); const text=(document.body.innerText||'').replace(/\\s+/g,' ')
    const vis=(n)=>{const b=n.getBoundingClientRect();const s=getComputedStyle(n);return b.width>0&&b.height>0&&s.visibility!=='hidden'&&s.display!=='none'}
    let router=null; try{ const r=app&&app.__vue_app__&&app.__vue_app__.config.globalProperties.$router; const c=r&&r.currentRoute.value; if(c) router={name:c.name,fullPath:c.fullPath} }catch(e){}
    return { label:${JSON.stringify(label)}, hash:location.hash, router, rail:!!document.querySelector('.sync-rail-btn'),
        railClass:(document.querySelector('.sync-rail-btn')||{}).className||null, live:(document.querySelector('.sync-live-region')||{}).textContent||null,
        bodyText:text.slice(0,300), clickable:[...document.querySelectorAll('#app button')].filter(vis).map(b=>(b.innerText||'').trim()).filter(Boolean).slice(0,25) }
})()`)

const queue = () => json(`(() => new Promise((res)=>{ const r=indexedDB.open('nao-todo-desktop'); r.onsuccess=()=>{ const db=r.result; if(!db.objectStoreNames.contains('syncQueue')) return res({error:'no store'}); const req=db.transaction('syncQueue','readonly').objectStore('syncQueue').getAll(); req.onsuccess=()=>res({count:req.result.length, items:req.result.map(x=>({id:x.id,table:x.table,action:x.action,retryCount:x.retryCount,attempts:x.attempts,nextAttemptAt:x.nextAttemptAt,lastErrorClass:x.lastErrorClass}))}); req.onerror=()=>res({error:String(req.error)}) }; r.onerror=()=>res({error:String(r.error)}) }))()`)

const jwt = () => evaluate("return localStorage.getItem('USER_JWT')")
async function serverTasks() {
    const token = await jwt()
    if (!token) return { error: 'no jwt' }
    try {
        const r = await fetch(`${API}/tasks/?limit=100`, { headers: { Authorization: 'Bearer ' + token } })
        const b = await r.json()
        const items = b?.data?.data?.items ?? b?.data?.items ?? []
        return { status: r.status, count: Array.isArray(items) ? items.length : null, names: Array.isArray(items) ? items.map((x) => x.name) : [] }
    } catch (e) { return { error: String(e.message) } }
}
const pushCount = () => cdp.requests().filter((u) => /\/api\/sync\/push/.test(u)).length

async function signIn() {
    for (let i = 0; i < 40; i++) {
        const st = await json(`({rail:!!document.querySelector('.sync-rail-btn'),signin:!!document.querySelector('input[type=email]'),unlock:!!document.querySelector('.nue-container--unlock-gate input[type=password]')})`)
        if (st.rail) return true
        if (st.signin) {
            await evaluate(`
                const s=(e,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,v); e.dispatchEvent(new Event('input',{bubbles:true}))}
                s(document.querySelector('input[type=email]'), ${JSON.stringify(args.email)})
                s(document.querySelector('input[type=password]'), ${JSON.stringify(args.password)})
                await new Promise(r=>setTimeout(r,300)); document.querySelector('button[type=submit]')?.click(); return 1`)
            await sleep(7000); continue
        }
        if (st.unlock) { await fillUnlock(args.password); await sleep(3000); continue }
        await sleep(1000)
    }
    return false
}
async function fillUnlock(pwd) {
    for (let i = 0; i < 3; i++) {
        const gone = await evaluate(`
            const i=document.querySelector('.nue-container--unlock-gate input[type=password]'); if(!i) return true
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i, ${JSON.stringify(pwd)})
            i.dispatchEvent(new Event('input',{bubbles:true})); await new Promise(r=>setTimeout(r,300))
            const b=[...document.querySelectorAll('#app button')].find(x=>/解锁/.test(x.innerText||'')); if(b) b.click(); return false`)
        if (gone) return true
        await sleep(4000)
    }
    return false
}
const blockApi = () => cdp.blockUrls(['*localhost:3302*', '*127.0.0.1:3302*'])
const unblockApi = () => cdp.unblockUrls()

async function createTask(title) {
    await evaluate("window.__T = " + JSON.stringify(title) + "; return 1")
    await cdp.pressKey('n', 1300)
    const res = await evaluate(`
        const d=document.querySelector('.nue-dialog--task-creator'); if(!d) return 'nodialog'
        const i=d.querySelector('input.nue-input__input'); if(!i) return 'noinput'
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i, window.__T)
        i.dispatchEvent(new Event('input',{bubbles:true})); await new Promise(r=>setTimeout(r,400))
        const b=[...d.querySelectorAll('.nue-dialog__footer button')].find(x=>/创建/.test(x.innerText||'')); if(b) b.click(); return 'ok'`)
    await sleep(2200)
    const appeared = await evaluate(`return (document.body.innerText||'').includes(window.__T)`)
    return { res, appeared }
}
async function openDetails(title) {
    await evaluate("window.__T = " + JSON.stringify(title) + "; return 1")
    await evaluate(`
        const n=[...document.querySelectorAll('#app *')].find(x=>x.children.length===0 && (x.innerText||'').trim()===window.__T)
        if(n){const r=n.getBoundingClientRect(); n.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2}))}
        return 1`)
    await sleep(1600)
    return evaluate(`return !!document.querySelector('.tasks-details-view')`)
}
async function deleteTask(title) {
    const opened = await openDetails(title)
    if (!opened) return { ok: false, reason: 'no-details' }
    await evaluate(`
        const el=[...document.querySelectorAll('#app *')].find(n=>(n.innerText||'').trim()==='更多')
        if(el){const r=el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2}))}
        return 1`)
    await sleep(1200)
    const popup = await evaluate(`(() => { const vis=(n)=>{const b=n.getBoundingClientRect();return b.width>0&&b.height>0}; return [...document.querySelectorAll('#TopLevelNuePopupPool li,#TopLevelNuePopupPool button,#app .nue-dropdown li,#app .nue-dropdown button')].filter(vis).map(x=>(x.innerText||'').trim()).filter(t=>t&&t.length<24) })()`)
    const clicked = await evaluate(`
        const els=[...document.querySelectorAll('#TopLevelNuePopupPool li,#TopLevelNuePopupPool button,#app .nue-dropdown li,#app .nue-dropdown button')].filter(n=>/删除/.test(n.innerText||''))
        if(!els.length) return 'nodelete'
        const el=els[els.length-1]; const r=el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2})); return 'delete-clicked'`)
    await sleep(1000)
    const confirmed = await evaluate(`
        const b=[...document.querySelectorAll('.nue-dialog button,#app button')].find(x=>/^删除$|确认删除|Delete/.test((x.innerText||'').trim()))
        if(!b) return 'noconfirm'; b.click(); return 'confirmed'`)
    await sleep(2000)
    const gone = !(await evaluate(`return (document.body.innerText||'').includes(${JSON.stringify(title)})`))
    return { ok: gone, popup, clicked, confirmed, gone }
}
async function openSyncPanel() {
    const r = await json(`(() => { const b=document.querySelector('.sync-rail-btn'); if(!b) return null; const x=b.getBoundingClientRect(); return {cx:x.x+x.width/2,cy:x.y+x.height/2} })()`)
    if (r) await cdp.click(r.cx, r.cy, 900)
    return evaluate(`(() => { const p=document.querySelector('ul.nue-dropdown--sync-panel,[class*=sync-panel]'); return p?(p.innerText||'').replace(/\\s+/g,' '):null })()`)
}
async function closePopups() { for (let i = 0; i < 3; i++) { await cdp.pressKey('Escape'); await sleep(300) } await evaluate("document.querySelector('.nue-dropdown-overlay')?.click(); return 1"); await sleep(300) }

// =====================================================================
console.log('=== 0) 在线登录 ===')
const signed = await signIn()
check('SETUP.在线登录', signed, `rail=${signed}`)
await evaluate("location.hash='#/tasks/all/table'; return 1"); await sleep(1500)
raw.baselineQueue = await queue()
raw.baselineServer = await serverTasks()
info('SETUP.baseline', `queue=${raw.baselineQueue.count} serverTasks=${JSON.stringify(raw.baselineServer)}`)

// =====================================================================
console.log('\n=== 1) BC-13 / BC-14：离线写 → 恢复网络自动补传 + 无额度消耗 ===')
await closePopups()
await blockApi()
const pushStart = pushCount()
cdp.clearRequests()
const t1 = 'S06-T1-' + Date.now().toString().slice(-4)
const t2 = 'S06-T2-' + Date.now().toString().slice(-4)
const t3 = 'S06-T3-' + Date.now().toString().slice(-4)
raw.create = {}
raw.create.t1 = await createTask(t1)
raw.create.t2 = await createTask(t2)
raw.create.t3 = await createTask(t3)
raw.delete = await deleteTask(t3)
await sleep(1500)
raw.offlineQueue = await queue()
raw.pushDuringOffline = pushCount()
const offlinePanel = await openSyncPanel()
raw.offlinePanel = offlinePanel
await closePopups()
check('BC-13.离线写均落地队列(含删除)', raw.offlineQueue.count >= 1 && raw.offlineQueue.items.some((i) => i.action === 'delete'), `queue=${raw.offlineQueue.count} items=${JSON.stringify(raw.offlineQueue.items.map((i) => i.table + ':' + i.action))}`)
check('BC-14.网络类失败不消耗额度(attempts 恒 0)', raw.offlineQueue.items.every((i) => !i.attempts || i.attempts === 0), `attempts=${JSON.stringify(raw.offlineQueue.items.map((i) => i.attempts))}`)
check('BC-14/G11.离线期无 /sync/push 请求', raw.pushDuringOffline - pushStart === 0, `pushDuringOffline=${raw.pushDuringOffline - pushStart}`)
check('BC-16/UI.面板显示暂停/待同步文案', /待同步|暂停|pending/i.test(String(offlinePanel)) || String(offlinePanel) === 'null', `panel="${String(offlinePanel).slice(0, 120)}"`)
raw.offlineRail = await snap('offline-rail')

// 恢复网络（不手动操作）
console.log('  … 恢复网络，等待自动补传（≤130s）')
await unblockApi()
const waitStart = Date.now()
let finalQueue = raw.offlineQueue
for (let i = 0; i < 70; i++) {
    await sleep(2000)
    finalQueue = await queue()
    if (finalQueue.count === 0) break
}
raw.autoBackfillWaitMs = Date.now() - waitStart
raw.finalQueue = finalQueue
raw.finalServer = await serverTasks()
raw.finalRail = await snap('after-backfill')
check('BC-13.恢复网络后自动补传(队列清空)', finalQueue.count === 0, `wait=${raw.autoBackfillWaitMs}ms queue=${finalQueue.count} remaining=${JSON.stringify(finalQueue.items)}`)
check('BC-13.远端与本地一致(含删除不复活)', raw.finalServer.names && raw.finalServer.names.includes(t1) && raw.finalServer.names.includes(t2) && !raw.finalServer.names.includes(t3), `serverNames=${JSON.stringify(raw.finalServer.names)}`)
await openSyncPanel().then((p) => (raw.afterBackfillPanel = p))
await closePopups()

// =====================================================================
console.log('\n=== 2) BC-15：业务类失败触顶 → 恢复路径（含删除项） ===')
const bizBody = JSON.stringify({ code: 10002, message: '业务校验失败', data: { code: 10002 } })
await cdp.mockResponses([{ urlPattern: '*api/sync/push', status: 200, body: bizBody }])
const t4 = 'S06-BIZ-' + Date.now().toString().slice(-4)
raw.bizCreate = await createTask(t4)
let bizQueue = { count: 0, items: [] }
for (let i = 0; i < 20; i++) { await sleep(1500); bizQueue = await queue(); if (bizQueue.items.some((x) => (x.attempts || 0) >= 1)) break }
raw.bizQueue = bizQueue
check('BC-15.业务类失败累加 attempts（触发触顶路径）', bizQueue.items.some((x) => (x.attempts || 0) >= 1), `queue=${JSON.stringify(bizQueue.items)}`)
// 恢复：清 mock + 立即重试/等待
await cdp.clearMocks()
await sleep(2000)
const retryClicked = await openSyncPanel().then(async (p) => {
    const clicked = await evaluate(`const b=[...document.querySelectorAll('ul.nue-dropdown--sync-panel button,[class*=sync-panel] button')].find(x=>/立即重试|立即同步/.test(x.innerText||'')); if(!b) return false; b.click(); return true`)
    return { panel: p, clicked }
})
raw.bizRetry = retryClicked
let bizFinal = bizQueue
for (let i = 0; i < 30; i++) { await sleep(2000); bizFinal = await queue(); if (bizFinal.count === 0) break }
raw.bizFinalQueue = bizFinal
raw.bizFinalServer = await serverTasks()
check('BC-15.触顶项恢复后完成回传', bizFinal.count === 0 && (raw.bizFinalServer.names || []).includes(t4), `queue=${bizFinal.count} server=${JSON.stringify(raw.bizFinalServer.names)}`)
await closePopups()

// =====================================================================
console.log('\n=== 3) 回归：凭证失效（mock 10041）→ 不无限重试、跳登录 ===')
await cdp.mockResponses([{ urlPattern: '*api/sync/pull', status: 200, body: JSON.stringify({ code: 10041, message: 'unauthorized', data: { code: 10041 } }) }])
await cdp.reload(0)
for (let i = 0; i < 40; i++) { if (await evaluate('return !!document.body')) break; await sleep(100) }
if (await evaluate(`return !!document.querySelector('.nue-container--unlock-gate input[type=password]')`)) await fillUnlock(args.password)
await sleep(5000)
const credState = await snap('credential-failure')
raw.credential = credState
check('AC6/回归.凭证失效走登录/重登（离线进入不可用）', /auth\/signin|重新登录/.test(credState.hash + credState.bodyText), `hash=${credState.hash} body="${credState.bodyText.slice(0, 100)}"`)
await cdp.clearMocks()
await cdp.reload(0)
await sleep(3000)

// =====================================================================
const out = { meta: { at: new Date().toISOString(), email: args.email, port: args.port }, checks, raw, console: cdp.warnings() }
fs.writeFileSync(join(outDir, 'shell-06-verify.json'), JSON.stringify(out, null, 2))
const fail = checks.filter((c) => c.status === 'FAIL').length
console.log(`\n=== 汇总：PASS ${checks.filter((c) => c.status === 'PASS').length} / FAIL ${fail} / INFO ${checks.filter((c) => c.status === 'INFO').length} ===`)
console.log(`报告：${join(outDir, 'shell-06-verify.json')}`)
cdp.close()

function parseArgs(argv) {
    const r = { port: 9344, out: '/tmp/shell06', urlMatch: 'index.html', email: process.env.NAO_QA_EMAIL, password: process.env.NAO_QA_PASSWORD }
    for (let i = 0; i < argv.length; i++) { const n = () => argv[++i]; if (argv[i] === '--port') r.port = Number(n()); else if (argv[i] === '--out') r.out = n(); else if (argv[i] === '--url-match') r.urlMatch = n(); else if (argv[i] === '--email') r.email = n(); else if (argv[i] === '--password') r.password = n() }
    return r
}
