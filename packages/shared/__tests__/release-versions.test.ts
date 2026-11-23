/// <reference types="node" />
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vite-plus/test'
import {
    ASSET_FILES,
    PACKAGE_PATHS,
    runCli,
    verifyReleaseVersions
} from '../../../scripts/verify-release-versions.mjs'

/**
 * 发版三版本一致性守卫的**用例落点**（T776 / Issue #380）
 *
 * 背景：`v1.21.0` 发版时用 `grep '"version"'` 核对，误抓 root `package.json` 的
 * `devEngines.packageManager.version`（pnpm 11.18.0）⇒ 差点误判「版本没 bump」。所以判据必须
 * 建立在**顶层字段的 JSON 解析**上，用例 ④ 专门钉这一点（fixture 的嵌套字段故意与顶层不同）。
 *
 * 分工：`scripts/verify-release-versions.mjs` 是唯一事实来源（PASS/FAIL 行与退出码都由它给），
 * 本用例只用 `mkdtemp` 造 fixture 后调它的 `runCli` / `verifyReleaseVersions`，⛔ 不复制一份判断逻辑。
 *
 * ⛔ 不放 `apps/web`：该 program 里出现 `node:*` 会把 `@types/node` 全局漏进去，令无关文件的
 * `setTimeout` 推导成 `NodeJS.Timeout`、`vp check` 报 `TS2322`（PR #365 教训）。
 */

const SCRIPT = fileURLToPath(
    new URL('../../../scripts/verify-release-versions.mjs', import.meta.url)
)

/** 造过的临时目录（afterEach 统一清理，⛔ 不留在工作区） */
const tempDirs: string[] = []
afterEach(() => {
    while (tempDirs.length > 0) rmSync(String(tempDirs.pop()), { recursive: true, force: true })
})

/**
 * 写一个 package.json：**嵌套** `devEngines.packageManager.version` 刻意与顶层不同（陷阱）
 * @param {string} file
 * @param {{version: string, managerVersion?: string}} pkg
 */
const writePackage = (
    file: string,
    { version, managerVersion = '11.18.0' }: { version: string; managerVersion?: string }
) => {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(
        file,
        JSON.stringify(
            {
                name: 'fixture',
                version,
                devEngines: { packageManager: { name: 'pnpm', version: managerVersion } }
            },
            null,
            4
        ) + '\n'
    )
}

/**
 * 造一个最小「仓库根」fixture
 * @param {{root?: string, web?: string, desktop?: string, managerVersion?: string, assets?: Record<string, string>}} [options]
 *   `assets` = `{ 文件名: version }`，**只创建这里列出的文件**（缺文件由用例自行省略）
 * @returns {string} fixture 根目录
 */
const createFixture = ({
    root = '1.21.0',
    web = root,
    desktop = root,
    managerVersion = '11.18.0',
    assets
}: {
    root?: string
    web?: string
    desktop?: string
    managerVersion?: string
    assets?: Record<string, string>
} = {}) => {
    const dir = mkdtempSync(join(tmpdir(), 'nao-release-versions-'))
    tempDirs.push(dir)
    writePackage(join(dir, 'package.json'), { version: root, managerVersion })
    writePackage(join(dir, 'apps/web/package.json'), { version: web, managerVersion })
    writePackage(join(dir, 'apps/desktop/package.json'), { version: desktop, managerVersion })
    if (assets) {
        mkdirSync(join(dir, 'dist'), { recursive: true })
        for (const [name, version] of Object.entries(assets)) {
            writeFileSync(
                join(dir, 'dist', name),
                `version: ${version}\npath: fixture.zip\nsha512: abc\n`
            )
        }
    }
    return dir
}

/** 三个 latest*.yml 全在、且版本均与 `version` 相同的 assets 描述 */
const allAssets = (version: string) =>
    Object.fromEntries(ASSET_FILES.map((name) => [name, version]))

/** 跑 CLI 并收集输出（不 spawn，fixture 根目录可直接注入） */
const run = (root: string, argv: string[]) => {
    const out: string[] = []
    const err: string[] = []
    const code = runCli({
        root,
        argv,
        out: (line) => out.push(line),
        err: (line) => err.push(line)
    })
    return { code, out, err, all: [...out, ...err] }
}

