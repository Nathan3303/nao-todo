/**
 * 依赖审计守卫（`Issue #388` 批次三 / T789）
 * @description 批次三用 `pnpm-workspace.yaml` 的 `overrides` 把 dev 面 advisory 压到 10 条
 * （70 → 10，critical 3 → 0）。但 override 是**双刃**：
 *  - `overrides` 的键是**版本（或版本区间）**，pnpm 用 `isIntersectingRange(键, 依赖方声明的范围)` 匹配
 *    ⇒ 一旦上游某个包的声明范围变了（例如 node-gyp 从 `^6.25.0` 抬到 `^6.30.0`），`undici@6.28.0`
 *    这条 exact-key **静默失配**，解析退回带漏洞的版本，而 `pnpm install` 依旧 rc=0、`vp test` 依旧全绿。
 *  - 反过来，上游跟进修好后 override 会变成**多余的版本钉死**，长期把包压在旧版本上。
 * 两者都**没有任何现有门禁能发现**（`vp check` / `vp test` / 七个守卫都不看 advisory）。
 * ⇒ 本脚本把「审计结果没退化」变成可执行检查：发版前 / 批末跑一次。
 *
 * 判据（读 `pnpm audit --json` 的 `metadata.vulnerabilities`）：
 *  - **critical 必须为 0**（硬性：任何一条都 exit 1）。
 *  - **advisory 总数 ≤ `MAX_TOTAL`**（阈值见下方常数；当前 10 条均由 `vite-plus` / `vitest` 系
 *    与 `glob` / `minimatch` 贡献，属「本批明令不动」的范围，留 2 条余量）。
 *  - 超阈值或出现 critical ⇒ exit 1，并打印**按包名归并**的剩余条目，便于定位是谁退化了。
 *
 * 用法：`node scripts/guard-audit.mjs`（= `pnpm run guard:audit`）
 * 退出码：`0` 通过 / `1` 判据不满足（critical > 0 或总数 > 阈值）/ `2` 环境错误（pnpm 不可用 / 输出非 JSON）
 * 用途：`pnpm run guard:audit`（发版前、批末、以及**改动 `overrides` 前后各跑一次**）。
 * 幂等：只读（spawn `pnpm audit`），不改任何文件。
 */
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/**
 * advisory 总数阈值（含 critical/high/moderate/low）。
 * 当前实测 10（见 `docs/reports/2026-11-23-dep-audit-batch1.md` §批次三），留 2 条余量。
 * ⛔ 上调前先确认新增条目**确实不在本批可修范围**（需另立单），否则等于放宽门禁。
 */
export const MAX_TOTAL = 12

/** 收集 `pnpm audit --json` 的输出（stdout 被 `--json` 独占，stderr 只做诊断） */
const runAudit = () => {
    const res = spawnSync('pnpm', ['audit', '--json'], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        shell: false
    })
    if (res.error) return { ok: false, reason: `无法执行 pnpm audit：${res.error.message}` }
    const stdout = String(res.stdout ?? '')
    if (stdout.trim() === '') {
        const err = String(res.stderr ?? '').trim().split('\n').slice(-3).join(' / ')
        return { ok: false, reason: `pnpm audit 无输出（rc=${res.status}）${err ? `：${err}` : ''}` }
    }
    // `pnpm audit --json` 的 JSON 独占 stdout；防御性截取首个 `{` 到末个 `}`（pnpm 版本间偶有前置提示）
    const from = stdout.indexOf('{')
    const to = stdout.lastIndexOf('}')
    if (from === -1 || to <= from) return { ok: false, reason: 'pnpm audit 输出不含 JSON 对象' }
    try {
        return { ok: true, report: JSON.parse(stdout.slice(from, to + 1)) }
    } catch (e) {
        return { ok: false, reason: `pnpm audit 输出非合法 JSON：${e.message}` }
    }
}

/**
 * 归并 advisories 为「包名 → 条目数」的降序列表（只用于打印定位，不参与判据）
 * @param {Record<string, { module_name?: string }> | undefined} advisories
 * @returns {{ module: string, count: number }[]}
 */
export const summarize = (advisories) => {
    /** @type {Map<string, number>} */
    const counts = new Map()
    for (const adv of Object.values(advisories ?? {})) {
        const name = adv?.module_name ?? '(unknown)'
        counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return [...counts.entries()]
        .map(([module, count]) => ({ module, count }))
        .sort((a, b) => b.count - a.count || a.module.localeCompare(b.module))
}

/**
 * 纯函数判据：给 `metadata.vulnerabilities`，返回失败原因列表（空数组 = 通过）
 * @param {{ critical?: number, high?: number, moderate?: number, low?: number, info?: number } | undefined} vulns
 * @param {number} [maxTotal]
 * @returns {string[]}
 */
export const check = (vulns, maxTotal = MAX_TOTAL) => {
    const v = vulns ?? {}
    const critical = Number(v.critical ?? 0)
    const total = ['info', 'low', 'moderate', 'high', 'critical'].reduce(
        (sum, k) => sum + Number(v[k] ?? 0),
        0
    )
    /** @type {string[]} */
    const failures = []
    if (critical > 0) failures.push(`critical advisory ${critical} 条（要求 0）`)
    if (total > maxTotal) failures.push(`advisory 总数 ${total} > 阈值 ${maxTotal}`)
    return failures
}

/** CLI 入口 */
const main = () => {
    const audit = runAudit()
    if (!audit.ok) {
        console.error(`[guard:audit] ${audit.reason}`)
        process.exit(2)
    }
    const { report } = audit
    const vulns = report?.metadata?.vulnerabilities ?? {}
    const total = ['info', 'low', 'moderate', 'high', 'critical'].reduce(
        (sum, k) => sum + Number(vulns[k] ?? 0),
        0
    )
    const failures = check(vulns)
    const breakdown = summarize(report?.advisories)
        .map(({ module, count }) => `${module}×${count}`)
        .join(' · ')
    console.log(
        `[guard:audit] advisory 总数 ${total}（阈值 ${MAX_TOTAL}）· critical ${vulns.critical ?? 0}` +
            ` · high ${vulns.high ?? 0} · moderate ${vulns.moderate ?? 0} · low ${vulns.low ?? 0}`
    )
    if (breakdown) console.log(`[guard:audit] 剩余按包归并：${breakdown}`)
    if (failures.length > 0) {
        for (const f of failures) console.error(`[guard:audit] 未通过：${f}`)
        console.error(
            '[guard:audit] 排查方向：① overrides 的 exact-key 是否失配（依赖方声明范围变了 ⇒ 键不再命中）' +
                ' ② 是否有新 advisory 落到未覆盖的包'
        )
        process.exit(1)
    }
    console.log('[guard:audit] OK')
}

// 仅在被直接执行时跑 CLI（便于日后单测直接 import 纯函数）
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
