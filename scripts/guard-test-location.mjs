/**
 * 测试文件位置守卫（散落测试必须位于 `__tests__/` 目录内）
 * @description 静态断言 `apps/**` 与 `packages/**` 下的测试文件（`*.test.ts` / `*.spec.ts` /
 *              `*.test.tsx` / `*.spec.tsx`）一律位于名为 `__tests__` 的目录内。
 *
 * 背景（用户 2026-09-29 需求，T369）：全仓测试目录名统一为 `__tests__`（73 个目录，无单数形式）；
 * 散落测试（与源文件同目录）破坏一致性，也让「测试在哪」需要靠猜 ⇒ 一次性拉齐并加门禁防复发。
 *
 * 覆盖 / 排除：
 *  1. 扫描 `apps/` 与 `packages/` 全量；跳过 `node_modules` 与构建产物（`dist` / `out` / `build` /
 *     `coverage` / `release` / `release-unpacked` 等）。
 *  2. **移动端红线**：`apps/mobile` 与 `packages/presentation-react` 为移动端专属面，本守卫
 *     **既不检查也不移动**（用户要求「有散落也不搬」；现状这两处测试均已位于 `__tests__/`）。
 *  3. 判据：测试文件路径必须含 `__tests__` 路径段，否则记为违规（打印文件清单 + 退出码 1）。
 *  4. 扫描根不存在或扫到 0 个测试文件 ⇒ 显式失败（防守卫空转）。
 *
 * 用途：CI / 提交前手动跑 `pnpm guard:test-location`。
 */
import { readdirSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import process from 'node:process'

const ROOTS = ['apps', 'packages']
const IGNORE_DIRS = new Set([
    'node_modules',
    'dist',
    'out',
    'build',
    'coverage',
    'release',
    'release-unpacked',
    '.git',
    '.vite-hooks'
])
const TEST_EXTS = ['.test.ts', '.spec.ts', '.test.tsx', '.spec.tsx']
/** 移动端红线（用户要求）：这两处为移动端专属面，守卫不检查、不移动 */
const MOBILE_EXEMPT = ['apps/mobile', 'packages/presentation-react']
const isExempt = (p) => MOBILE_EXEMPT.some((root) => p === root || p.startsWith(root + sep))

/** 违规文件清单（散落在 `__tests__/` 之外的测试文件） */
const offenders = []
/** 发现的测试文件总数（含移动端白名单，防止空转） */
let found = 0
/** 实际受检的测试文件数（不含移动端白名单） */
let checked = 0

const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
        if (IGNORE_DIRS.has(entry)) continue
        const p = join(dir, entry)
        if (statSync(p).isDirectory()) {
            walk(p)
            continue
        }
        if (!TEST_EXTS.some((ext) => entry.endsWith(ext))) continue
        found += 1
        if (isExempt(p)) continue
        checked += 1
        if (!p.split(sep).includes('__tests__')) offenders.push(p)
    }
}

for (const root of ROOTS) {
    if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
        offenders.push(`${root}: 扫描根不存在（守卫会空转，拒绝）`)
        continue
    }
    walk(root)
}
if (found === 0) offenders.push('扫描到 0 个测试文件（守卫会空转，拒绝）')

if (offenders.length > 0) {
    console.error('[guard:test-location] 测试文件必须位于 __tests__/ 目录内，以下文件散落在源目录：')
    offenders.forEach((line) => console.error('  - ' + line))
    process.exit(1)
}
console.log(
    `[guard:test-location] OK - apps/ 与 packages/ 共 ${checked} 个受检测试文件均位于 __tests__/ 目录内` +
        `（另有 ${found - checked} 个移动端白名单文件未检查）`
)
