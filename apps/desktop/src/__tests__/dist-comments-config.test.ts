/**
 * 桌面端构建压缩配置断言（T734）
 * @description `main` / `preload` 若没有 `build` 配置，electron-vite 默认**不压缩、保留注释**
 *              ⇒ 打进的 asar 里能直接读到源码注释（含内部编号 R5/R13/T654 与测试文件名）。
 *              本用例断言「只去注释」的配置形状仍在，防止后续重写配置段时静默回退。
 *
 * 判据是**真读配置对象**（不是对配置源码做字符串匹配）：配置模块在模块作用域用 `__dirname`
 * 解析 `package.json`（Vite 加载配置时会注入），ESM 测试环境里它是未绑定标识符 ⇒ 先把它挂到
 * `globalThis`（未绑定标识符才会解析到全局），再动态 import 配置取默认导出。
 *
 * 产物侧的对应守卫：`scripts/guard-dist-comments.mjs`（`pnpm guard:dist-comments`）。
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vite-plus/test'

const DESKTOP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CONFIG_PATH = resolve(DESKTOP_ROOT, 'electron.vite.config.ts')

/** 断言用到的配置形状（只声明被检查的字段，其余不关心） */
interface TerserFormat {
    comments?: unknown
    beautify?: unknown
    semicolons?: unknown
}

interface TerserOptions {
    compress?: unknown
    mangle?: unknown
    format?: TerserFormat
}

interface SectionBuild {
    minify?: unknown
    terserOptions?: TerserOptions
}

interface SectionConfig {
    build?: SectionBuild
}

vi.stubGlobal('__dirname', DESKTOP_ROOT)
const { default: config } = (await import(/* @vite-ignore */ CONFIG_PATH)) as {
    default: Record<'main' | 'preload' | 'renderer', SectionConfig>
}

describe('electron.vite.config.ts：main / preload 只去注释（T734）', () => {
    for (const target of ['main', 'preload'] as const) {
        describe(target, () => {
            it('配了 terser 压缩', () => {
                expect(config[target]?.build).toBeTypeOf('object')
                expect(config[target].build?.minify).toBe('terser')
            })

            it('关掉 compress / mangle（崩溃栈保留变量名与语句结构）', () => {
                const options = config[target].build?.terserOptions
                expect(options?.compress).toBe(false)
                expect(options?.mangle).toBe(false)
            })

            it('不再输出注释，且保留行结构（否则行号退化为 :1:列）', () => {
                const format = config[target].build?.terserOptions?.format
                expect(format?.comments).toBe(false)
                expect(format?.beautify).toBe(true)
            })
        })
    }

    it('renderer 段未被本单改动（仍为既有 terser 配置，含 semicolons 约束）', () => {
        const renderer = config.renderer?.build
        expect(renderer?.minify).toBe('terser')
        expect(renderer?.terserOptions?.format?.semicolons).toBe(true)
    })
})

describe('断言对象本身有效（防止导入落空后静默全绿）', () => {
    it('配置导出含 main / preload / renderer 三段', () => {
        for (const key of ['main', 'preload', 'renderer'] as const) {
            expect(Object.keys(config)).toContain(key)
        }
        // 防止「导入到空对象 ⇒ 上面断言全在 undefined 上静默通过」
        expect(config.main?.build?.minify).toBeDefined()
    })
})