/// <reference types="node" />
import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { classify, isAllowed, parseStatus, runCli } from '../../../scripts/guard-commit-scope.mjs'

/**
 * 提交范围预检（`pnpm run guard:commit-scope`）的**用例落点**（T778 / Issue #382）
 *
 * 背景：pre-commit 的 `vp staged`（lint-staged）提交时按**整棵工作树** stash 再 `--fix`，不是按
 * pathspec ⇒ 同刻别人**未暂存**的 tracked 改动会被卷进循环（`DEF-160`，2026-11-11 实测丢过一名
 * worker 的两个 `t706-*` 改动）。`scripts/guard-commit-scope.mjs` 把「提交前先看工作区干不干净」
 * 变成可执行检查，本用例钉住它的**判据分类**与**退出码**。
 *
 * 分工：判据唯一事实来源是脚本导出纯函数（`parseStatus` / `classify` / `isAllowed`）与 `runCli`，
 * 本用例只喂 porcelain 文本 fixture 后断言分类结果，⛔ 不复制一份判断逻辑。
 *
 * ⛔ 不放 `apps/web`：该 program 里出现 `node:*` 会把 `@types/node` 全局漏进去，令无关文件的
 * `setTimeout` 推导成 `NodeJS.Timeout`、`vp check` 报 `TS2322`（PR #365 教训）。
 * ⛔ 用例里的 `git` 操作一律在 `mkdtemp` 的临时仓库里做，⛔ 不碰本仓工作区（`DEF-160` 的教训）。
 */

const SCRIPT = fileURLToPath(new URL('../../../scripts/guard-commit-scope.mjs', import.meta.url))

/** 造过的临时仓库（afterEach 统一清理，⛔ 不留在工作区） */
const tempRepos: string[] = []
afterEach(() => {
    while (tempRepos.length > 0) rmSync(String(tempRepos.pop()), { recursive: true, force: true })
})

/** 打开 `--json` 前先把分类结果拍平成路径清单，断言只看路径 */
const blocked = (raw: string, allow: string[] = []): string[] =>
    classify(parseStatus(raw), allow).blockers.map((entry: { path: string }) => entry.path)
const hinted = (raw: string, allow: string[] = []): string[] =>
    classify(parseStatus(raw), allow).hints.map((entry: { path: string }) => entry.path)

/** 注入 porcelain 文本跑 CLI（纯 IO，不出仓） */
const cli = (argv: string[], status: string) => {
    const out: string[] = []
    const err: string[] = []
    const code = runCli({
        argv,
        status,
        out: (line: string) => out.push(line),
        err: (line: string) => err.push(line)
    })
    return { code, out, err, all: [...out, ...err] }
}

/** 在 cwd 跑 git（失败即用例红，避免用例在「git 没生效」的假前提下静默通过） */
const git = (cwd: string, args: string[]) => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
    expect(result.status, `git ${args.join(' ')} 失败：${result.stderr}`).toBe(0)
    return result
}

/** 造一个临时 git 仓库（含 1 个已提交的 tracked 文件，工作区干净） */
const createRepo = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 't778-commit-scope-'))
    tempRepos.push(dir)
    git(dir, ['init', '-q'])
    writeFileSync(join(dir, 'tracked.txt'), 'a\n')
    git(dir, ['add', 'tracked.txt'])
    git(dir, [
        '-c',
        'user.name=t778',
        '-c',
        'user.email=t778@example.invalid',
        '-c',
        'commit.gpgsign=false',
        'commit',
        '-qm',
        'init'
    ])
    return dir
}

/** 真实起进程跑脚本（端到端：git 调用 + 打印 + 退出码） */
const runScript = (cwd: string, argv: string[] = []) =>
    spawnSync(process.execPath, [SCRIPT, ...argv], { cwd, encoding: 'utf8' })

describe('parseStatus / classify（纯函数，porcelain 文本 fixture）', () => {
    it('① 已暂存且工作区无改动（`M  `）⇒ 不阻断', () => {
        expect(blocked('M  a.ts')).toEqual([])
        expect(hinted('M  a.ts')).toEqual([])
    })

    it('② 未暂存（` M`）⇒ 阻断', () => {
        expect(blocked(' M a.ts')).toEqual(['a.ts'])
    })

    it('③ 部分暂存（`MM`）⇒ 阻断（Y 列非空就会被钩子卷走）', () => {
        expect(blocked('MM a.ts')).toEqual(['a.ts'])
    })

    it('④ 新文件已 add 但又有未暂存改动（`AM`）⇒ 阻断', () => {
        expect(blocked('AM a.ts')).toEqual(['a.ts'])
    })

    it('⑤ 已暂存新增 / 重命名不阻断，且重命名解析出原路径', () => {
        const entries = parseStatus('A  a.ts\nR  old.ts -> new.ts')
        expect(blocked('A  a.ts\nR  old.ts -> new.ts')).toEqual([])
        expect(entries.map((entry: { path: string }) => entry.path)).toEqual(['a.ts', 'new.ts'])
        expect(entries[1].origPath).toBe('old.ts')
    })

    it('⑥ 未跟踪（`?? probe/`）⇒ 提示但不阻断', () => {
        const raw = '?? probe/'
        expect(blocked(raw)).toEqual([])
        expect(hinted(raw)).toEqual(['probe/'])
    })

    it('⑦ `--allow` 命中放行、未命中仍阻断（目录前缀匹配 + 边界）', () => {
        const raw = ' M apps/web/src/a.ts\n M packages/shared/b.ts'
        expect(blocked(raw, ['apps/web'])).toEqual(['packages/shared/b.ts'])
        expect(blocked(raw, ['apps/web', 'packages/shared/b.ts'])).toEqual([])
        // 边界：`app` 不得命中 `apps/...`（前缀必须落在路径段边界上）
        expect(blocked(raw, ['app'])).toEqual(['apps/web/src/a.ts', 'packages/shared/b.ts'])
        expect(isAllowed('apps/web/src/a.ts', ['./apps/web/'])).toBe(true)
    })

    it('⑧ 空输入 ⇒ 无阻断无提示（含只有 NUL 分隔符的情况）', () => {
        expect(blocked('')).toEqual([])
        expect(hinted('')).toEqual([])
        expect(blocked('\0')).toEqual([])
        expect(hinted('\0')).toEqual([])
    })

    it('⑨ `-z` 输出（NUL 分隔、重命名原路径为独立一段）解析正确', () => {
        const raw = 'M  a.ts\0R  new.ts\0old.ts\0 M b.ts\0?? probe/\0'
        const entries = parseStatus(raw)
        expect(entries.map((entry: { path: string }) => entry.path)).toEqual([
            'a.ts',
            'new.ts',
            'b.ts',
            'probe/'
        ])
        expect(entries[1].origPath).toBe('old.ts')
        expect(blocked(raw)).toEqual(['b.ts'])
        expect(hinted(raw)).toEqual(['probe/'])
    })

    it('⑩ 仅忽略项（`!!`）或有冲突（`UU`）的极端输入：`!!` 不阻断，`UU` 阻断', () => {
        expect(blocked('!! node_modules/')).toEqual([])
        expect(hinted('!! node_modules/')).toEqual([])
        expect(blocked('UU conflicted.ts')).toEqual(['conflicted.ts'])
    })
})

