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