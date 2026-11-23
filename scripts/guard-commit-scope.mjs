/**
 * 提交范围预检（`DEF-160` 的可执行防线）
 * @description pre-commit 钩子 `vp staged`（lint-staged）提交时按**整棵工作树** `git stash` →
 * `vp check --fix` → 恢复，**不是按 pathspec**。同刻其他人（或其他 worker）**未暂存**的 tracked 改动
 * 会被卷进这个循环，恢复阶段可能回不来 —— 2026-11-11 实测丢过一名 worker 的两个 `t706-*` 改动，
 * 仓内至今留 2 条 `lint-staged automatic backup` stash。现有规避只写在 `AGENTS.md`（「共用工作区
 * 提交纪律」）里靠人记 ⇒ 本脚本把它变成可执行检查。
 *
 * 判据（读 `git status --porcelain=v1 -z`，解析/分类抽成导出纯函数，CLI 只做 IO 与打印）：
 *  - **阻断项**（exit 1）：tracked 且**工作区有未暂存改动**的条目 —— Y 列非空（` M` / `MM` / `AM` /
 *    ` D` / `UU` …）。它们会被钩子 stash 卷走。
 *  - **提示项**（不阻断，仍 exit 0）：`??` 未跟踪文件 —— `git stash create` 默认**不含**它们，
 *    但常是跑完没删的游离探针，提示清理。
 *  - 已暂存且工作区无改动（`M  ` / `A  ` / `R  old -> new`）与 `--allow` 命中项一律不阻断。
 *
 * 用法：`node scripts/guard-commit-scope.mjs [--allow <pathspec...>] [--json]`
 *  - `--allow <pathspec...>`：本次提交范围内的路径（可重复、可多个），**仓库根相对、按目录前缀匹配**
 *    （`apps/web` 命中 `apps/web/src/a.ts`；`app` **不**命中 `apps/...`），命中则从阻断项/提示项剔除。
 *  - `--json`：机器可读输出（`{ code, blockers, hints, allow }`）。
 * 退出码：`0` 无阻断项（可能有提示）/ `1` 有阻断项 / `2` 用法错误（未知选项 / 多余参数 / git 不可用）。
 * 用途：`pnpm run guard:commit-scope`（提交前手动跑；**尚未接 CI、也不装 git hook**，见 T778）。
 */
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/** 未跟踪条目的 XY 码 */
const UNTRACKED = '??'

/** `git status` 参数：porcelain v1 + `-z`（路径不转义，含空格/引号也能正确解析） */
export const STATUS_ARGS = ['status', '--porcelain=v1', '-z', '--untracked-files=normal']

/**
 * `git status --porcelain` 的一条条目（`x`/`y` = 两列状态码，`path` = 仓库根相对路径）
 * @typedef {{ code: string, x: string, y: string, path: string, origPath?: string }} StatusEntry
 */

/**
 * 解析 `git status --porcelain` 输出为条目列表
 * @param {string} raw `git status --porcelain=v1 -z` 的原样输出；也接受**换行分隔**的同格式文本（便于用例喂 fixture）
 * @returns {StatusEntry[]}
 */
export const parseStatus = (raw) => {
    const text = String(raw ?? '')
    // `-z`：条目以 NUL 分隔，重命名/复制的**原路径**是紧随其后的另一个 NUL 段
    // 非 `-z`（fixture / 手工粘贴）：条目按行分隔，重命名写成 `旧路径 -> 新路径`
    const chunks = text.includes('\0') ? text.split('\0') : text.split(/\r?\n/)
    /** @type {StatusEntry[]} */
    const entries = []
    for (let i = 0; i < chunks.length; i += 1) {
        const chunk = chunks[i]
        // 合法条目至少 `XY p`（3 字符）；空段来自结尾分隔符
        if (chunk.length < 3) continue
        const x = chunk.slice(0, 1)
        const y = chunk.slice(1, 2)
        let path = chunk.slice(3)
        /** @type {string | undefined} */
        let origPath
        const arrow = path.indexOf(' -> ')
        if (arrow !== -1) {
            origPath = path.slice(0, arrow)
            path = path.slice(arrow + 4)
        } else if (x === 'R' || x === 'C') {
            const next = chunks[i + 1]
            if (next) {
                origPath = next
                i += 1
            }
        }
        entries.push({ code: `${x}${y}`, x, y, path, origPath })
    }
    return entries
}

/**
 * 是否「tracked 且有未暂存改动」（Y 列非空 ⇒ 钩子的整树 stash 会卷走它）
 * @param {StatusEntry} entry
 * @returns {boolean}
 */
export const hasUnstagedChange = (entry) =>
    entry.x !== '?' && entry.x !== '!' && entry.y !== ' ' && entry.y !== ''

