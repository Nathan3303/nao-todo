/// <reference types="node" />
// ↑ 结构性断言用 `node:fs` / `node:path` / `import.meta.url`：显式与 node 类型关联
//   （同 `packages/shared/reminder/__tests__/t525-ac10-single-implementation.test.ts` 口径）。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'

/**
 * T589 红基线 —— AC1 单一判据 / 唯一执行点（**测试内源码扫描**，PM 裁定：不改 `package.json` / 构建配置）
 *
 * 来源：ADR D1「事件上提模块级单例 + 执行单点 `apps/web/src/session-end.ts`」
 *       · 判据 `docs/reports/T588-credential-coherence-cases.md` AC1/AC6
 *       · PM 裁定 ⑦「`guard:auth-seam` 改为测试内源码扫描（≈0.1s）」
 *
 * 判据（扫描非测试源码）：
 * - **R1 执行单点存在且完整**：`apps/web/src/session-end.ts` 存在，且同时含清理矩阵的原语
 *   `revokeOfflineEntry(` / `clearAuthData(` / `localSession.clear(` / `cryptoService.lock(` /
 *   `resetTokenRotation(`。
 * - **R2 清理原语只出现在白名单文件**：`localSession.clear(` / `cryptoService.lock(` /
 *   `resetTokenRotation(` 的文件名 ∈ {`session-end.ts`, `use-settings-sign-out.ts`,
 *   `sign-out-broadcast.ts`, `unlock-gate.vue`, `binding.ts`}（ADR D2 清理矩阵白名单）。
 * - **R3 请求层 / 同步层零清理**：`packages/shared/requester/**` 与
 *   `packages/infrastructure/src/persistence-sync/**` 不得出现任何清理原语
 *   （`clearAuthData` / `localSession.clear(` / `cryptoService.lock(` / `revokeOfflineEntry(` /
 *   `wipeUserData` / `wipeLocalDataOnSignOut`）—— 它们只能发布事件，不能自己清理。
 * - **R4 `Bearer null` 源头收口**：`persistence-sync/**` 不得用 `Bearer ${` 模板拼接
 *   （DEF-93；`getJWTFromLocalStorage()` 可为 `null` ⇒ `Bearer null`）。
 * - **R5 装配面不再直接清认证**：`apps/web/src/app.ts` 与 `apps/desktop/src/renderer/src/main.ts`
 *   不得含 `.clearAuthData(`，且必须引用单点（`session-end` 或 `auth-expiry`）。
 *
 * 扫描范围排除：`node_modules` / `dist` / `out` / `.git` / `.codegraph` / `coverage` /
 * `__tests__` / `*.test.*` / `*.spec.*`，以及**移动端红线** `apps/mobile` / `packages/presentation-react`
 * （R6/AC10：零改动，不参与本批判据）。
 *
 * 状态：**红**（`session-end.ts` 未创建；`AppRoot.vue` 仍自行清理；sync 仍拼 `Bearer null`）。
 * 假阳性风险：① 注释里提到原语名会被计入 ⇒ 规则只匹配**调用形态**（`xxx(` / `.xxx(`），
 * 且白名单按文件名匹配；② 新增合法登出入口需登记白名单（本文件 `ALLOWED_CLEANUP_FILES`）；
 * ③ `Bearer ${` 只扫 `persistence-sync`（`lynx.ts` 的必填 token 拼接不在本批范围）。
 */

const REPO_ROOT = (() => {
    let dir = dirname(new URL(import.meta.url).pathname)
    for (let i = 0; i < 8; i += 1) {
        if (existsSync(join(dir, 'apps/web/src')) && existsSync(join(dir, 'packages'))) return dir
        dir = dirname(dir)
    }
    throw new Error('无法定位仓库根（期望存在 apps/web/src 与 packages）')
})()

const SCAN_ROOTS = ['apps/web/src', 'apps/desktop/src', 'packages']
const SKIP_DIRS = new Set([
    'node_modules',
    'dist',
    'out',
    '__tests__',
    '.git',
    '.codegraph',
    'coverage',
    '.pi'
])
const SKIP_PATHS = ['apps/mobile', 'packages/presentation-react']
const SOURCE_EXT = ['.ts', '.vue']

