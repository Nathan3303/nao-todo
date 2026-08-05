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
        plugins: [vue() as unknown as Plugin]
    }
})