/**
 * SHELL-05 T7 追加：离线功能面实机走查（生产构建 / 断网 / 已离线进入；**只测不改**）
 *
 * 前置：生产产物 Electron 运行中（file://），后端 localhost:3302 可（用于在线登录建密钥包）。
 * 用法：node scripts/electron-smoke/shell-05-offline-sweep.mjs --email <qa> --password <qa> --url-match index.html --out <dir>
 *
 * 输出：每项 `{ id, feature, status: 可用|降级|不可用|未覆盖, detail, evidence }` + 原始快照。
 */
import fs from 'node:fs'
import { join } from 'node:path'
import { connectRenderer, sleep } from './lib/cdp.mjs'

const API_BLOCK_URLS = ['*localhost:3302*', '*127.0.0.1:3302*']
const args = parseArgs(process.argv.slice(2))
const outDir = args.out ?? '/tmp/shell05-sweep'
fs.mkdirSync(outDir, { recursive: true })

const INJECT = `(() => { if (window.__sweep) return 'ok'; const s=window.__sweep={console:[],rejections:[]}; for (const lv of ['warn','error']) { const o=console[lv].bind(console); console[lv]=(...a)=>{try{s.console.push(lv+': '+a.map(x=>{try{return typeof x==='string'?x:(x&&(x.stack||x.message))||JSON.stringify(x)}catch{return String(x)}}).join(' ').slice(0,300))}catch{}; o(...a)} } window.addEventListener('unhandledrejection',e=>s.rejections.push(String(e.reason&&(e.reason.stack||e.reason.message)||e.reason).slice(0,300))); return 'ok' })()`

const cdp = await connectRenderer({ port: args.port, urlMatch: args.urlMatch })
await cdp.focusPage()
await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: INJECT })
await cdp.evaluate(INJECT)

const items = []
const record = (feature, id, status, detail, evidence) => {
    items.push({ feature, id, status, detail: String(detail), evidence: evidence ?? null })
    console.log(`  [${status}] ${feature}/${id} — ${detail}`)
}
const errsSince = (n) => cdp.warnings().slice(n)

async function snap() {
    return cdp.json(`(() => {
        const vis=(n)=>{const b=n.getBoundingClientRect();const st=getComputedStyle(n);return b.width>0&&b.height>0&&st.visibility!=='hidden'&&st.display!=='none'}
        const app=document.getElementById('app')
        let rs=null; try{const r=app&&app.__vue_app__&&app.__vue_app__.config.globalProperties.$router;const c=r&&r.currentRoute.value;if(c)rs={name:c.name,fullPath:c.fullPath,params:c.params}}catch(e){rs=String(e)}
        const text=(document.body.innerText||'').replace(/\\s+/g,' ')
        return { hash:location.hash, router:rs, rail:!!document.querySelector('.sync-rail-btn'),
            body:text.slice(0,500), inputs:[...document.querySelectorAll('#app input,#app textarea')].filter(vis).map(i=>({type:i.type,ph:i.placeholder,val:(i.value||'').slice(0,20)})).slice(0,8),
            buttons:[...document.querySelectorAll('#app button')].filter(vis).map(b=>(b.innerText||'').trim().slice(0,14)).filter(Boolean).slice(0,40) }
    })()`)
}

async function fillUnlock(pwd) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const gone = await cdp.evaluate(`
            const i=document.querySelector('.nue-container--unlock-gate input[type=password]'); if(!i) return true
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i, ${JSON.stringify(pwd)})
            i.dispatchEvent(new Event('input',{bubbles:true})); await new Promise(r=>setTimeout(r,300))
            ;[...document.querySelectorAll('#app button')].find(b=>/解锁/.test(b.innerText||''))?.click(); return false`)
        if (gone) return true
        await sleep(4000)
        if (!(await cdp.evaluate(`return !!document.querySelector('.nue-container--unlock-gate input[type=password]')`))) return true
    }
    return false
}

