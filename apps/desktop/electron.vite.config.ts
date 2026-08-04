import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import type { Plugin } from 'vite'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()]
    },
    preload: {
        plugins: [externalizeDepsPlugin()]
    },
    renderer: {
        resolve: {
            alias: {
                // @ → webapp 源码（views/components/themes/router/commands/context/env 全部复用）
                '@': resolve(__dirname, '../web/src'),
                // @/hooks → desktopapp 自有装配层（阶段 4 换本地仓储实现）
                '@/hooks': resolve(__dirname, 'src/renderer/src/hooks')
            }
        },
        // 复用 webapp 的静态资源（字体 iconfont/pf/poppins、图片、favicon）
        publicDir: resolve(__dirname, '../web/public'),
        plugins: [vue() as unknown as Plugin]
    }
})