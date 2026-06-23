<script lang="ts" setup>
import { TaskDetailsAdapter } from '@/layouts/app'
import { Loading as LoadingComp } from '@nao-todo/components'
import { usePomodoroView } from './pomodoro-view'
import { PomodoroAside, PomodoroDialogAdapter } from '@/layouts/pomodoro'

defineOptions({ name: 'PomodoroView' })

usePomodoroView()
</script>

<template>
    <nue-container>
        <!-- 番茄钟页面 -->
        <nue-main>
            <!-- 侧边栏 -->
            <pomodoro-aside />
            <!-- 内容区域 -->
            <nue-content fill>
                <router-view v-slot="{ Component }">
                    <suspense>
                        <component :is="Component" />
                        <template #pending>
                            <loading-comp height="100%" />
                        </template>
                        <template #fallback>
                            <nue-empty image-src="/images/error.webp" image-size="6rem">
                                <nue-text size="var(--nue-text-sm)">
                                    加载失败, 请刷新页面重试
                                </nue-text>
                            </nue-empty>
                        </template>
                    </suspense>
                </router-view>
            </nue-content>
            <!-- 任务详情适配器 -->
            <task-details-adapter />
        </nue-main>
        <!-- 对话框适配器 -->
        <pomodoro-dialog-adapter />
    </nue-container>
</template>

<style scoped></style>