describe('guard:release-versions —— 发版三版本一致性（T776）', () => {
    it('① 三处 package.json + tag + 三个 latest*.yml 全一致 ⇒ exit 0', () => {
        const dir = createFixture({ assets: allAssets('1.21.0') })
        const { code, all } = run(dir, ['v1.21.0', '--assets', 'dist'])

        expect({ code, fails: all.filter((line) => line.startsWith('FAIL')) }).toEqual({
            code: 0,
            fails: []
        })
        expect(all.filter((line) => line.startsWith('PASS'))).toHaveLength(
            PACKAGE_PATHS.length + 2 + ASSET_FILES.length
        )
        for (const name of ASSET_FILES)
            expect(all.some((line) => line.includes(`${name} version = 1.21.0`))).toBe(true)
    })

    // 变异杀手：「三者相等」判断被改成恒真时，本例（apps/web 滞后于 tag）会 exit 0 ⇒ 必红。
    it('② tag 与 package.json 不一致（apps/web 滞后）⇒ exit 1，输出点名该项', () => {
        const dir = createFixture({ root: '1.21.0', web: '1.20.0', desktop: '1.21.0' })
        const { code, all } = run(dir, ['v1.21.0'])

        expect(code).toBe(1)
        const failLine = all.find((line) => line.includes('三处 package.json 顶层 version 不一致'))
        expect(failLine?.startsWith('FAIL')).toBe(true)
        expect(failLine).toContain('apps/web/package.json=1.20.0')
        // 三者不一致时无从判定「版本是哪个」⇒ 与 tag 的比较也必须明确 FAIL（不许静默通过）
        expect(all.some((line) => line.startsWith('FAIL') && line.includes('无法判定'))).toBe(true)
    })

    it('②b 三处彼此一致但与 tag 不一致（忘了 bump 的常见形态）⇒ exit 1，点名「与 tag …不一致」并给期望值', () => {
        const dir = createFixture() // 三处均为 1.21.0
        const { code, all } = run(dir, ['v1.22.0'])

        expect(code).toBe(1)
        expect(
            all.some((line) => line.startsWith('FAIL') && line.includes('与 tag v1.22.0 一致'))
        ).toBe(true)
        expect(
            all.some((line) => line.includes('期望 1.22.0') && line.includes('实际 1.21.0'))
        ).toBe(true)
    })

    it('③ 缺 latest-mac.yml ⇒ exit 1，且说明缺的是哪个文件（⛔ 不静默跳过）', () => {
        const assets = allAssets('1.21.0')
        delete assets['latest-mac.yml']
        const dir = createFixture({ assets })
        const { code, all } = run(dir, ['v1.21.0', '--assets', 'dist'])

        expect(code).toBe(1)
        expect(
            all.some(
                (line) =>
                    line.startsWith('FAIL') && line.includes('缺少更新元数据文件：latest-mac.yml')
            )
        ).toBe(true)
        // 另外两个仍须 PASS（不许因为一个缺失就把整组判死或整体跳过）
        expect(
            all.some(
                (line) => line.startsWith('PASS') && line.includes('latest.yml version = 1.21.0')
            )
        ).toBe(true)
        expect(
            all.some(
                (line) =>
                    line.startsWith('PASS') && line.includes('latest-linux.yml version = 1.21.0')
            )
        ).toBe(true)
    })

    it('③b latest.yml 的 version 与 package.json 不同 ⇒ exit 1（自动更新错版本的直接成因）', () => {
        const dir = createFixture({ assets: { ...allAssets('1.21.0'), 'latest.yml': '1.20.0' } })
        const { code, all } = run(dir, ['v1.21.0', '--assets', 'dist'])

        expect(code).toBe(1)
        expect(
            all.some(
                (line) => line.startsWith('FAIL') && line.includes('latest.yml version = 1.20.0')
            )
        ).toBe(true)
    })

    it('④ 嵌套字段陷阱：devEngines.packageManager.version 与顶层不同 ⇒ 仍 PASS（证明不是 grep 实现）', () => {
        const dir = createFixture({ managerVersion: '11.18.0' })
        const { code, all } = run(dir, ['v1.21.0'])

        expect(code).toBe(0)
        // 陷阱是真的：嵌套里确实躺着另一个版本号，任何 grep '"version"' 都会抓到它
        expect(all.join('\n')).not.toContain('11.18.0')
        expect(
            all.some((line) => line.startsWith('PASS') && line.includes('顶层 version = 1.21.0'))
        ).toBe(true)
    })

    it('⑤ 用法错误（缺 tag）⇒ exit 2，且真实进程的 rc 一致（不注入 root，端到端）', () => {
        expect(run(createFixture(), []).code).toBe(2)
        expect(run(createFixture(), ['v1.21']).code).toBe(2) // tag 格式非法
        expect(run(createFixture(), ['v1.21.0', '--nope']).code).toBe(2) // 未知选项

        const spawned = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' })
        expect(spawned.status).toBe(2)
        expect(spawned.stderr).toContain('缺少 tag 参数')
    })

    it('⑥ 纯函数契约：verifyReleaseVersions 返回 code + 失败行（与 CLI 同源）', () => {
        const dir = createFixture({ root: '1.21.0', desktop: '2.0.0', assets: allAssets('1.21.0') })
        const result = verifyReleaseVersions({ root: dir, tag: 'v1.21.0', assets: 'dist' })

        expect(result.code).toBe(1)
        expect(result.failures.length).toBeGreaterThanOrEqual(1)
        for (const failure of result.failures) expect(result.lines).toContain(`FAIL  ${failure}`)
    })
})