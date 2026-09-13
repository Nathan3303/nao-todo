/**
 * SHELL-05 T8：离线 Ctrl+R（reload）白屏归因探针（**只测不改**）
 * 用法：node scripts/electron-smoke/shell-05-t8-reload.mjs --port 9333 --url-match localhost:5173 --mode dev|file --out <dir>
 */
import fs from 'node:fs'
import { join } from 'node:path'
import { connectRenderer, sleep } from './lib/cdp.mjs'

const args = parseArgs(process.argv.slice(2))
const outDir = args.out ?? '/tmp/shell05-t8'
fs.mkdirSync(outDir, { recursive: true })

const cdp = await connectRenderer({ port: args.port, urlMatch: args.urlMatch })
await cdp.focusPage()

async function snap(label) {
    try {
        return await cdp.json(`(() => {
            const app = document.getElementById('app')
            const vis=(n)=>{const b=n.getBoundingClientRect();const s=getComputedStyle(n);return b.width>0&&b.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!n.disabled}
            const interactive=app?[...app.querySelectorAll('button,input,textarea,select,a[href],[role=button]')].filter(vis):[]
            let errLog=null; try{ errLog = window.__NAO_ERROR_LOG__ ? [...window.__NAO_ERROR_LOG__] : null }catch(e){ errLog='ERR' }
            let router=null; try{ const r=app&&app.__vue_app__&&app.__vue_app__.config.globalProperties.$router; const c=r&&r.currentRoute.value; if(c) router={name:c.name,fullPath:c.fullPath} }catch(e){}
            return { label:${JSON.stringify(label)}, url:location.href, hash:location.hash, title:document.title,
                hasApp:!!app, appHtmlLen: app?app.innerHTML.length:-1, interactiveCount: interactive.length,
                unlockGate:!!document.querySelector('.nue-container--unlock-gate'), initialSyncGate:!!document.querySelector('.initial-sync-gate'),
                railBtn:!!document.querySelector('.sync-rail-btn'), router,
                bodyText:(document.body?document.body.innerText:'').replace(/\\s+/g,' ').slice(0,300),
                errorLogLen: errLog==='ERR'?-2:(errLog===null?-1:errLog.length), errorLogSample: Array.isArray(errLog)?errLog.slice(-4):errLog }
        })()`)
    } catch (e) {
        return { label, evalError: String(e.message).slice(0, 300) }
    }
}

async function reloadOffline() {
    await cdp.emulateNetwork({ offline: true })
    cdp.clearConsole()
    await cdp.send('Page.reload', { ignoreCache: true }).catch(() => {})
    await sleep(6000)
    return snap('offline-reload')
}
async function reloadOnline() {
    await cdp.emulateNetwork({ offline: false })
    await cdp.unblockUrls()
    await cdp.send('Page.reload', { ignoreCache: true }).catch(() => {})
    await sleep(6000)
    return snap('online-reload')
}

const result = { meta: { port: args.port, urlMatch: args.urlMatch, mode: args.mode, at: new Date().toISOString() } }
result.before = await snap('before')
console.log('[before]', JSON.stringify(result.before).slice(0, 300))

result.onlineReload = await reloadOnline()
console.log('[online-reload]', JSON.stringify(result.onlineReload).slice(0, 300))

result.offlineReload = await reloadOffline()
console.log('[offline-reload]', JSON.stringify(result.offlineReload).slice(0, 300))

// 恢复在线
await cdp.emulateNetwork({ offline: false })
await cdp.unblockUrls()
await cdp.send('Page.reload', { ignoreCache: true }).catch(() => {})
await sleep(6000)
result.recovered = await snap('recovered')
console.log('[recovered]', JSON.stringify(result.recovered).slice(0, 200))

fs.writeFileSync(join(outDir, `t8-reload-${args.mode}.json`), JSON.stringify(result, null, 2))
console.log(`\n报告：${join(outDir, `t8-reload-${args.mode}.json`)}`)
cdp.close()

function parseArgs(argv) {
    const r = { port: 9333, urlMatch: 'localhost:5173', mode: 'dev', out: '/tmp/shell05-t8' }
    for (let i = 0; i < argv.length; i++) { const n = () => argv[++i]; if (argv[i] === '--port') r.port = Number(n()); else if (argv[i] === '--url-match') r.urlMatch = n(); else if (argv[i] === '--mode') r.mode = n(); else if (argv[i] === '--out') r.out = n() }
    return r
}
