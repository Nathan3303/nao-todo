<script lang="ts" setup>
import { TaskDetailsAdapter } from '@/layouts/app'
import { Loading as LoadingComp } from '@nao-todo/components'
import { usePomodoroView } from './pomodoro-view'
import { PomodoroAside } from '@/layouts/pomodoro/aside'
import { env } from '@/infrastructure/constants/env'

defineOptions({ name: 'PomodoroView' })

usePomodoroView()
</script>

<template>
    <!-- 番茄钟页面 -->
    <nue-container v-if="env.showUnimplementedFeatures">
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
    </nue-container>
    <!-- 番茄钟页面未开放 -->
    <nue-empty
        v-else
        image-src="/images/feature.webp"
        image-size="8rem"
        description="番茄钟页面还在规划中，敬请期待"
        style="height: 100%"
    >
        <nue-button theme="small,primary" @click="$router.back()">返回</nue-button>
    </nue-empty>
</template>

<style scoped></style>