describe('runCli（注入 status，纯 IO）', () => {
    it('⑪ 有阻断 ⇒ rc=1，stderr 逐条点名（列表而非表格）+ 给处置建议', () => {
        const { code, err, out } = cli([], 'MM packages/shared/a.ts\n M scripts/b.mjs')
        expect(code).toBe(1)
        expect(out.some((line) => line.includes('OK'))).toBe(false)
        expect(err).toContain('  - MM packages/shared/a.ts')
        expect(err).toContain('  -  M scripts/b.mjs')
        expect(err.some((line) => line.includes('git stash push'))).toBe(true)
    })

    it('⑫ `--json` 输出机器可读载荷，rc 与阻断项一致', () => {
        const payload = JSON.parse(cli(['--json'], ' M a.ts\n?? probe/').out.join('\n'))
        expect(payload.code).toBe(1)
        expect(payload.blockers.map((entry: { path: string }) => entry.path)).toEqual(['a.ts'])
        expect(payload.hints.map((entry: { path: string }) => entry.path)).toEqual(['probe/'])
        expect(JSON.parse(cli(['--json'], 'M  a.ts').out.join('\n')).code).toBe(0)
    })

    it('⑬ `--allow` 走 CLI 同样生效（命中 ⇒ rc=0，未命中 ⇒ rc=1）', () => {
        expect(cli(['--allow', 'a.ts'], ' M a.ts').code).toBe(0)
        expect(cli(['--allow', 'src', 'docs'], ' M src/a.ts\n M b.ts').code).toBe(1)
        expect(cli(['--allow=src'], ' M src/a.ts').code).toBe(0)
    })

    it('⑭ 用法错误 ⇒ rc=2（未知选项 / `--allow` 缺值 / 多余参数）；`--help` ⇒ rc=0', () => {
        for (const argv of [['--nope'], ['--allow'], ['a.ts']]) {
            const { code, err } = cli(argv, '')
            expect(code, `argv=${JSON.stringify(argv)}`).toBe(2)
            expect(err[0]).toContain('用法：')
        }
        const help = cli(['--help'], '')
        expect(help.code).toBe(0)
        expect(help.out[0]).toContain('guard-commit-scope')
    })
})

describe('CLI 端到端（spawnSync + 真实 git 仓库，均在 /tmp）', () => {
    it('⑮ 干净仓库 ⇒ rc=0', () => {
        const dir = createRepo()
        const result = runScript(dir)
        expect(result.status).toBe(0)
        expect(result.stdout).toContain('OK - 无阻断项')
    })

    it('⑯ tracked 文件有未暂存改动 ⇒ rc=1 且点名；`--allow` 该文件后 rc=0', () => {
        const dir = createRepo()
        appendFileSync(join(dir, 'tracked.txt'), 'b\n')

        const blockedResult = runScript(dir)
        expect(blockedResult.status).toBe(1)
        expect(blockedResult.stderr).toContain('  -  M tracked.txt')

        expect(runScript(dir, ['--allow', 'tracked.txt']).status).toBe(0)
        // 范围不匹配时仍须阻断（⛔ 不能因为给了 --allow 就整体放行）
        expect(runScript(dir, ['--allow', 'other']).status).toBe(1)
    })

    it('⑰ 未跟踪文件 ⇒ rc=0 + 提示（`git stash create` 不含它，故不阻断）', () => {
        const dir = createRepo()
        writeFileSync(join(dir, '.tmp-probe.txt'), 'x\n')

        const result = runScript(dir)
        expect(result.status).toBe(0)
        expect(result.stdout).toContain('  - ?? .tmp-probe.txt')
        expect(result.stdout).toContain('OK - 无阻断项（另有 1 条未跟踪提示）')
    })

    it('⑱ 用法错误（未知选项）⇒ rc=2，真实进程退出码一致', () => {
        const result = runScript(createRepo(), ['--nope'])
        expect(result.status).toBe(2)
        expect(result.stderr).toContain('未知选项：--nope')
    })
})