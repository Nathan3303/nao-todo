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
        visualizer({ open: true }),
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
                    }
                }
            }
        }
    }
})
