import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import type { Plugin } from 'vite'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()]
    },
    preload: {
        plugins: [externalizeDepsPlugin()]
    },
    renderer: {
        resolve: {
            alias: [
                // 注意顺序：@/hooks 必须排在 @ 之前，
                // 否则前缀匹配会把 @/hooks 解析到 webapp 的 hooks（远程装配）
                { find: '@/hooks', replacement: resolve(__dirname, 'src/renderer/src/hooks') },
                // @ → webapp 源码（views/components/themes/router/commands/context/env 全部复用）
                { find: '@', replacement: resolve(__dirname, '../web/src') }
            ]
        },
        // 复用 webapp 的静态资源（字体 iconfont/pf/poppins、图片、favicon）
        publicDir: resolve(__dirname, '../web/public'),
        plugins: [
            vue() as unknown as Plugin,
            // 体积分析报告（stats.html），构建时不在桌面端自动打开浏览器
            visualizer({ open: false }) as unknown as Plugin
        ],
        build: {
            // 与 web 端一致的 terser 压缩/丑化（drop console.log/debugger、toplevel mangle）
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
            cssMinify: true,
            // vendor 拆分：避免把全部依赖打进单个巨型 chunk（基线约 1.1MB 单块）
            rollupOptions: {
                output: {
                    manualChunks: (id) => {
                        if (!id.includes('node_modules')) return undefined
                        const parts = id.toString().split('node_modules/')[1]?.split('/')
                        const truePackageName =
                            (parts?.[0] === '.pnpm' ? parts?.[1] : parts?.[0]) ?? ''
                        if (truePackageName.includes('nue-ui')) return 'vender/nue-ui'
                        else if (truePackageName.includes('pinia')) return 'vender/pinia'
                        else if (truePackageName.includes('vue-router')) return 'vender/vue-router'
                        else if (truePackageName.includes('vue')) return 'vender/vue-ecosystem'
                        else return truePackageName ? `vender/${truePackageName}` : undefined
                    }
                }
            }
        }
    }
})