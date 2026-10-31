/// <reference types="node" />
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'

/**
 * T603 红基线 —— AC5 / AC6：「会话结束类别」清除点收敛为 1 处（`DEF-123`）
 *
 * 现状（`DEF-121` 修复后的结构观察）：清除实现分散在 4 个文件
 * （`sign-in.vue` 登录成功 / `use-settings-sign-out.ts` / 桌面 `unlock-gate.vue` / `sign-out-broadcast.ts`）
 * ⇒ 未来新增任何登出或登录入口都会漏清，重演「已过期」误报横幅。
 *
 * 判据（PRD AC5 / AC6）：
 * 1. `clearSessionEndReason(` 的调用点只允许出现在**一个**非测试源码文件（统一入口模块）；
 * 2. 三条路径（登录成功 / 设置页登出 / 桌面解锁门登出）都必须经该入口（导入并调用其导出）；
 * 3. AC6 防复发 = **检测器自检**：合成一个「只清认证、不调统一入口」的假登出入口，
 *    同一检测器必须判红（证明结构被锁，而不是靠人记）。
 *
 * 边界（诚实声明）：这是**源码结构**扫描（非运行时）；注释行被剔除，但字符串字面量里的
 * 同名调用形态仍可能被计入（本仓无此写法）。
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

/** 三条必须走统一入口的会话边界路径（PRD AC5） */
const SESSION_BOUNDARY_PATHS = [
    'packages/presentation-identity/src/components/sign-in.vue',
    'apps/web/src/components/settings/use-settings-sign-out.ts',
    'apps/desktop/src/renderer/src/components/unlock-gate.vue'
]

const CLEAR_REASON_CALL = 'clearSessionEndReason'

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
        out.push(rel)
    }
}

/** 剔除注释（HTML 注释 / 块注释 / 行注释）——注释里的示例调用不算证据 */
const stripComments = (text: string): string =>
    text
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .map((line) => line.replace(/\/\/.*$/, ''))
        .join('\n')

const countCalls = (text: string, name: string): number =>
    stripComments(text).match(new RegExp(`\\b${name}\\s*\\(`, 'g'))?.length ?? 0

/** 模块导出的函数/常量名 */
const exportedNames = (text: string): string[] =>
    [
        ...stripComments(text).matchAll(
            /export\s+(?:async\s+)?(?:const|function)\s+([A-Za-z_$][\w$]*)/g
        )
    ].map((match) => match[1] as string)

/** 具名导入的标识符（`import { a, b as c } from '…'`） */
const importedNames = (text: string): string[] =>
    [...stripComments(text).matchAll(/import\s*\{([^}]*)\}\s*from\s*['"][^'"]+['"]/g)].flatMap(
        (match) =>
            (match[1] ?? '')
                .split(',')
                .map((part) => part.trim().split(/\s+as\s+/)[0] ?? '')
                .filter(Boolean)
    )

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 文件是否从统一入口模块导入（同文件基名） */
const importsBoundaryModule = (fileText: string, boundaryPath: string): boolean => {
    const stem = basename(boundaryPath).replace(/\.(ts|vue)$/, '')
    return new RegExp(`from\\s*['"][^'"]*${escapeRegExp(stem)}['"]`).test(stripComments(fileText))
}

/**
 * 文件经统一入口模块导出的函数名（空数组 = 未走入口 ⇒ 违规）
 * @description AC5② 与 AC6 共用同一检测器（检测器自检见 AC6）。
 */
const boundaryEntryCalls = (fileText: string, boundaryText: string): string[] => {
    const exports = exportedNames(boundaryText)
    const calls = stripComments(fileText)
    return importedNames(fileText).filter(
        (name) =>
            exports.includes(name) && new RegExp(`\\b${escapeRegExp(name)}\\s*\\(`).test(calls)
    )
}

const sourceFiles = (() => {
    const paths: string[] = []
    for (const root of SCAN_ROOTS) walk(join(REPO_ROOT, root), paths)
    return [...new Set(paths)].map((path) => ({
        path,
        text: readFileSync(join(REPO_ROOT, path), 'utf-8')
    }))
})()

describe('T603 AC5 · 「会话结束类别」清除点收敛为 1 处', () => {
    const clearingFiles = sourceFiles
        .filter((file) => countCalls(file.text, CLEAR_REASON_CALL) > 0)
        .map((file) => file.path)

    it('AC5① 清除实现只出现在 1 个非测试源码文件', () => {
        expect(
            clearingFiles,
            `清除实现仍分散在 ${clearingFiles.length} 处：${JSON.stringify(clearingFiles)}` +
                '（PRD AC5 要求收敛为统一「会话边界」入口）'
        ).toHaveLength(1)
    })

    it('AC5② 三条路径（登录成功 / 设置页登出 / 桌面解锁门登出）都经同一入口', () => {
        expect(
            clearingFiles,
            `前置：清除实现应唯一（实测：${JSON.stringify(clearingFiles)}）`
        ).toHaveLength(1)
        const boundaryPath = clearingFiles[0]!
        const boundaryText = sourceFiles.find((file) => file.path === boundaryPath)!.text

        const violations = SESSION_BOUNDARY_PATHS.flatMap((path) => {
            const file = sourceFiles.find((source) => source.path === path)
            if (!file) return [`${path}（文件不存在）`]
            const problems: string[] = []
            if (!importsBoundaryModule(file.text, boundaryPath)) {
                problems.push(`${path} 未从统一入口 ${boundaryPath} 导入`)
            }
            if (boundaryEntryCalls(file.text, boundaryText).length === 0) {
                problems.push(`${path} 未调用统一入口导出的函数`)
            }
            return problems
        })

        expect(violations, `未走统一入口：${JSON.stringify(violations)}`).toEqual([])
    })
})

describe('T603 AC6 · 防复发（假登出入口只能判红）', () => {
    const syntheticBoundary = [
        'export const onSessionBoundary = (type: string) => {',
        '    if (type === "sign-out" || type === "sign-in-success") clearSessionEndReason()',
        '}'
    ].join('\n')

    const fakeSignOut = [
        "import { useUserStore } from '@nao-todo/presentation-identity'",
        "import { localSession } from 'somewhere'",
        'export const fakeSignOut = () => {',
        '    useUserStore().clearAuthData()',
        '    localSession.clear()',
        '}'
    ].join('\n')

    const compliantSignOut = [
        "import { onSessionBoundary } from './session-boundary'",
        'export const signOut = async () => {',
        '    await onSessionBoundary("sign-out")',
        '}'
    ].join('\n')

    it('AC6① 假登出入口（只清认证、不调统一入口）⇒ 检测器判红', () => {
        // 前提：它确实是「只清认证」的假登出（否则这条自检没有意义）
        expect(fakeSignOut).toMatch(/clearAuthData\s*\(/)
        expect(fakeSignOut).not.toContain('onSessionBoundary')
        // 若把它加入 SESSION_BOUNDARY_PATHS，AC5② 会因下面这个空数组而红
        expect(boundaryEntryCalls(fakeSignOut, syntheticBoundary)).toEqual([])
    })

    it('AC6② 正对照：调用统一入口的文件 ⇒ 检测器判绿', () => {
        expect(boundaryEntryCalls(compliantSignOut, syntheticBoundary)).toEqual([
            'onSessionBoundary'
        ])
    })

    it('AC6③ 自检锚点：合成入口本身确实调用了清除原语（检测器口径自洽）', () => {
        expect(countCalls(syntheticBoundary, CLEAR_REASON_CALL)).toBe(1)
    })
})