async function enterOfflineShell() {
    await cdp.emulateNetwork({ offline: false })
    await cdp.unblockUrls()
    await cdp.evaluate(`localStorage.removeItem('LAST_VISITED_ROUTE'); localStorage.removeItem('LAST_TASKS_ROUTE'); location.hash='#/'; return 'r'`)
    await sleep(400)
    // online bootstrap if needed
    await cdp.reload(0)
    for (let i = 0; i < 40; i++) { if (await cdp.evaluate('return !!document.body')) break; await sleep(100) }
    for (let i = 0; i < 25; i++) {
        const st = await cdp.json(`({rail:!!document.querySelector('.sync-rail-btn'),signin:!!document.querySelector('input[type=email]'),unlock:!!document.querySelector('.nue-container--unlock-gate input[type=password]'),gate:!!document.querySelector('.initial-sync-gate')})`)
        if (st.rail) break
        if (st.signin) { await cdp.evaluate(`const s=(e,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,v);e.dispatchEvent(new Event('input',{bubbles:true}))};s(document.querySelector('input[type=email]'),${JSON.stringify(args.email)});s(document.querySelector('input[type=password]'),${JSON.stringify(args.password)});await new Promise(r=>setTimeout(r,300));document.querySelector('button[type=submit]')?.click();return 1`); await sleep(6000); continue }
        if (st.unlock) { await fillUnlock(args.password); await sleep(3000); continue }
        if (st.gate) { await cdp.evaluate(`const b=[...document.querySelectorAll('#app button')].find(x=>/重新登录|登出用户/.test(x.innerText||''));b?.click();return 1`); await sleep(2500); continue }
        await sleep(1000)
    }
    // 断网冷启动 → 解锁 → 离线进入
    await cdp.blockUrls(API_BLOCK_URLS)
    await cdp.reload(0)
    for (let i = 0; i < 40; i++) { if (await cdp.evaluate('return !!document.body')) break; await sleep(100) }
    for (let i = 0; i < 40; i++) { if (await cdp.evaluate(`return !!document.querySelector('.nue-container--unlock-gate input[type=password]')`)) break; await sleep(250) }
    await fillUnlock(args.password)
    for (let i = 0; i < 120; i++) {
        if (await cdp.evaluate(`return !![...document.querySelectorAll('#app button')].find(b=>/离线进入/.test(b.innerText||''))`)) break
        await sleep(250)
    }
    await cdp.evaluate(`[...document.querySelectorAll('#app button')].find(b=>/离线进入/.test(b.innerText||''))?.click(); return 1`)
    await sleep(4000)
    return snap()
}

const clickText = async (re, scope) => cdp.evaluate(`
    const scope = ${scope ? `document.querySelector(${JSON.stringify(scope)})` : 'document'}
    if (!scope) return false
    const el = [...scope.querySelectorAll('button,[role=button]')].find((b) => ${re}.test((b.innerText||'')+(b.getAttribute('title')||'')+(b.getAttribute('aria-label')||'')))
    if (!el) return false
    const r = el.getBoundingClientRect(); if (r.width === 0) return false
    el.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2}))
    return true
`)

const goto = async (hash, wait = 2500) => { await cdp.evaluate(`location.hash=${JSON.stringify(hash)}; return 1`); await sleep(wait) }

// =====================================================================
console.log('=== 进入离线壳 ===')
const entered = await enterOfflineShell()
record('环境', 'offline-shell', entered.rail ? '可用' : '不可用', `hash=${entered.hash} rail=${entered.rail} body="${entered.body.slice(0, 80)}"`, entered)