const ALLOWED_CLEANUP_FILES = new Set([
    'session-end.ts',
    'use-settings-sign-out.ts',
    'sign-out-broadcast.ts',
    'unlock-gate.vue',
    'binding.ts'
])

/**
 * 棘轮（ratchet）冻结值 —— **新增一处即红；清理一处须同步下调本常量**
 * @description 本批（T597 / `DEF-117`）已完成两处债务清偿 ⇒ 常量同步下调：
 *              - `Bearer` 拼接收口（DEF-93）：`persistence-go/**` 61 处 ⇒ **0 处**（全改走
 *                `persistence-go/utils.ts` 的 `authHeaders()` → `buildAuthHeaders`）；`shared/requester/lynx.ts`
 *                保留 1 处（Lynx 运行时 token 必填，ADR D6 已登记边界，归零需**移动端授权**）；
 *              - 凭证判据字面量（AC1/R1）：`=== 10041` 类比较 5 处 ⇒ **0 处**
 *                （`preference-sync.ts` ×4 改 `isCredentialCode`、`lynx.ts` ×1 同改）。
 *              双向锁的理由：只锁「不变多」会让「清理后常量仍停在旧值 ⇒ 又能偷偷加回来」；
 *              只锁「不变少」则无法防新增。故断言**恰等于**冻结值。
 */
const KNOWN_BEARER_CONCAT_SITES = {
    /** `persistence-go/**`：内联 `Bearer ${…}`（T597 已清零，应为 0） */
    'persistence-go': 0,
    /** `shared/requester/lynx.ts`：Lynx token 必填参数（ADR D6 边界，归零需移动端授权） */
    'shared/requester/lynx.ts': 1
} as const

/** `shared/requester` 内允许出现 `Bearer ${` 的文件（唯一实现处 + Lynx 例外） */
const BEARER_CONCAT_ALLOWED_FILES = new Set(['auth-headers.ts', 'lynx.ts'])

/**
 * 凭证码**比较**字面量冻结值（剔除注释行；T597 / `DEF-117` 已清零）
 * @description 原 5 处（`preference-sync.ts` 387/419/452/539、`lynx.ts:109`）已全部改走
 *              `isCredentialCode`（唯一集合 `credential-codes.ts`）⇒ 冻结值 = **0**，新增即红。
 *              判据正则（T599）已从 `10041` 扩为 `1004[12]`（同族两个码都算比较字面量）。
 *              不计入本计数的 `10041` 用法（均非判据）：`credential-codes.ts`（唯一集合定义）、
 *              `error-classification.ts` 的 r12 集合（ADR「语义逐字不变」）、`axios.ts` 2 处日志文案。
 */
const KNOWN_CREDENTIAL_LITERAL_COMPARISONS = 0

type SourceFile = { path: string; text: string }

const isSkippedPath = (path: string): boolean =>
    SKIP_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))

const walk = (absDir: string, out: string[]): void => {
    for (const entry of readdirSync(absDir)) {
        const abs = join(absDir, entry)
        const rel = relative(REPO_ROOT, abs)
        if (isSkippedPath(rel)) continue
        const stat = statSync(abs)
        if (stat.isDirectory()) {
            if (SKIP_DIRS.has(entry)) continue
            walk(abs, out)
            continue
        }
        if (!SOURCE_EXT.some((ext) => entry.endsWith(ext))) continue
        if (/\.(test|spec)\.[^.]+$/.test(entry)) continue
        if (entry.endsWith('.d.ts')) continue
        out.push(abs)
    }
}

const readSources = (roots: string[]): SourceFile[] => {
    const paths: string[] = []
    for (const root of roots) {
        const abs = join(REPO_ROOT, root)
        if (!existsSync(abs)) continue
        const stat = statSync(abs)
        if (stat.isDirectory()) walk(abs, paths)
        else paths.push(abs)
    }
    return paths.map((abs) => ({
        path: relative(REPO_ROOT, abs).split('\\').join('/'),
        text: readFileSync(abs, 'utf8')
    }))
}

