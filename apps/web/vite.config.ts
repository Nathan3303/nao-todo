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
        visualizer({ open: true })
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