// 1) 任务
console.log('=== 1) 任务 ===')
for (const vt of ['table', 'list', 'kanban']) {
    const e0 = cdp.warnings().length
    await goto(`#/tasks/all/${vt}`, 2500)
    const s = await snap()
    const errs = errsSince(e0)
    record('任务', `浏览-${vt}`, s.rail && errs.length === 0 ? '可用' : (errs.length ? '报错' : '降级'), `hash=${s.hash} router=${s.router?.params?.viewType} body="${s.body.slice(0, 70)}" errs=${errs.length}`, { snap: s, errs })
}
// create
{
    const e0 = cdp.warnings().length
    const title = `QA离线走查-${Date.now().toString().slice(-5)}`
    await goto('#/tasks/all/table', 1800)
    await clickText('/新增待办/')
    await sleep(1200)
    const filled = await cdp.evaluate(`
        const d=document.querySelector('.nue-dialog--task-creator'); if(!d) return false
        const i=d.querySelector('input.nue-input__input'); if(!i) return false
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i, ${JSON.stringify(title)})
        i.dispatchEvent(new Event('input',{bubbles:true})); await new Promise(r=>setTimeout(r,300))
        const b=[...d.querySelectorAll('.nue-dialog__footer button')].find(x=>/创建/.test(x.innerText||'')); b?.click(); return true`)
    await sleep(2500)
    const s = await snap()
    const errs = errsSince(e0)
    const ok = filled && s.body.includes(title)
    record('任务', '新建', ok ? '可用' : '不可用', `title="${title}" 出现=${s.body.includes(title)} errs=${errs.length}`, { snap: s, errs })
    if (ok) globalThis.__taskTitle = title
}
// complete（点击状态单元格/复选框最佳努力）
{
    const e0 = cdp.warnings().length
    const title = globalThis.__taskTitle
    const clicked = await cdp.evaluate(`
        const rows=[...document.querySelectorAll('#app *')].filter(n=>n.children.length===0 && (n.innerText||'').trim()===${JSON.stringify(title)})
        if(!rows.length) return 'norow'
        const row=rows[0].closest('tr') || rows[0].parentElement
        const box=row && row.querySelector('input[type=checkbox],button[class*=checkbox],[class*=check]')
        if(box){ const r=box.getBoundingClientRect(); box.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2})); return 'clicked-box' }
        return 'nobox'`)
    await sleep(2000)
    const s = await snap()
    const errs = errsSince(e0)
    record('任务', '勾选完成', clicked === 'clicked-box' ? (errs.length ? '降级' : '可用') : '未覆盖', `hit=${clicked} errs=${errs.length}`, { snap: s, errs })
}
// details: edit name / delete / subtask 入口
{
    const e0 = cdp.warnings().length
    const opened = await cdp.evaluate(`
        const n=[...document.querySelectorAll('#app *')].find(x=>x.children.length===0 && (x.innerText||'').trim()===${JSON.stringify(globalThis.__taskTitle || '')})
        if(!n) return false
        const r=n.getBoundingClientRect(); n.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2})); return true`)
    await sleep(2000)
    const s = await snap()
    const hasDrawer = await cdp.evaluate(`return !!document.querySelector('.tasks-details-view')`)
    const errs = errsSince(e0)
    record('任务', '编辑/详情', hasDrawer ? (errs.length ? '降级' : '可用') : '未覆盖', `opened=${opened} drawer=${hasDrawer} hash=${s.hash} errs=${errs.length}`, { snap: s, errs })
    // 子任务/检查项入口存在性（离线可点开）
    const sub = await cdp.evaluate(`return !!document.querySelector('.tasks-details-view__subtasks')`)
    record('任务', '子任务/检查项（入口）', sub ? '可用' : '未覆盖', `details__subtasks=${sub}`, { snap: s })
    await cdp.pressKey('Escape'); await sleep(600)
    record('任务', '拖拽排序', '未覆盖', 'CDP 无稳定拖拽手势封装，需人工/专项脚本', null)
}

// 2) 日历
console.log('=== 2) 日历 ===')
{
    const e0 = cdp.warnings().length
    await goto('#/calendar/monthly', 3000)
    const s1 = await snap()
    const hasMonth = /年.*月/.test(s1.body)
    const weekClicked = await clickText('/切换周视图|周/')
    await sleep(1500)
    const s2 = await snap()
    const errs = errsSince(e0)
    record('日历', '进入+月视图', s1.rail && hasMonth ? '可用' : '降级', `hash=${s1.hash} hasMonth=${hasMonth} body="${s1.body.slice(0,70)}"`, { snap: s1 })
    record('日历', '切换周视图', weekClicked ? (errs.length ? '降级' : '可用') : '未覆盖', `clicked=${weekClicked} 变更=${s2.body !== s1.body} errs=${errs.length}`, { snap: s2, errs })
    record('日历', '查看任务条', '未覆盖', '离线本地无日程任务；需构造带时间任务后人工核对（本轮未构造）', null)
}