/** 匹配调用形态（`.foo(` / `foo(`）；注释中的裸标识符不计入 */
const callPattern = (name: string): RegExp => new RegExp(`\\.?${name}\\s*\\(`, 'g')

const filesCalling = (sources: SourceFile[], name: string): string[] => {
    const pattern = callPattern(name)
    return sources.filter((file) => pattern.test(file.text)).map((file) => file.path)
}

const basename = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

const access = (path: string): string => {
    const abs = join(REPO_ROOT, path)
    return existsSync(abs) ? readFileSync(abs, 'utf8') : ''
}

/** 注释行（`* …` / `// …` / `/* …`）不计入统计：只认**代码行**（防注释提到原语名造成假阳性） */
const isCommentLine = (line: string): boolean => /^\s*(\*|\/\/|\/\*)/.test(line)

/** 按文件统计**代码行**命中数（失败信息可定位到文件与处数） */
const countCodeOccurrences = (
    sources: SourceFile[],
    pattern: RegExp
): { total: number; rows: { path: string; hits: number }[] } => {
    const rows = sources
        .map((file) => ({
            path: file.path,
            hits: file.text
                .split(/\r?\n/)
                .filter((line) => !isCommentLine(line))
                .filter((line) => pattern.test(line)).length
        }))
        .filter((row) => row.hits > 0)
    return { total: rows.reduce((sum, row) => sum + row.hits, 0), rows }
}

const formatRows = (rows: { path: string; hits: number }[]): string =>
    rows.map((row) => `${row.path}(${row.hits})`).join('、')

describe('AC1/R1：失效执行单点存在且覆盖清理矩阵', () => {
    it('apps/web/src/session-end.ts 存在', () => {
        expect(
            existsSync(join(REPO_ROOT, 'apps/web/src/session-end.ts')),
            '期望执行单点 apps/web/src/session-end.ts（ADR D1）'
        ).toBe(true)
    })

    it('执行单点含矩阵 5 个原语（清会话/store/离线授权/轮换窗 + 锁 DEK）', () => {
        const text = access('apps/web/src/session-end.ts')
        expect(text, '缺 session-end.ts').not.toBe('')
        const required = [
            'revokeOfflineEntry',
            'clearAuthData',
            'localSession.clear',
            'cryptoService.lock',
            'resetTokenRotation'
        ]
        const missing = required.filter((name) => !callPattern(name).test(text))
        expect(missing, `session-end.ts 缺少清理原语：${missing.join('、')}`).toEqual([])
    })

    it('执行单点不得清业务数据/删密钥包（D2 矩阵：留 11 表 + 留 key-bundle）', () => {
        const text = access('apps/web/src/session-end.ts')
        expect(text).not.toBe('')
        const forbidden = ['wipeUserData', 'wipeLocalDataOnSignOut', 'key-bundle']
        const offenders = forbidden.filter((name) => text.includes(name))
        expect(offenders, `session-end.ts 不得出现：${offenders.join('、')}`).toEqual([])
    })
})

describe('AC1/R2：清理原语只允许出现在白名单文件', () => {
    const sources = readSources(SCAN_ROOTS)

    it.each(['localSession.clear', 'cryptoService.lock', 'resetTokenRotation'])(
        '%s 的调用文件 ⊆ 白名单',
        (name) => {
            const offenders = filesCalling(sources, name).filter(
                (path) => !ALLOWED_CLEANUP_FILES.has(basename(path))
            )
            expect(
                offenders,
                `ADR D2 白名单 = ${[...ALLOWED_CLEANUP_FILES].join(' / ')}；越界文件：${offenders.join('、')}`
            ).toEqual([])
        }
    )
})

