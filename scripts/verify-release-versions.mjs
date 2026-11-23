/**
 * 发版三版本一致性校验（tag · 三处 package.json · electron-builder 的 latest*.yml）
 * @description 发版时三处版本必须同一，否则自动更新出错：electron-updater 按 `latest*.yml` 的
 * `version` 判断是否有新版 ⇒ 与 `package.json` / git tag 不一致时会出现「提示有新版本但装到旧包」
 * 或「永远收不到更新」。
 *
 * 背景（真实踩过的坑，T776 / Issue #380）：`v1.21.0` 发版时用 `grep '"version"'` 核对，**误抓了
 * root `package.json` 里 `devEngines.packageManager.version`（pnpm 版本 11.18.0）**，差点误判
 * 「版本没 bump」。⇒ 本文件**一律 `JSON.parse` 后只取顶层 `version`**，⛔ 不 grep 字符串、⛔ 不读
 * `devEngines` 等嵌套字段（`packages/shared/__tests__/release-versions.test.ts` ④ 用例专钉这一点：
 * fixture 的嵌套字段故意与顶层不同，仍须 PASS）。
 *
 * 校验项（逐条给 PASS / FAIL 行）：
 *  1. root / `apps/web` / `apps/desktop` 的**顶层** `version` 三者相等；
 *  2. 三者相同的那个值与 tag 去 `v` 前缀后相等（三者不一致时无法判定，按 FAIL 报）；
 *  3. 给了 `--assets <dir>` 时：该目录下 `latest.yml` / `latest-mac.yml` / `latest-linux.yml`
 *     的 `version` 也须与之相等；**任一文件缺失或解析不出 ⇒ 明确报错**（⛔ 不静默跳过）。
 *
 * 用法：`node scripts/verify-release-versions.mjs v1.21.0 [--assets <dir>]`
 * （`--assets` 相对路径按**仓库根**解析，例如 `--assets apps/desktop/release`）
 * 退出码：`0` 全过 / `1` 有不一致或缺失 / `2` 用法错误（缺 tag / tag 格式非法 / 未知选项）。
 * 用途：`pnpm run guard:release-versions`（本地发版前后手动跑；**尚未接 CI**，见 T776 遗留项）。
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/** 必须保持一致的三处 package.json（相对仓库根，顺序即输出顺序） */
export const PACKAGE_PATHS = ['package.json', 'apps/web/package.json', 'apps/desktop/package.json']

/** electron-builder 生成的更新元数据（`--assets` 目录内必须三个都在） */
export const ASSET_FILES = ['latest.yml', 'latest-mac.yml', 'latest-linux.yml']

/** 仓库根（本文件位于 `<root>/scripts/`） */
export const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))

/**
 * 读 `package.json` 的**顶层** `version`（JSON 解析，⛔ 不 grep —— grep 会抓到 `devEngines` 里的 pnpm 版本）
 * @param {string} file
 * @returns {string}
 */
export const readTopLevelVersion = (file) => {
    const pkg = JSON.parse(readFileSync(file, 'utf8'))
    if (typeof pkg?.version !== 'string' || pkg.version === '') {
        throw new Error('缺少顶层 version 字段')
    }
    return pkg.version
}

/**
 * 读 `latest*.yml` 的顶层 `version` 行（零依赖：electron-builder 把 `version` 写在列 0）
 * @param {string} file
 * @returns {string}
 */
