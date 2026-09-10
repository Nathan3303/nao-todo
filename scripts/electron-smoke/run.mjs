/**
 * Electron 冒烟运行器（可重复执行，无需重写脚本）
 *
 * 用法：
 *   node scripts/electron-smoke/run.mjs [options]
 * 常用：
 *   --launch                自动起 Electron（含 --noSandbox / CDP 端口），跑完自动关
 *   --only smoke-1,smoke-2  只跑指定分组（改动后复跑受影响项）
 *   --list                  列出分组，不执行
 *   --probe-task            额外跑"受控探针任务"（会写入 1 条业务数据，默认关闭）
 * 环境变量（不写入仓库）：
 *   NAO_QA_EMAIL / NAO_QA_PASSWORD   登录与解锁所需凭据（本地 dev 账号）
 *
 * 前置：后端 localhost:3302 存活（否则冷启动会白屏，属既有缺陷 DEF-OFFLINE-01，非本工具问题）。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { connectRenderer, sleep } from './lib/cdp.mjs'
import { assertVisible, bootstrap } from './lib/app.mjs'
import { shell02SyncRail } from './checks/shell-02-sync-rail.mjs'
import { shell03Offline } from './checks/shell-03-offline.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const FEATURES = { 'shell-02': shell02SyncRail, 'shell-03': shell03Offline }

const options = parseArgs(process.argv.slice(2))
if (options.help) {
    console.log(fs.readFileSync(join(HERE, 'README.md'), 'utf8'))
    process.exit(0)
}
const feature = FEATURES[options.feature]
if (!feature) {
    console.error(`未知 feature：${options.feature}（可用：${Object.keys(FEATURES).join(', ')}）`)
    process.exit(2)
}
const groups = feature.groups.filter((group) => {
    if (group.optIn && !options[group.optIn]) return false
    if (options.only.length > 0 && !options.only.includes(group.id)) return false
    return true
})
if (feature.pending)
    console.log(`[note] ${feature.id} 为脚手架，待正式派发后运行：${feature.pending}`)
if (options.list || groups.length === 0) {
    console.log(`feature=${feature.id} ${feature.title}`)
    for (const group of feature.groups) {
        const skipped =
            options.only.length > 0 && !options.only.includes(group.id) ? ' [未选中]' : ''
        const optIn = group.optIn ? ` [需 --${group.optIn}]` : ''
        console.log(`  - ${group.id}: ${group.title}${skipped}${optIn}`)
    }
    process.exit(options.list ? 0 : 2)
}

const outDir = options.out ?? join(os.tmpdir(), `electron-smoke-${feature.id}-${Date.now()}`)
const allChecks = []
fs.mkdirSync(outDir, { recursive: true })

let launcher = null
try {
    if (options.launch) launcher = await launchElectron(options.port)
    const cdp = await connectRenderer({ port: options.port, urlMatch: options.urlMatch })
    const visibility = await assertVisible(cdp)
    const session = await bootstrap(cdp, { email: options.email, password: options.password })
    console.log(
        `[env] visibility=${visibility} hash=${session.hash} bootstrap=${session.ok ? 'OK' : 'FAILED'}`
    )
    for (const note of session.notes) console.log(`[env] ${note}`)
    if (!session.ok) {
        console.error('[env] 未能进入主界面：跳过需要 UI 的检查（请核对后端与凭据）')
    }

    const duration = {}
    for (const group of groups) {
        const started = Date.now()
        console.log(`\n=== ${group.id} · ${group.title} ===`)
        const checks = await group.run({
            cdp,
            outDir,
            email: options.email,
            password: options.password,
            title: options.title,
            probeTask: options.probeTask,
            setNickname: options.setNickname,
            state: {}
        })
        duration[group.id] = Date.now() - started
        for (const check of checks) {
            console.log(`  [${check.status}] ${check.id} ${check.title} — ${check.detail}`)
        }
        allChecks.push(...checks.map((check) => ({ ...check, group: group.id })))
    }
    cdp.close()
    writeReport(allChecks, { feature, outDir, options, duration, session })
} finally {
    if (launcher) await stopElectron(launcher)
}

const failed = allChecks.filter((check) => check.status === 'FAIL')
const passed = allChecks.filter((check) => check.status === 'PASS')
const skipped = allChecks.filter((check) => check.status === 'SKIP')
const infoCount = allChecks.length - passed.length - failed.length - skipped.length
console.log(
    `\n=== 汇总：PASS ${passed.length} / FAIL ${failed.length} / SKIP ${skipped.length} / INFO ${infoCount} ===`
)
console.log(`报告：${join(outDir, 'report.txt')} / report.json`)
if (failed.length > 0) {
    console.log('失败项：')
    for (const check of failed)
        console.log(`  - ${check.group}/${check.id} ${check.title} — ${check.detail}`)
}
process.exit(failed.length > 0 ? 1 : 0)

function writeReport(checks, meta) {
    fs.writeFileSync(join(meta.outDir, 'report.json'), JSON.stringify({ meta, checks }, null, 1))
    const lines = [
        `feature: ${meta.feature.id} ${meta.feature.title}`,
        `time: ${new Date().toISOString()}`,
        `env: visibility=${meta.session.visibility} hash=${meta.session.hash} bootstrap=${meta.session.ok}`,
        ''
    ]
    for (const check of checks)
        lines.push(`[${check.status}] ${check.group}/${check.id} ${check.title} — ${check.detail}`)
    fs.writeFileSync(join(meta.outDir, 'report.txt'), lines.join('\n'))
}

function parseArgs(argv) {
    const result = {
        feature: 'shell-02',
        port: 9333,
        urlMatch: 'localhost:5173',
        only: [],
        launch: false,
        list: false,
        help: false,
        probeTask: false,
        setNickname: undefined,
        title: '[QA-PROBE] 受控探针任务',
        email: process.env.NAO_QA_EMAIL,
        password: process.env.NAO_QA_PASSWORD
    }
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]
        const next = () => argv[++i]
        if (arg === '--launch') result.launch = true
        else if (arg === '--list') result.list = true
        else if (arg === '-h' || arg === '--help') result.help = true
        else if (arg === '--probe-task') result.probeTask = true
        else if (arg === '--set-nickname') result.setNickname = next()
        else if (arg === '--feature') result.feature = next()
        else if (arg === '--port') result.port = Number(next())
        else if (arg === '--out') result.out = next()
        else if (arg === '--only')
            result.only = String(next())
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
        else if (arg === '--email') result.email = next()
        else if (arg === '--password') result.password = next()
        else if (arg === '--title') result.title = next()
        else if (arg === '--url-match') result.urlMatch = next()
        else {
            console.error(`未知参数：${arg}`)
            process.exit(2)
        }
    }
    return result
}

/** 启动 Electron 开发态（含 --noSandbox：本机 SUID sandbox 未配置时的必需开关） */
async function launchElectron(port) {
    console.log(`[launch] electron-vite dev --noSandbox --remoteDebuggingPort ${port}`)
    const child = spawn(
        'pnpm',
        [
            '--filter',
            '@nao-todo/desktopapp',
            'dev',
            '--noSandbox',
            '--remoteDebuggingPort',
            String(port)
        ],
        { cwd: REPO_ROOT, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }
    )
    child.stdout.on('data', (chunk) => process.stdout.write(`[electron] ${chunk}`))
    child.stderr.on('data', (chunk) => process.stderr.write(`[electron] ${chunk}`))
    const deadline = Date.now() + 120000
    for (;;) {
        await sleep(1000)
        try {
            const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()
            if (version?.Browser) {
                console.log(`[launch] CDP 就绪：${version.Browser}`)
                break
            }
        } catch {
            // 未就绪，继续等
        }
        if (Date.now() > deadline) throw new Error('等待 Electron/CDP 启动超时（120s）')
    }
    return child
}

async function stopElectron(child) {
    try {
        process.kill(-child.pid, 'SIGTERM')
    } catch {
        child.kill('SIGTERM')
    }
    await sleep(1500)
}