/** 归一化路径（去 `./` 前缀与结尾 `/`，让 `probe/` 与 `probe` 等价） */
const normalizePath = (path) => String(path).replace(/^\.\//, '').replace(/\/+$/, '')

/**
 * 该路径是否落在本次提交范围内（仓库根相对、按目录前缀匹配）
 * @param {string} path
 * @param {string[]} [allow]
 * @returns {boolean}
 */
export const isAllowed = (path, allow = []) => {
    const target = normalizePath(path)
    return allow.some((spec) => {
        const scope = normalizePath(spec)
        // `--allow .`（或空）＝ 显式声明「整仓都是我的范围」
        if (scope === '' || scope === '.') return true
        return target === scope || target.startsWith(`${scope}/`)
    })
}

/**
 * 解析结果分类：阻断项（未暂存）/ 提示项（未跟踪），`--allow` 命中者剔除
 * @param {StatusEntry[]} entries
 * @param {string[]} [allow]
 * @returns {{ blockers: StatusEntry[], hints: StatusEntry[] }}
 */
export const classify = (entries, allow = []) => {
    /** @type {StatusEntry[]} */
    const blockers = []
    /** @type {StatusEntry[]} */
    const hints = []
    for (const entry of entries) {
        if (isAllowed(entry.path, allow)) continue
        if (entry.code === UNTRACKED) hints.push(entry)
        else if (hasUnstagedChange(entry)) blockers.push(entry)
    }
    return { blockers, hints }
}

/**
 * 读当前工作区的 porcelain 状态
 * @param {{ cwd?: string }} [options]
 * @returns {string}
 */
export const readStatus = ({ cwd = process.cwd() } = {}) => {
    const result = spawnSync('git', STATUS_ARGS, {
        cwd,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
    })
    if (result.error) throw new Error(`无法执行 git（${result.error.message}）`)
    if (result.status !== 0) {
        throw new Error(`git status 失败（rc=${result.status}）：${String(result.stderr ?? '').trim()}`)
    }
    return String(result.stdout ?? '')
}

/** 用法说明（退出码 2 时打印） */
export const USAGE = `用法：node scripts/guard-commit-scope.mjs [--allow <pathspec...>] [--json]
  --allow <pathspec...>  本次提交范围内的路径（可重复；仓库根相对，按目录前缀匹配）
  --json                 机器可读输出（{ code, blockers, hints, allow }）
退出码：0 无阻断项 / 1 有 tracked 未暂存改动（会被 vp staged 卷走） / 2 用法错误`

/**
 * 命令行入口（stdout/stderr 与 git 状态均可注入，便于单测断言）
 * @param {{ argv?: string[], cwd?: string, out?: (line: string) => void, err?: (line: string) => void, status?: string }} [options]
 * @returns {number} 退出码
 */
export const runCli = ({
    argv = process.argv.slice(2),
    cwd = process.cwd(),
    out = console.log,
    err = console.error,
    status
} = {}) => {
    let json = false
    /** @type {string[]} */
    const allow = []
    const usageError = (message) => {
        err(`${USAGE}\n${message}`)
        return 2
    }

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i]
        if (arg === '-h' || arg === '--help') {
            out(USAGE)
            return 0
        }
        if (arg === '--json') {
            json = true
            continue
        }
        if (arg === '--allow' || arg.startsWith('--allow=')) {
            const inline = arg === '--allow' ? '' : arg.slice('--allow='.length)
            if (inline) allow.push(...inline.split(',').filter((item) => item !== ''))
            else {
                const before = allow.length
                while (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
                    allow.push(argv[i + 1])
                    i += 1
                }
                if (allow.length === before) return usageError('--allow 需要至少一个 pathspec 参数')
            }
            continue
        }
        if (arg.startsWith('-')) return usageError(`未知选项：${arg}`)
        return usageError(`多余参数：${arg}（路径请用 --allow 传入）`)
    }

    /** @type {string} */
    let raw
    try {
        raw = status ?? readStatus({ cwd })
    } catch (error) {
        return usageError(/** @type {Error} */ (error).message)
    }

    const { blockers, hints } = classify(parseStatus(raw), allow)
    const code = blockers.length === 0 ? 0 : 1

    if (json) {
        out(JSON.stringify({ code, blockers, hints, allow }, null, 4))
        return code
    }

    const render = (entry) =>
        `${entry.x}${entry.y} ${entry.path}${entry.origPath ? `（原 ${entry.origPath}）` : ''}`
    if (blockers.length > 0) {
        err(
            '[guard:commit-scope] 阻断：以下 tracked 改动尚未暂存 —— `vp staged` 提交时按整棵树 stash，会把它们卷进去（DEF-160）：'
        )
        blockers.forEach((entry) => err(`  - ${render(entry)}`))
        err(
            '处置建议：等该文件的 owner 提交完成后再提交；或先 `git stash push -m "<编号>: 暂存" -- <路径>`（恢复后记得 `git stash pop`）'
        )
    }
    if (hints.length > 0) {
        out(
            '[guard:commit-scope] 提示：以下未跟踪文件不在 `git stash create` 范围内（常为游离探针），建议清理：'
        )
        hints.forEach((entry) => out(`  - ${render(entry)}`))
    }
    if (code === 0) {
        out(
            `[guard:commit-scope] OK - 无阻断项${
                hints.length > 0 ? `（另有 ${hints.length} 条未跟踪提示）` : ''
            }`
        )
    }
    return code
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exit(runCli())
}
