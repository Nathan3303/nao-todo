/**
 * SHELL-05 T8：在线服务(默认生产 API) + 生产 file:// 产物 的「离线 Ctrl+R」端到端验证
 * 用法：node scripts/electron-smoke/shell-05-t8-online.mjs --port 9342 --email <online> --password <pass> --out <dir>
 */
import fs from 'node:fs'
import { join } from 'node:path'
import { connectRenderer, sleep } from './lib/cdp.mjs'

const args = parseArgs(process.argv.slice(2))
const outDir = args.out ?? '/tmp/shell05-t8-online'
fs.mkdirSync(outDir, { recursive: true })
const cdp = await connectRenderer({ port: args.port, urlMatch: 'index.html' })
await cdp.focusPage()

async function snap(label) {
    try {
        return await cdp.json(`(() => {
            const app=document.getElementById('app'); const vis=(n)=>{const b=n.getBoundingClientRect();const s=getComputedStyle(n);return b.width>0&&b.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!n.disabled}
            const interactive=app?[...app.querySelectorAll('button,input,textarea,select,a[href],[role=button]')].filter(vis):[]
            let errLog=null; try{ errLog=window.__NAO_ERROR_LOG__?[...window.__NAO_ERROR_LOG__]:null }catch(e){ errLog='ERR' }
            let router=null; try{ const r=app&&app.__vue_app__&&app.__vue_app__.config.globalProperties.$router; const c=r&&r.currentRoute.value; if(c) router={name:c.name,fullPath:c.fullPath} }catch(e){}
            return { label:${JSON.stringify(label)}, url:location.href, hash:location.hash, title:document.title, hasApp:!!app,
                appHtmlLen: app?app.innerHTML.length:-1, interactiveCount:interactive.length,
                unlockGate:!!document.querySelector('.nue-container--unlock-gate input[type=password]'),
                initialSyncGate:!!document.querySelector('.initial-sync-gate'), railBtn:!!document.querySelector('.sync-rail-btn'),
                offlineEnterBtn:!!([...document.querySelectorAll('#app button')].find(b=>/离线进入/.test(b.innerText||''))),
                router, bodyText:(document.body?document.body.innerText:'').replace(/\\s+/g,' ').slice(0,220),
                errorLog:Array.isArray(errLog)?errLog.slice(-5):errLog }
        })()`)
    } catch (e) { return { label, evalError: String(e.message).slice(0, 200) } }
}

async function fillUnlock(pwd) {
    for (let i = 0; i < 3; i++) {
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

async function signInOnline() {
    await cdp.emulateNetwork({ offline: false }).catch(() => {})
    await cdp.unblockUrls()
    for (let i = 0; i < 40; i++) {
        const st = await cdp.json(`({rail:!!document.querySelector('.sync-rail-btn'),signin:!!document.querySelector('input[type=email]'),unlock:!!document.querySelector('.nue-container--unlock-gate input[type=password]')})`)
        if (st.rail) return true
        if (st.signin) {
            await cdp.evaluate(`
                const s=(e,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,v);e.dispatchEvent(new Event('input',{bubbles:true}))}
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

const res = { meta: { port: args.port, email: args.email, at: new Date().toISOString() } }
res.onlineSignIn = await signInOnline()
await sleep(2000)
res.before = await snap('before-online')

// —— 用户操作：DevTools 置「离线」→ Ctrl+R ——
await cdp.emulateNetwork({ offline: true })
cdp.clearConsole()
await cdp.send('Page.reload', { ignoreCache: true }).catch(() => {})
await sleep(7000)
res.offlineReload = await snap('offline-reload')
res.offlineConsole = cdp.warnings()

// —— 离线重载后整链：解锁 → 初始同步失败 → 离线进入 ——
if (res.offlineReload.unlockGate) {
    await fillUnlock(args.password)
    for (let i = 0; i < 120; i++) {
        if (await cdp.evaluate(`return !![...document.querySelectorAll('#app button')].find(b=>/离线进入/.test(b.innerText||''))`)) break
        await sleep(250)
    }
    res.gate = await snap('offline-gate')
    const r = await cdp.json(`(() => { const b=[...document.querySelectorAll('#app button')].find(x=>/离线进入/.test(x.innerText||'')); if(!b) return null; const x=b.getBoundingClientRect(); return {cx:x.x+x.width/2,cy:x.y+x.height/2} })()`)
    if (r) await cdp.click(r.cx, r.cy, 300)
    await sleep(4000)
    res.afterOfflineEntry = await snap('after-offline-entry')
}

// 恢复
await cdp.emulateNetwork({ offline: false })
await cdp.unblockUrls()
await cdp.send('Page.reload', { ignoreCache: true }).catch(() => {})
await sleep(5000)
res.recovered = await snap('recovered')
fs.writeFileSync(join(outDir, 't8-online-file.json'), JSON.stringify(res, null, 2))
console.log(JSON.stringify({ signIn: res.onlineSignIn, online: res.before && { hash: res.before.hash, appLen: res.before.appHtmlLen },
    offlineReload: res.offlineReload && { url: res.offlineReload.url, hash: res.offlineReload.hash, appLen: res.offlineReload.appHtmlLen, inter: res.offlineReload.interactiveCount, unlockGate: res.offlineReload.unlockGate },
    gate: res.gate && { hash: res.gate.hash, offlineEnterBtn: res.gate.offlineEnterBtn, appLen: res.gate.appHtmlLen },
    afterEntry: res.afterOfflineEntry && { hash: res.afterOfflineEntry.hash, rail: res.afterOfflineEntry.railBtn, router: res.afterOfflineEntry.router, appLen: res.afterOfflineEntry.appHtmlLen },
    recovered: res.recovered && { hash: res.recovered.hash, appLen: res.recovered.appHtmlLen },
    errors: (res.offlineReload && res.offlineReload.errorLog) || null }, null, 1))
console.log(`报告：${join(outDir, 't8-online-file.json')}`)
cdp.close()

function parseArgs(argv) {
    const r = { port: 9342, out: '/tmp/shell05-t8-online', email: process.env.T8_EMAIL, password: process.env.T8_PASSWORD }
    for (let i = 0; i < argv.length; i++) { const n = () => argv[++i]; if (argv[i] === '--port') r.port = Number(n()); else if (argv[i] === '--out') r.out = n(); else if (argv[i] === '--email') r.email = n(); else if (argv[i] === '--password') r.password = n() }
    return r
}