export const readAssetVersion = (file) => {
    const match = /^version:[ \t]*(\S+)[ \t]*$/m.exec(readFileSync(file, 'utf8'))
    if (!match) throw new Error('找不到顶层 version 行')
    return match[1].replace(/^["']|["']$/g, '')
}

/**
 * `--assets` 目录内的三个文件名 → 绝对路径 + 是否存在（缺哪个由调用方点名，⛔ 不做隐式回退）
 * @param {string} dir
 * @returns {{name: string, file: string, exists: boolean}[]}
 */
const listAssets = (dir) =>
    ASSET_FILES.map((name) => ({ name, file: join(dir, name), exists: existsSync(join(dir, name)) }))

/**
 * 校验并返回结果（纯函数，便于单测注入 fixture 根目录）
 * @param {{root: string, tag: string, assets?: string}} options
 * @returns {{code: number, lines: string[], failures: string[]}}
 */
export const verifyReleaseVersions = ({ root, tag, assets }) => {
    /** @type {string[]} */
    const lines = []
    /** @type {string[]} */
    const failures = []
    /**
     * @param {boolean} ok
     * @param {string} text
     */
    const add = (ok, text) => {
        lines.push(`${ok ? 'PASS' : 'FAIL'}  ${text}`)
        if (!ok) failures.push(text)
    }

    const expected = tag.replace(/^v/, '')

    // ① 三处 package.json：只看顶层 version（JSON.parse）
    /** @type {Map<string, string>} */
    const versions = new Map()
    for (const rel of PACKAGE_PATHS) {
        const file = join(root, rel)
        if (!existsSync(file)) {
            add(false, `${rel}：文件不存在（无法读取顶层 version）`)
            continue
        }
        try {
            const version = readTopLevelVersion(file)
            versions.set(rel, version)
            add(true, `${rel} 顶层 version = ${version}`)
        } catch (error) {
            add(false, `${rel}：解析失败（${/** @type {Error} */ (error).message}）`)
        }
    }

    // ② 三者相等（不一致时无从判定「版本是哪个」，故 ③ 也随之 FAIL）
    const distinct = [...new Set(versions.values())]
    const agreed = versions.size === PACKAGE_PATHS.length && distinct.length === 1
    add(
        agreed,
        agreed
            ? `三处 package.json 顶层 version 一致 = ${distinct[0]}`
            : `三处 package.json 顶层 version 不一致：${PACKAGE_PATHS.map(
                  (rel) => `${rel}=${versions.get(rel) ?? '（不可读）'}`
              ).join(' / ')}`
    )

    // ③ 与 tag（去 v 前缀）相等
    const expectedLine = `与 tag ${tag} 一致（期望 ${expected}）`
    if (!agreed) {
        add(false, `${expectedLine}：三处 package.json 版本不一致，无法判定`)
    } else {
        add(distinct[0] === expected, `${expectedLine}${distinct[0] === expected ? '' : `，实际 ${distinct[0]}`}`)
    }

    // ④ latest*.yml（仅在给了 --assets 时校验；缺文件必须报错，⛔ 不静默跳过）
    if (assets) {
        const assetsDir = resolve(root, assets)
        if (!existsSync(assetsDir)) add(false, `--assets 目录不存在：${assets}`)
        for (const { name, file, exists } of listAssets(assetsDir)) {
            if (!exists) {
                add(false, `缺少更新元数据文件：${name}（--assets 内必须齐全：${ASSET_FILES.join(' / ')}）`)
                continue
            }
            try {
                const version = readAssetVersion(file)
                add(
                    version === expected,
                    `${name} version = ${version}${version === expected ? '' : `（期望 ${expected}）`}`
                )
            } catch (error) {
                add(false, `${name}：解析失败（${/** @type {Error} */ (error).message}）`)
            }
        }
    }

    return { code: failures.length === 0 ? 0 : 1, lines, failures }
}

/** 用法说明（退出码 2 时打印） */
const USAGE = '用法：node scripts/verify-release-versions.mjs <tag> [--assets <dir>]（tag 形如 v1.21.0）'

/**
 * 命令行入口（stderr/stdout 可注入，便于单测断言输出）
 * @param {{argv?: string[], root?: string, out?: (line: string) => void, err?: (line: string) => void}} [options]
 * @returns {number} 退出码
 */
export const runCli = ({ argv = process.argv.slice(2), root = ROOT, out = console.log, err = console.error } = {}) => {
    /** @type {string | undefined} */
    let tag
    /** @type {string | undefined} */
    let assets
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i]
        if (arg === '--assets') {
            assets = argv[i + 1]
            i += 1
            if (!assets || assets.startsWith('-')) {
                err(`${USAGE}\n--assets 需要一个目录参数`)
                return 2
            }
        } else if (arg.startsWith('--assets=')) {
            assets = arg.slice('--assets='.length)
            if (!assets) {
                err(`${USAGE}\n--assets 需要一个目录参数`)
                return 2
            }
        } else if (arg.startsWith('-')) {
            err(`${USAGE}\n未知选项：${arg}`)
            return 2
        } else if (tag === undefined) {
            tag = arg
        } else {
            err(`${USAGE}\n多余参数：${arg}`)
            return 2
        }
    }
    if (!tag) {
        err(`${USAGE}\n缺少 tag 参数`)
        return 2
    }
    if (!/^v?\d+\.\d+\.\d+$/.test(tag)) {
        err(`${USAGE}\ntag 格式非法：${tag}`)
        return 2
    }

    const { code, lines } = verifyReleaseVersions({ root, tag, assets })
    lines.forEach((line) => (line.startsWith('FAIL') ? err(line) : out(line)))
    out(`[verify-release-versions] ${code === 0 ? 'OK' : `FAIL（${lines.filter((l) => l.startsWith('FAIL')).length} 项不一致或缺失）`}`)
    return code
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exit(runCli())
}
