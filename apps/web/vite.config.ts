import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import terser from '@rollup/plugin-terser'
import { visualizer } from 'rollup-plugin-visualizer'
import htmlTransformPlugin from './html-transform-plugin'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        terser({
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
        }),
        visualizer({ open: true }),
        htmlTransformPlugin()
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    build: {
        outDir: 'dist',
        minify: true,
        cssCodeSplit: true,
        cssMinify: true,
        rollupOptions: {
            output: {
                assetFileNames: (assetInfo) => {
                    if (assetInfo.type === 'asset' && (assetInfo.name as string).endsWith('.css'))
                        return 'css/[name].[hash].[ext]'
                    return assetInfo.name as string
                },
                chunkFileNames: 'js/[name].[hash].js',
                manualChunks: (id) => {
                    if (id.includes('node_modules')) {
                        const packageNames = id.toString().split('node_modules/')[1].split('/')
                        const truePackageName =
                            packageNames[0] === '.pnpm' ? packageNames[1] : packageNames[0]
                        if (truePackageName.includes('nue-ui')) return 'vender/nue-ui'
                        else if (truePackageName.includes('pinia')) return 'vender/pinia'
                        else if (truePackageName.includes('vue-router')) return 'vender/vue-router'
                        else if (truePackageName.includes('vue')) return 'vender/vue-ecosystem'
                        else return `vender/${truePackageName}`
                    } else if (id.includes('src/stores')) {
                        // const packageName = id.toString().split('src/stores')[1]
                        // const truePackageName = packageName.split('-')[1]
                        // if (['project', 'tag', 'view', 'todo'].includes(truePackageName))
                        //     return 'app-stores/tasks-main'
                        // if (['comment', 'event'].includes(truePackageName))
                        //     return 'app-stores/tasks-detail'
                        // if (truePackageName) return `app-stores/${truePackageName}`
                        // else return 'app-stores/index'
                    } else if (id.includes('src/views/auth')) {
                        // const packageName = id.toString().split('src/views/auth')[1]
                        // if (packageName.includes('sign-in')) return 'auth-view_sign-in'
                        // else if (packageName.includes('sign-up')) return 'auth-view_sign-up'
                        // else
                        // return 'auth-view'
                    }
                }
            }
        }
    }
})
