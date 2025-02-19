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
                passes: 4
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
        visualizer({ open: false })
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    build: {
        outDir: 'dist',
        minify: false,
        cssCodeSplit: true,
        rollupOptions: {
            output: {
                assetFileNames: (assetInfo) => {
                    if (assetInfo.type === 'asset' && (assetInfo.name as string).endsWith('.css'))
                        return 'css/[name].[hash].[ext]'
                    return assetInfo.name as string
                },
                chunkFileNames: 'js/[name].[hash].js',
                manualChunks: (path) => {
                    if (path.includes('node_modules')) return 'vendor'
                    else if (path.includes('/apps/web/src/themes')) return 'theme'
                    else if (path.includes('/apps/web/src/routes')) return 'routes'
                    else if (path.includes('/apps/web/src/stores')) return 'stores'
                    return void 0
                }
            }
        }
    }
})
