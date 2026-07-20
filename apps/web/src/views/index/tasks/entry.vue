<script lang="ts" setup>
import { TasksViewAside } from '@/components/tasks'
import { TaskDetailsAdapter } from '@nao-todo/presentation/task'
import { Loading as LoadingComp, LoadingError } from '@nao-todo/shared'
import { onMounted } from 'vue'
import useTasksView from './tasks-view'

defineOptions({ name: 'TasksView' })

const { isLoading, error, init } = useTasksView()

onMounted(() => init())
</script>

<template>
    <!-- 视图主体 -->
    <nue-container>
        <loading-error :loading="isLoading" :error="!!error">
            <!-- 错误状态 -->
            <template #error>
                <nue-div vertical align="center">
                    <nue-text>{{ error }}</nue-text>
                </nue-div>
                <nue-button theme="primary,small" @click="init">重试</nue-button>
            </template>
            <!-- 内容区域 -->
            <nue-main>
                <!-- 侧边栏 -->
                <tasks-view-aside />
                <nue-content fill style="overflow: hidden">
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
                <!-- 详情适配器 -->
                <task-details-adapter />
            </nue-main>
        </loading-error>
    </nue-container>
</template>

