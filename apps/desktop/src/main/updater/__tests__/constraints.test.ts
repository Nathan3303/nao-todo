import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vite-plus/test'

/**
 * T736 · 三条可测性硬约束的**静态守卫**（QA 逐条核的那三条）
 *
 * @description 这三条是「AC1–AC11 的自动化面不收缩」的前提，写成静态用例后
 *              不再靠人读代码确认（改坏即红）：
 *              ① 更新内核（`core` / `state` / `version` / `install-mode` / `store` / `wiring` /
 *                 装配 `index`）**不 import `electron`** ⇒ 单测零主进程依赖；
 *              ② `electron-updater` **只出现在 `adapters/electron-updater.ts`** ⇒ 单测不触真实网络；
 *              ③ 判定类模块（`install-mode` / `version`）**零 IO**（不引 `node:` 内置模块）。
 *              判据只认**代码**（先剥注释）且只看**模块说明符**（引号包裹），
 *              注释里提到包名不算违规。
 * @see docs/adr/2026-11-20-desktop-self-update.md（可测性前置 ①②③）
 * @see docs/prds/2026-11-20-desktop-self-update.md（§七 可测性前置）
 */

const UPDATER_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')

/** 内核 + 装配（`adapters/` 以外的全部实现文件） */
const KERNEL_FILES = [
    'core.ts',
    'state.ts',
    'version.ts',
    'install-mode.ts',
    'store.ts',
    'wiring.ts',
    'index.ts'
]

/** 只做纯判定的模块（必须零 IO） */
const PURE_FILES = ['install-mode.ts', 'version.ts']

/** 剥掉块注释与整行行注释（文档里允许提到包名与环境读取，判据只看代码） */
const stripComments = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

/** 读取并剥注释后的源码 */
const code = (relativePath: string): string =>
    stripComments(readFileSync(join(UPDATER_DIR, relativePath), 'utf8'))

/** 源码是否把 `name` 当模块说明符用（`from 'name'` / `require('name')`；引号锚定，不误伤相对路径） */
const usesModule = (source: string, name: string): boolean =>
    new RegExp(`['"]${name}['"]`).test(source)

/** 递归列出 updater 目录下全部 `.ts`（相对路径，统一 `/` 分隔，便于精确断言） */
const listTsFiles = (dir = UPDATER_DIR): string[] =>
    readdirSync(dir).flatMap((entry) => {
        const absolute = join(dir, entry)
        if (statSync(absolute).isDirectory()) return listTsFiles(absolute)
        return entry.endsWith('.ts') ? [relative(UPDATER_DIR, absolute).split('\\').join('/')] : []
    })

/** 实现文件（排除单测自身：单测里出现包名字面量是在断言它，不是引用它） */
const listImplFiles = (): string[] => listTsFiles().filter((file) => !file.startsWith('__tests__/'))

/** 单测文件 */
const listTestFiles = (): string[] => listTsFiles().filter((file) => file.startsWith('__tests__/'))

describe('硬约束 ①：内核不 import electron', () => {
    it.each(KERNEL_FILES)('%s 不引 electron', (file) => {
        expect(usesModule(code(file), 'electron')).toBe(false)
    })

    it('electron 运行期引用只落在 adapters/ 一处', () => {
        expect(listImplFiles().filter((file) => usesModule(code(file), 'electron'))).toEqual([
            'adapters/electron-updater.ts'
        ])
    })
})

describe('硬约束 ②：electron-updater 只出现在 adapter', () => {
    it('实现文件全扫描：只有 adapters/electron-updater.ts 引用该包', () => {
        expect(
            listImplFiles().filter((file) => usesModule(code(file), 'electron-updater'))
        ).toEqual(['adapters/electron-updater.ts'])
    })

    it('除装配文件外无人 import adapter（单测不触真实网络 / 不加载 electron）', () => {
        const offenders = listImplFiles().filter(
            (file) => file !== 'index.ts' && /\bfrom\s+['"][^'"]*adapters\//.test(code(file))
        )
        expect(offenders).toEqual([])
    })

    it.each(listTestFiles())('%s 不 import adapter / electron（单测零主进程依赖）', (file) => {
        const source = code(file)
        expect(/\bfrom\s+['"][^'"]*adapters\//.test(source)).toBe(false)
        expect(/\bfrom\s+['"]electron['"]/.test(source)).toBe(false)
        expect(/\brequire\s*\(\s*['"]electron['"]\s*\)/.test(source)).toBe(false)
    })
})

describe('硬约束 ③：判定模块零 IO（纯函数可单测）', () => {
    it.each(PURE_FILES)('%s 不引 node: 内置模块（零 fs / 零 net）', (file) => {
        expect(/\bfrom\s+['"]node:/.test(code(file))).toBe(false)
        expect(/\brequire\s*\(\s*['"]node:/.test(code(file))).toBe(false)
    })

    it('install-mode 判定只取入参（不读 process / app）', () => {
        const source = code('install-mode.ts')
        expect(source).toContain('export const resolveInstallMode = ({')
        expect(/\bprocess\./.test(source)).toBe(false)
        expect(/\bapp\./.test(source)).toBe(false)
    })
})