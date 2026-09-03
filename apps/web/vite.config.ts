import { fileURLToPath, URL } from 'node:url'
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'
import { defineConfig, lazyPlugins, type Plugin } from 'vite-plus'
import vue from '@vitejs/plugin-vue'
import { visualizer } from 'rollup-plugin-visualizer'

/**
 * 构建产物 gzip/brotli 预压缩插件
 * @description 在产物写出后为 js/css/html/svg/json 生成 .gz/.br（>1KB），
 *              供 nginx（gzip_static/brotli_static）或支持预压缩的 CDN 直接使用，
 *              零构建期额外依赖（node:zlib 原生）。
 */
const precompress = (): Plugin => {
    return {
        name: 'nao-precompress',
        apply: 'build',
        writeBundle(outputOptions) {
            const outDir = outputOptions.dir
            if (!outDir) return
            const walk = (dir: string) => {
                for (const entry of readdirSync(dir)) {
                    const filePath = join(dir, entry)
                    if (statSync(filePath).isDirectory()) {
                        walk(filePath)
                        continue
                    }
                    if (!/\.(js|css|html|svg|json)$/.test(entry)) continue
                    const buf = readFileSync(filePath)
                    if (buf.length < 1024) continue
                    writeFileSync(`${filePath}.gz`, gzipSync(buf, { level: 9 }))
                    writeFileSync(
                        `${filePath}.br`,
                        brotliCompressSync(buf, {
                            params: { [constants.BROTLI_PARAM_QUALITY]: 11 }
                        })
                    )
                }
            }
            walk(outDir)
        }
    }
}

// https://vitejs.dev/config/
export default defineConfig({
    plugins: lazyPlugins(() => [vue(), visualizer({ open: true }), precompress()]),
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    build: {
        outDir: 'dist',
        // 原生 terser 单次压缩（替代 @rollup/plugin-terser 插件 + 默认 oxc 压缩的双压缩）
        minify: 'terser',
        terserOptions: {
            compress: {
                sequences: true,
                arguments: true,
                drop_console: ['log'],
                drop_debugger: true,
                passes: 4,
                ecma: 2015,
                toplevel: true
            },
            format: {
                semicolons: false,
                shorthand: true,
                braces: false,
                comments: false
            },
            mangle: {
                toplevel: true,
                eval: true
            }
        },
        cssCodeSplit: true,
        cssMinify: true,
        rollupOptions: {
            output: {
                chunkFileNames: 'js/[name].[hash].js',
                manualChunks: (id) => {
                    if (!id.includes('node_modules')) return undefined
                    const parts = id.toString().split('node_modules/')[1]?.split('/')
                    const truePackageName = (parts?.[0] === '.pnpm' ? parts?.[1] : parts?.[0]) ?? ''
                    if (truePackageName.includes('nue-ui')) return 'vender/nue-ui'
                    else if (truePackageName.includes('pinia')) return 'vender/pinia'
                    else if (truePackageName.includes('vue-router')) return 'vender/vue-router'
                    else if (truePackageName.includes('vue')) return 'vender/vue-ecosystem'
                    else return truePackageName ? `vender/${truePackageName}` : undefined
                }
            }
        }
    }
})