describe('AC1/R3：请求层 / 同步层零清理（只能发事件）', () => {
    const sources = readSources([
        'packages/shared/requester',
        'packages/infrastructure/src/persistence-sync'
    ])

    it.each([
        'clearAuthData',
        'localSession.clear',
        'cryptoService.lock',
        'revokeOfflineEntry',
        'wipeUserData',
        'wipeLocalDataOnSignOut'
    ])('%s 在请求/同步层 0 处', (name) => {
        expect(filesCalling(sources, name)).toEqual([])
    })
})

describe('AC6/R4：persistence-sync 不再拼 `Bearer null`', () => {
    const sources = readSources(['packages/infrastructure/src/persistence-sync'])

    it('同步层无 `Bearer ${` 模板拼接（authHeaders 无 token 返回 {}）', () => {
        const offenders = sources
            .filter((file) => file.text.includes('Bearer ${'))
            .map((file) => file.path)
        expect(offenders, `DEF-93 源头：${offenders.join('、')}`).toEqual([])
    })
})

describe('AC6/R4 棘轮：Bearer 拼接面冻结（M4b 盲区闭合，新增即红）', () => {
    const requester = readSources(['packages/shared/requester'])
    const persistenceGo = readSources(['packages/infrastructure/src/persistence-go'])
    const bearerTemplate = /Bearer \$\{/

    it('shared/requester：除 auth-headers.ts / lynx.ts 外 0 处拼接', () => {
        const offenders = requester
            .filter((file) => bearerTemplate.test(file.text))
            .map((file) => basename(file.path))
            .filter((name) => !BEARER_CONCAT_ALLOWED_FILES.has(name))
        expect(
            offenders,
            `绕过 auth-headers 的拼接（应改指 shared/requester/auth-headers）：${offenders.join('、')}`
        ).toEqual([])
    })

    it(`shared/requester/lynx.ts 拼接数 = ${KNOWN_BEARER_CONCAT_SITES['shared/requester/lynx.ts']}（棘轮，双向）`, () => {
        const { rows } = countCodeOccurrences(requester, bearerTemplate)
        const lynxHits =
            rows.find((row) => row.path.endsWith('shared/requester/lynx.ts'))?.hits ?? 0
        expect(lynxHits, `现状：${formatRows(rows)}`).toBe(
            KNOWN_BEARER_CONCAT_SITES['shared/requester/lynx.ts']
        )
    })

    it(`persistence-go 拼接数 = ${KNOWN_BEARER_CONCAT_SITES['persistence-go']}（棘轮：新增即红；清理后须下调常量）`, () => {
        const { total, rows } = countCodeOccurrences(persistenceGo, bearerTemplate)
        expect(total, `现状：${formatRows(rows)}`).toBe(KNOWN_BEARER_CONCAT_SITES['persistence-go'])
    })
})

describe('AC1/R1 棘轮：凭证判据字面量冻结（`=== 10041` 类，新增即红）', () => {
    const sources = readSources(SCAN_ROOTS)
    // T599：覆盖同族两个凭证码（`10041` / `10042`）；只认比较，不认集合定义（口径同棘轮）
    const literalComparison = /(===|!==)\s*1004[12]\b/

    it(`凭证码比较字面量 = ${KNOWN_CREDENTIAL_LITERAL_COMPARISONS} 处（新增即红；清理后须下调常量）`, () => {
        const { total, rows } = countCodeOccurrences(sources, literalComparison)
        expect(total, `现状：${formatRows(rows)}`).toBe(KNOWN_CREDENTIAL_LITERAL_COMPARISONS)
    })
})

describe('AC1/R5：装配面不再直接清认证，改走单点', () => {
    it.each(['apps/web/src/app.ts', 'apps/desktop/src/renderer/src/main.ts'])(
        '%s 不含 clearAuthData 且引用单点',
        (path) => {
            const text = access(path)
            expect(text, `${path} 不存在`).not.toBe('')
            expect(text).not.toContain('clearAuthData(')
            const wired =
                text.includes('session-end') ||
                text.includes('auth-expiry') ||
                text.includes('fireAuthExpiry')
            expect(wired, `${path} 应引用 session-end / auth-expiry 单点`).toBe(true)
        }
    )
})