// 3) 番茄
console.log('=== 3) 番茄 ===')
{
    const e0 = cdp.warnings().length
    await goto('#/pomodoro/timer', 3000)
    const s1 = await snap()
    const started = await clickText('/开始专注/')
    await sleep(2500)
    const s2 = await snap()
    const t1 = (s2.body.match(/\d{2}:\d{2}/) || [])[0]
    await sleep(2500)
    const s3 = await snap()
    const t2 = (s3.body.match(/\d{2}:\d{2}/) || [])[0]
    const running = started && !!t2 && t2 !== t1
    const errs = errsSince(e0)
    record('番茄', '进入+启动计时', running ? '可用' : (started ? '降级' : '未覆盖'), `clicked=${started} t1=${t1} t2=${t2} errs=${errs.length}`, { snap: s2, errs })
    const paused = await clickText('/暂停/')
    await sleep(1200)
    const s4 = await snap()
    record('番茄', '暂停/停止', paused ? '可用' : '未覆盖', `paused=${paused} body="${s4.body.slice(0,70)}"`, { snap: s4 })
    await goto('#/pomodoro/records', 2000)
    const s5 = await snap()
    record('番茄', '记录页', s5.rail ? '可用' : '降级', `hash=${s5.hash} body="${s5.body.slice(0,70)}"`, { snap: s5 })
}

// 4) 搜索
console.log('=== 4) 搜索 ===')
{
    const e0 = cdp.warnings().length
    await goto('#/search', 2500)
    const typed = await cdp.evaluate(`
        const i=document.querySelector('input[placeholder*="搜索"]'); if(!i) return false
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i, 'QA离线')
        i.dispatchEvent(new Event('input',{bubbles:true})); return true`)
    await sleep(2000)
    const s = await snap()
    const errs = errsSince(e0)
    const hasResult = s.body.includes('QA离线走查') || /暂无|没有|无匹配/.test(s.body)
    record('搜索', '输入+结果', typed && hasResult ? (errs.length ? '降级' : '可用') : (typed ? '降级' : '未覆盖'), `typed=${typed} result=${hasResult} errs=${errs.length} body="${s.body.slice(0,80)}"`, { snap: s, errs })
    const filter = await clickText('/清单/')
    await sleep(1000)
    record('搜索', '筛选面板', filter ? '可用' : '未覆盖', `clicked=${filter}`, { snap: await snap() })
}

// 5) 清单/标签
console.log('=== 5) 清单/标签 ===')
{
    const e0 = cdp.warnings().length
    await goto('#/tasks/all/table', 2000)
    const s = await snap()
    const hasSidebar = /清单/.test(s.body) && /标签/.test(s.body)
    record('清单/标签', '侧栏显示', hasSidebar ? '可用' : '降级', `清单&标签可见=${hasSidebar}`, { snap: s })
    const projClicked = await cdp.evaluate(`const b=[...document.querySelectorAll('#app button')].find(x=>/^清单/.test((x.innerText||'').trim())); if(!b) return false; const r=b.getBoundingClientRect(); b.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2})); return true`)
    await sleep(1200)
    const s2 = await snap()
    record('清单/标签', '切换清单视图', projClicked ? '可用' : '未覆盖', `clicked=${projClicked} hash=${s2.hash}`, { snap: s2 })
    const pCreate = await cdp.evaluate(`return !!([...document.querySelectorAll('#app button')].find(x=>/新建清单|创建清单|新增清单/.test(x.innerText||'')))`)
    record('清单/标签', '创建/重命名', pCreate ? '可用' : '未覆盖', `创建入口按钮存在=${pCreate}（重命名未自动执行）`, { snap: s2, errs: errsSince(e0) })
}

