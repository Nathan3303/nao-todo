import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import terser from '@rollup/plugin-terser'
import { visualizer } from 'rollup-plugin-visualizer'

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
        visualizer({ open: true })
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
                        if (truePackageName.includes('nue-ui')) return 'nue-ui'
                        else if (truePackageName.includes('vue')) return 'vue-ecosystem'
                        else if (
                            truePackageName.includes('axios') ||
                            truePackageName.includes('spark-md5')
                        )
                            return 'axios'
                        else if (
                            truePackageName.includes('markdown-it') ||
                            truePackageName.includes('mdurl') ||
                            truePackageName.includes('linkify-it')
                        )
                            return 'markdown-it'
                        else return truePackageName
                    } else if (id.includes('src/views/auth')) {
                        // const packageName = id.toString().split('src/views/auth')[1]
                        // if (packageName.includes('sign-in')) return 'auth-view_sign-in'
                        // else if (packageName.includes('sign-up')) return 'auth-view_sign-up'
                        // else
                        return 'auth-view'
                    }
                }
            }
        }
    }
})
