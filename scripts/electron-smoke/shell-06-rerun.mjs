/**
 * SHELL-06 T3 复跑（DEF-01 修复后）：BC-13 退避定时路径 + 反向 + 提前唤醒 + 补齐项
 * 只测不改。用法：--port 9345 --email <qa> --password <qa> --out <dir>
 */
import fs from 'node:fs'
import { join } from 'node:path'
import { connectRenderer, sleep } from './lib/cdp.mjs'

const args = parseArgs(process.argv.slice(2))
const outDir = args.out ?? '/tmp/shell06-rerun'
fs.mkdirSync(outDir, { recursive: true })
const cdp = await connectRenderer({ port: args.port, urlMatch: 'index.html' })
await cdp.focusPage()

const checks = []
const check = (id, ok, detail) => { checks.push({ id, status: ok ? 'PASS' : 'FAIL', detail: String(detail) }); console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${id} — ${detail}`) }
const info = (id, detail) => { checks.push({ id, status: 'INFO', detail: String(detail) }); console.log(`  [INFO] ${id} — ${detail}`) }
const raw = {}
const evaluate = (b) => cdp.evaluate(b)
const json = (e) => cdp.json(e)
const blockApi = () => cdp.blockUrls(['*localhost:3302*', '*127.0.0.1:3302*'])
const unblockApi = () => cdp.unblockUrls()
const pushCount = () => cdp.requests().filter((u) => /\/api\/sync\/push/.test(u)).length

const queue = () => json(`(() => new Promise((res)=>{ const r=indexedDB.open('nao-todo-desktop'); r.onsuccess=()=>{ const db=r.result; const req=db.transaction('syncQueue','readonly').objectStore('syncQueue').getAll(); req.onsuccess=()=>res({count:req.result.length, items:req.result.map(x=>({table:x.table,action:x.action,retryCount:x.retryCount,attempts:x.attempts,nextAttemptAt:x.nextAttemptAt,lastErrorClass:x.lastErrorClass}))}) }; r.onerror=()=>res({error:String(r.error)}) }))()`)

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
        if (st.unlock) { await unlock(); continue }
        await sleep(1000)
    }
    return false
}
async function unlock() {
    for (let i = 0; i < 3; i++) {
        const gone = await evaluate(`
            const i=document.querySelector('.nue-container--unlock-gate input[type=password]'); if(!i) return true
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i, ${JSON.stringify(args.password)})
            i.dispatchEvent(new Event('input',{bubbles:true})); await new Promise(r=>setTimeout(r,300))
            const b=[...document.querySelectorAll('#app button')].find(x=>/解锁/.test(x.innerText||'')); if(b)b.click(); return false`)
        if (gone) return true
        await sleep(4000)
        if (!(await evaluate(`return !!document.querySelector('.nue-container--unlock-gate input[type=password]')`))) return true
    }
    return false
}
async function createTask(title) {
    await evaluate("window.__T = " + JSON.stringify(title) + "; return 1")
    await cdp.pressKey('n', 1300)
    const r = await evaluate(`
        const d=document.querySelector('.nue-dialog--task-creator'); if(!d) return 'nodialog'
        const i=d.querySelector('input.nue-input__input'); if(!i) return 'noinput'
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i, window.__T)
        i.dispatchEvent(new Event('input',{bubbles:true})); await new Promise(r=>setTimeout(r,300))
        const b=[...d.querySelectorAll('.nue-dialog__footer button')].find(x=>/创建/.test(x.innerText||'')); if(b)b.click(); return 'ok'`)
    await sleep(2000)
    return { r, appeared: await evaluate(`return (document.body.innerText||'').includes(window.__T)`) }
}
async function deleteTask(title) {
    await evaluate("window.__T = " + JSON.stringify(title) + "; return 1")
    await evaluate(`
        const n=[...document.querySelectorAll('#app *')].find(x=>x.children.length===0 && (x.innerText||'').trim()===window.__T); if(!n) return 0
        const r=n.getBoundingClientRect(); n.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2})); return 1`)
    await sleep(1500)
    await evaluate(`
        const el=[...document.querySelectorAll('#app *')].find(n=>(n.innerText||'').trim()==='更多'); if(!el) return 0
        const r=el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2})); return 1`)
    await sleep(1200)
    const popup = await evaluate(`(() => { const vis=(n)=>{const b=n.getBoundingClientRect();return b.width>0&&b.height>0}; return [...document.querySelectorAll('#TopLevelNuePopupPool li,#TopLevelNuePopupPool button,#app .nue-dropdown li,#app .nue-dropdown button')].filter(vis).map(x=>(x.innerText||'').trim()).filter(t=>t&&t.length<24) })()`)
    const clicked = await evaluate(`
        const els=[...document.querySelectorAll('#TopLevelNuePopupPool li,#TopLevelNuePopupPool button,#app .nue-dropdown li,#app .nue-dropdown button')].filter(n=>/删除/.test(n.innerText||''))
        if(!els.length) return 'nodelete'
        const el=els[els.length-1]; const r=el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2})); return 'clicked'`)
    await sleep(1000)
    const confirmed = await evaluate(`
        const b=[...document.querySelectorAll('.nue-dialog button,#app button')].find(x=>/^删除$|确认删除|Delete/.test((x.innerText||'').trim()))
        if(!b) return 'noconfirm'; b.click(); return 'confirmed'`)
    await sleep(2000)
    return { popup, clicked, confirmed, gone: !(await evaluate(`return (document.body.innerText||'').includes(${JSON.stringify(title)})`)) }
}
async function waitQueueEmpty(maxMs = 30000) {
    const t0 = Date.now()
    while (Date.now() - t0 < maxMs) { await sleep(500); if ((await queue()).count === 0) return Date.now() - t0 }
    return null
}
async function openSyncPanel() {
    const r = await json(`(() => { const b=document.querySelector('.sync-rail-btn'); if(!b) return null; const x=b.getBoundingClientRect(); return {cx:x.x+x.width/2,cy:x.y+x.height/2} })()`)
    if (r) await cdp.click(r.cx, r.cy, 900)
    const v = await json(`(() => { const pool=document.querySelector('#TopLevelNuePopupPool'); const p=document.querySelector('ul.nue-dropdown--sync-panel')||document.querySelector('[class*=sync-panel]'); return { panelText:p?(p.innerText||'').replace(/\\s+/g,' ').slice(0,220):null, poolText:pool?(pool.innerText||'').replace(/\\s+/g,' ').slice(0,220):null, hasRetry:[...document.querySelectorAll('button')].some(b=>/立即重试|立即同步/.test(b.innerText||'')) } })()`).catch(()=>null)
    return v ?? { panelText: null, poolText: null, hasRetry: false }
}
async function closePopups() { for (let i = 0; i < 3; i++) { await cdp.pressKey('Escape'); await sleep(300) } }

console.log('=== SETUP 登录 ===')
const signed = await signIn()
await evaluate("location.hash='#/tasks/all/table'; return 1"); await sleep(1500)
await unblockApi(); await cdp.clearMocks(); await sleep(1500)
info('SETUP', `signed=${signed} queue=${JSON.stringify((await queue()).count)}`)

// ---------------------------------------------------------------------
console.log('\n=== 1) BC-13 退避定时路径（后端不可达，无 online 事件） ===')
await closePopups()
await blockApi()
cdp.clearRequests()
const t1 = 'S06R-A-' + Date.now().toString().slice(-4)
const t2 = 'S06R-B-' + Date.now().toString().slice(-4)
await createTask(t1); await createTask(t2)
const qOffline = await queue()
const pushesAtPause = pushCount()
raw.qOffline = qOffline
raw.pushesAtPause = pushesAtPause
// 模拟"后端恢复"：解除封锁，不派发 online
await unblockApi()
const drainedMs = await waitQueueEmpty(40000)
const pushesAfter = pushCount()
raw.drainedMs = drainedMs
raw.pushesAfter = pushesAfter
check('BC-13(定时).网络类暂停到期后自动补传（无 online）', drainedMs !== null, `drainedMs=${drainedMs} queueOffline=${qOffline.count}`)
check('BC-13(定时).补传耗时 ≤ 暂停窗口+一个退避周期(≤15s)', drainedMs !== null && drainedMs <= 15000, `drainedMs=${drainedMs}`)
// 反向：成功后定时器停止（观察 15s，不再新增 push）
const afterDrainPush = pushCount()
await sleep(15000)
const idlePush = pushCount()
raw.idleDelta = idlePush - afterDrainPush
check('BC-13(反向).成功清空后定时器停止（无残留 tick）', idlePush - afterDrainPush === 0, `idleΔpush=${idlePush - afterDrainPush}`)
await evaluate(`return (window.__NAO_ERROR_LOG__||[]).length`).then((n) => (raw.errLogLen = n))

console.log('\n=== 2) 暂停期不产生额外 /sync/push（G11 不回退） ===')
await blockApi(); cdp.clearRequests()
const t3 = 'S06R-C-' + Date.now().toString().slice(-4)
await createTask(t3)
await sleep(3000) // 首轮失败已发生，进入 5s 暂停
const p1 = pushCount()
await sleep(4000) // 仍处暂停窗口内
const p2 = pushCount()
raw.pausePushDelta = p2 - p1
check('G11.无请求风暴(一次写→≤2 次 push，含暂停到期重试)', p2 <= 2, `p1=${p1} p2=${p2}（第 2 次为暂停到期自动重试，符合 C-40；非每次写触发）`)
await unblockApi(); await waitQueueEmpty(30000)

console.log('\n=== 3) online/前台/手动 提前唤醒并清掉已排定时器 ===')
await blockApi(); cdp.clearRequests()
const t4 = 'S06R-D-' + Date.now().toString().slice(-4)
await createTask(t4)
const beforeWake = pushCount()
await unblockApi()
await evaluate(`window.dispatchEvent(new Event('online')); return 1`)
const wakeMs = await waitQueueEmpty(10000)
const afterWake = pushCount()
raw.wake = { wakeMs, beforeWake, afterWake }
check('提前唤醒(online)立即补传', wakeMs !== null, `wakeMs=${wakeMs}`)
check('提前唤醒后无重复风暴', afterWake - beforeWake <= 3, `Δpush=${afterWake - beforeWake}`)

console.log('\n=== 4) 业务类「删除项」触顶恢复 ===')
await cdp.clearMocks(); await unblockApi()
await blockApi()
const t5 = 'S06R-DEL-' + Date.now().toString().slice(-4)
await createTask(t5)
const del = await deleteTask(t5)
raw.bizDelete = { del, queue: await queue() }
await unblockApi()
await cdp.mockResponses([{ urlPattern: '*api/sync/push', status: 200, body: JSON.stringify({ code: 10002, message: 'biz', data: { code: 10002 } }) }])
await evaluate(`window.dispatchEvent(new Event('online')); return 1`)
await sleep(3000)
raw.bizDeleteFailed = await queue()
check('BC-15(删除项).业务失败累加 attempts 且条目为 delete', raw.bizDeleteFailed.items.some((i) => i.action === 'delete' && (i.attempts || 0) >= 1), JSON.stringify(raw.bizDeleteFailed.items))
await cdp.clearMocks()
await evaluate(`window.dispatchEvent(new Event('online')); return 1`)
const bizDrainMs = await waitQueueEmpty(20000)
raw.bizDrainMs = bizDrainMs
const token = await evaluate("return localStorage.getItem('USER_JWT')")
let names = []
try { const r = await fetch('http://127.0.0.1:3302/api/tasks/?limit=100', { headers: { Authorization: 'Bearer ' + token } }); const b = await r.json(); names = (Array.isArray(b?.data) ? b.data : []).map((x) => x.name) } catch {}
raw.bizServerHasT5 = names.includes(t5)
check('BC-15(删除项).恢复后回传完成、远端无该任务(不复活)', bizDrainMs !== null && names.includes(t5) === false, `drainMs=${bizDrainMs} serverHasT5=${names.includes(t5)}`)

console.log('\n=== 5) 「立即重试」按钮 ===')
// 构造业务失败项
await blockApi()
const t6 = 'S06R-RETRY-' + Date.now().toString().slice(-4)
await createTask(t6)
await unblockApi()
await cdp.mockResponses([{ urlPattern: '*api/sync/push', status: 200, body: JSON.stringify({ code: 10002, message: 'biz', data: { code: 10002 } }) }])
await evaluate(`window.dispatchEvent(new Event('online')); return 1`)
await sleep(3000)
const panel = await openSyncPanel()
raw.panel = panel
const retryClicked = await evaluate(`
    const els=[...document.querySelectorAll('button,[role=button]')].filter(n=>/立即重试|立即同步/.test(n.innerText||''))
    if(!els.length) return 'nobutton'
    const b=els[els.length-1]; b.click(); return b.innerText.trim()`)
raw.retryClicked = retryClicked
await cdp.clearMocks()
const retryDrainMs = retryClicked === 'nobutton' ? null : await waitQueueEmpty(15000)
raw.retryDrainMs = retryDrainMs
check('立即重试按钮存在并可触发', retryClicked !== 'nobutton', `clicked="${retryClicked}" panel=${JSON.stringify(panel ?? {}).slice(0, 160)}`)
check('立即重试后队列清空', retryDrainMs !== null && retryDrainMs <= 15000, `drainMs=${retryDrainMs}`)
await closePopups()

console.log('\n=== 6) G13 会话管理离线占位（无 toast） ===')
await cdp.clearMocks(); await unblockApi()
await blockApi()
await cdp.reload(0)
for (let i = 0; i < 40; i++) { if (await evaluate('return !!document.body')) break; await sleep(100) }
for (let i = 0; i < 30; i++) { if (await evaluate(`return !!document.querySelector('.nue-container--unlock-gate input[type=password]')`)) break; await sleep(250) }
await unlock()
for (let i = 0; i < 60; i++) { if (await evaluate(`return !![...document.querySelectorAll('#app button')].find(b=>/离线进入/.test(b.innerText||''))`)) break; await sleep(300) }
await evaluate(`[...document.querySelectorAll('#app button')].find(b=>/离线进入/.test(b.innerText||''))?.click(); return 1`)
await sleep(4000)
raw.offlineShell = await evaluate('return location.hash')
const gearClicked = await evaluate(`document.getElementById('AppAsideSettingsGearBtn')?.click(); return 1`)
await sleep(1800)
const settingsOpen = await evaluate(`return !!document.querySelector('.nue-dialog--settings')`)
await evaluate(`const d=document.querySelector('.nue-dialog--settings'); if(d)[...d.querySelectorAll('button')].find(b=>/密码与安全/.test(b.innerText||''))?.click(); return 1`)
await sleep(2000)
const g13 = await json(`(() => ({ needsNetwork:/需联网查看/.test(document.body.innerText||''), toasts:[...document.querySelectorAll('[class*=message],[class*=toast],[class*=notify]')].map(x=>(x.innerText||'').trim()).filter(Boolean).slice(0,6) }))()`)
raw.g13 = { gearClicked, settingsOpen, ...g13 }
check('G13.离线显示「需联网查看」占位', g13.needsNetwork === true, `needsNetwork=${g13.needsNetwork} settingsOpen=${settingsOpen}`)
check('G13.离线无 toast 噪声', (g13.toasts || []).length === 0, `toasts=${JSON.stringify(g13.toasts)}`)
await closePopups(); await unblockApi()

// ---------------------------------------------------------------------
const out = { meta: { at: new Date().toISOString(), port: args.port, head: args.head }, checks, raw, console: cdp.warnings() }
fs.writeFileSync(join(outDir, 'shell-06-rerun.json'), JSON.stringify(out, null, 2))
const fail = checks.filter((c) => c.status === 'FAIL').length
console.log(`\n=== 汇总：PASS ${checks.filter((c) => c.status === 'PASS').length} / FAIL ${fail} / INFO ${checks.filter((c) => c.status === 'INFO').length} ===`)
console.log(`报告：${join(outDir, 'shell-06-rerun.json')}`)
cdp.close()

function parseArgs(argv) {
    const r = { port: 9345, out: '/tmp/shell06-rerun', head: '95a9744b', urlMatch: 'index.html', email: process.env.NAO_QA_EMAIL, password: process.env.NAO_QA_PASSWORD }
    for (let i = 0; i < argv.length; i++) { const n = () => argv[++i]; if (argv[i] === '--port') r.port = Number(n()); else if (argv[i] === '--out') r.out = n(); else if (argv[i] === '--head') r.head = n(); else if (argv[i] === '--url-match') r.urlMatch = n(); else if (argv[i] === '--email') r.email = n(); else if (argv[i] === '--password') r.password = n() }
    return r
}