// 6) 设置
console.log('=== 6) 设置 ===')
{
    const e0 = cdp.warnings().length
    await goto('#/tasks/all/table', 1800)
    const opened = await cdp.evaluate(`document.getElementById('AppAsideSettingsGearBtn')?.click(); return 1`)
    await sleep(1500)
    const s1 = await snap()
    const hasSettings = await cdp.evaluate(`return !!document.querySelector('.nue-dialog--settings')`)
    const before = await cdp.evaluate(`return getComputedStyle(document.documentElement).getPropertyValue('--nue-dark-switch').trim()`)
    // try click a theme toggle inside settings
    const themed = await cdp.evaluate(`
        const d=document.querySelector('.nue-dialog--settings'); if(!d) return false
        const cand=[...d.querySelectorAll('button,[role=switch],[role=radio],input[type=radio]')].find(x=>/深色|主题|暗色|dark/i.test((x.innerText||'')+(x.getAttribute('aria-label')||'')))
        if(cand){ cand.click(); return true } return false`)
    await sleep(1000)
    const after = await cdp.evaluate(`return getComputedStyle(document.documentElement).getPropertyValue('--nue-dark-switch').trim()`)
    const langToggled = await cdp.evaluate(`
        const d=document.querySelector('.nue-dialog--settings'); if(!d) return false
        const cand=[...d.querySelectorAll('button,[role=radio],input[type=radio]')].find(x=>/English|语言|Language/i.test((x.innerText||'')+(x.getAttribute('aria-label')||'')))
        if(cand){ cand.click(); return true } return false`)
    await sleep(1000)
    const s2 = await snap()
    const errs = errsSince(e0)
    record('设置', '打开对话框', hasSettings ? '可用' : '不可用', `opened=${opened} settings=${hasSettings} body="${s1.body.slice(0,70)}"`, { snap: s1 })
    record('设置', '主题切换', themed ? '可用' : '未覆盖', `clicked=${themed} darkSwitch ${before}→${after}`, { snap: s2 })
    record('设置', '语言切换', langToggled ? '可用' : '未覆盖', `clicked=${langToggled} body="${s2.body.slice(0,60)}" errs=${errs.length}`, { snap: s2, errs })
    await cdp.pressKey('Escape'); await sleep(600)
}

// 7) 本地提醒
{
    const reminder = await cdp.evaluate(`return { visibility: document.visibilityState, hasNotificationApi: 'Notification' in window, permission: ('Notification' in window) ? Notification.permission : null }`)
    record('本地提醒', '调度启动（解锁后）', '降级', `无网络依赖（静态：useLocalReminder.start 于 unlock 触发）；无可观测 DOM 锚点 → 仅记录环境：${JSON.stringify(reminder)}`, reminder)
}

// 8) 同步
console.log('=== 8) 同步 ===')
{
    const e0 = cdp.warnings().length
    await goto('#/tasks/all/table', 1800)
    await cdp.evaluate(`document.querySelector('.sync-rail-btn')?.click(); return 1`)
    await sleep(1200)
    const s = await snap()
    const panel = await cdp.evaluate(`(() => { const p=document.querySelector('ul.nue-dropdown--sync-panel'); return p ? (p.innerText||'').replace(/\\s+/g,' ') : null })()`)
    const errs = errsSince(e0)
    const showsFailure = panel && /失败|网络|从未同步|待推送|未同步/.test(panel)
    record('同步', '状态面板失败/待推送', showsFailure ? '可用' : '降级', `panel="${String(panel).slice(0, 140)}" errs=${errs.length}`, { snap: s, errs })
    // 同步不可用不影响功能：面板开着也能切换视图
    await cdp.pressKey('Escape'); await sleep(500)
    await goto('#/tasks/all/table', 1500)
    const s2 = await snap()
    record('同步', '不阻塞功能', s2.rail && /所有任务/.test(s2.body) ? '可用' : '降级', `面板关闭后任务视图可用=${s2.rail}`, { snap: s2 })
}

// console 汇总
await cdp.emulateNetwork({ offline: false })
await cdp.unblockUrls()
const allConsole = cdp.warnings()
const out = { meta: { at: new Date().toISOString(), outDir }, items, console: allConsole }
fs.writeFileSync(join(outDir, 'shell-05-offline-sweep.json'), JSON.stringify(out, null, 2))
const tally = items.reduce((a, x) => ((a[x.status] = (a[x.status] || 0) + 1), a), {})
console.log(`\n=== 走查汇总：${JSON.stringify(tally)} ===`)
console.log(`报告：${join(outDir, 'shell-05-offline-sweep.json')}`)
cdp.close()

function parseArgs(argv) {
    const r = { port: 9333, out: '/tmp/shell05-sweep', urlMatch: 'index.html', email: process.env.NAO_QA_EMAIL, password: process.env.NAO_QA_PASSWORD }
    for (let i = 0; i < argv.length; i++) { const n = () => argv[++i]; if (argv[i] === '--email') r.email = n(); else if (argv[i] === '--password') r.password = n(); else if (argv[i] === '--port') r.port = Number(n()); else if (argv[i] === '--out') r.out = n(); else if (argv[i] === '--url-match') r.urlMatch = n() }
    return r
}
