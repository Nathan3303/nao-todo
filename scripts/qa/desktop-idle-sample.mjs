/**
 * 桌面端「空闲资源」采样器（QA 基线 / 改前改后对照，T1/T2 辅助）
 *
 * 用法（在仓库根执行）：
 *   node scripts/qa/desktop-idle-sample.mjs --seconds 60 --warmup 25
 * 常用参数：
 *   --seconds <n>   采样时长（默认 60）
 *   --warmup <n>    启动后预热等待秒数（等窗口 ready / 首屏渲染完成，默认 25）
 *   --runs <n>      重复轮数（默认 1）
 *   --label <text>  输出标注（如 pre-change / post-change）
 *   --keep-open     采样后不关应用（人工观察）
 *
 * 口径：
 *   - **进程树**（主进程 + zygote + renderer + GPU + utility）求和，而不是只看主进程；
 *   - CPU 用 `/proc/<pid>/stat` 的 utime+stime **增量**（`ps %cpu` 是进程生命周期均值，不能用）；
 *   - RSS 用 `/proc/<pid>/statm` 常驻页 × 页大小；
 *   - 每次运行使用**独立临时 userData**（`--user-data-dir`），不碰真实用户数据。
 *
 * ⚠️ 状态如实记录：未登录（登录页）/ 已登录（提醒引擎 10s 轮询）两种状态数值不同，
 *    改前改后对照必须同状态，否则不可比。
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import process from 'node:process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const DESKTOP_DIR = join(REPO_ROOT, 'apps', 'desktop')
const MAIN_ENTRY = join(DESKTOP_DIR, 'out', 'main', 'index.js')
const CLK_TCK = Number(process.env.CLK_TCK || 100)
const PAGE_SIZE = 4096

const args = process.argv.slice(2)
const option = (name, fallback) => {
    const index = args.indexOf(`--${name}`)
    return index >= 0 ? args[index + 1] : fallback
}
const flag = (name) => args.includes(`--${name}`)
const SECONDS = Number(option('seconds', '60'))
const WARMUP = Number(option('warmup', '25'))
const RUNS = Number(option('runs', '1'))
const LABEL = option('label', 'unlabeled')
const KEEP_OPEN = flag('keep-open')

if (!fs.existsSync(MAIN_ENTRY)) {
    console.error(`[qa] 缺少桌面端构建产物：${MAIN_ENTRY}（先跑 pnpm run desktop:build）`)
    process.exit(2)
}

const require = createRequire(join(DESKTOP_DIR, 'package.json'))
const electronBinary = require('electron')

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms))

/** 读取进程树（root + 全部后代） */
const readTree = (rootPid) => {
    const entries = fs.readdirSync('/proc').filter((name) => /^\d+$/.test(name))
    const byParent = new Map()
    const stats = new Map()
    for (const name of entries) {
        const pid = Number(name)
        let stat
        try {
            stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8')
        } catch {
            continue
        }
        // comm 可能含空格/括号 ⇒ 从最后一个 ')' 之后切
        const tail = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
        const ppid = Number(tail[1])
        const ticks = Number(tail[11]) + Number(tail[12])
        let rssPages = 0
        try {
            rssPages = Number(fs.readFileSync(`/proc/${pid}/statm`, 'utf8').split(' ')[1])
        } catch {
            rssPages = 0
        }
        stats.set(pid, { ppid, ticks, rss: rssPages * PAGE_SIZE })
        if (!byParent.has(ppid)) byParent.set(ppid, [])
        byParent.get(ppid).push(pid)
    }
    const tree = []
    const queue = [rootPid]
    while (queue.length > 0) {
        const pid = queue.shift()
        if (!stats.has(pid)) continue
        tree.push(pid)
        queue.push(...(byParent.get(pid) ?? []))
    }
    return tree.map((pid) => ({ pid, ...stats.get(pid) }))
}

const summarize = (values) => {
    const sorted = [...values].sort((a, b) => a - b)
    const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))]
    return {
        n: sorted.length,
        min: sorted[0],
        median: at(0.5),
        p95: at(0.95),
        max: sorted[sorted.length - 1]
    }
}

const runOnce = async (runIndex) => {
    const userDataDir = fs.mkdtempSync(join(os.tmpdir(), 'nao-qa-baseline-'))
    const child = spawn(
        electronBinary,
        ['.', '--no-sandbox', '--user-data-dir', userDataDir],
        { cwd: DESKTOP_DIR, stdio: ['ignore', 'pipe', 'pipe'] }
    )
    let stderrTail = ''
    child.stderr.on('data', (chunk) => {
        stderrTail = (stderrTail + String(chunk)).slice(-2000)
    })
    child.stdout.on('data', () => undefined)

    await sleep(WARMUP * 1000)

    const cpuSeries = []
    const rssSeries = []
    let totalTicks = 0
    let totalElapsed = 0
    let previous = new Map(readTree(child.pid).map((proc) => [proc.pid, proc.ticks]))
    let previousAt = performance.now()

    for (let i = 0; i < SECONDS; i += 1) {
        await sleep(1000)
        const tree = readTree(child.pid)
        const now = performance.now()
        let deltaTicks = 0
        for (const proc of tree) {
            const before = previous.get(proc.pid)
            if (before !== undefined) deltaTicks += Math.max(0, proc.ticks - before)
        }
        const elapsedSeconds = (now - previousAt) / 1000
        cpuSeries.push((deltaTicks / CLK_TCK / elapsedSeconds) * 100)
        totalTicks += deltaTicks
        totalElapsed += elapsedSeconds
        rssSeries.push(tree.reduce((sum, proc) => sum + proc.rss, 0))
        previous = new Map(tree.map((proc) => [proc.pid, proc.ticks]))
        previousAt = now
    }

    const tree = readTree(child.pid)
    if (!KEEP_OPEN) {
        child.kill('SIGTERM')
        await sleep(1500)
        for (const proc of tree) {
            try {
                process.kill(proc.pid, 'SIGKILL')
            } catch {
                // 已退出
            }
        }
    }

    return {
        run: runIndex + 1,
        label: LABEL,
        warmedSeconds: WARMUP,
        sampledSeconds: SECONDS,
        processes: tree.length,
        cpuPercent: summarize(cpuSeries),
        /** 全窗口累计口径（分辨率不受 1s 采样限制，最适合与阈值对比） */
        cpuPercentMean: (totalTicks / CLK_TCK / totalElapsed) * 100,
        rssMb: summarize(rssSeries.map((bytes) => bytes / 1024 / 1024)),
        stderrTail: stderrTail.trim().split('\n').slice(-3).join('\n')
    }
}

const results = []
for (let i = 0; i < RUNS; i += 1) {
    results.push(await runOnce(i))
    console.log(JSON.stringify(results.at(-1), null, 2))
}
console.log(
    JSON.stringify(
        {
            label: LABEL,
            runs: results.length,
            cpuMeanAll: summarize(results.map((r) => r.cpuPercentMean)).median,
            rssMedianAll: summarize(results.map((r) => r.rssMb.median)).median
        },
        null,
        2
    )
)
