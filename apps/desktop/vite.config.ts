import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
    // 相对路径，兼容 Electron 生产环境 file:// 协议加载
    base: './',
    plugins: [vue()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    server: {
        port: 5273,
        strictPort: true
    },
    build: {
        outDir: 'dist',
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
