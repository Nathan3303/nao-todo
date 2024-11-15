import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import terser from '@rollup/plugin-terser'

const isProd = process.env.NODE_ENV === 'production'
const isDev = process.env.NODE_ENV === 'development'
const isTest = process.env.NODE_ENV === 'test'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        terser({
            compress: {
                sequences: isProd,
                arguments: isProd,
                drop_console: isProd && ['log'],
                drop_debugger: isProd,
                passes: isProd ? 4 : 1,
                global_defs: {
                    '@PROD': JSON.stringify(isProd),
                    '@DEV': JSON.stringify(isDev),
                    '@TEST': JSON.stringify(isTest)
                }
            },
            format: {
                semicolons: false,
                shorthand: isProd,
                braces: !isProd,
                beautify: !isProd,
                comments: !isProd
            },
            mangle: {
                toplevel: isProd,
                eval: isProd,
                keep_classnames: isDev,
                keep_fnames: isDev
            }
        })
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    build: {
        outDir: 'dist',
        minify: false
    }
})
