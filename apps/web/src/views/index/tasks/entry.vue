<script lang="ts" setup>
import { TasksViewAside } from '@/layouts/tasks'
import { TaskDetailsAdapter } from '@/layouts/app'
import useTasksView from './tasks-view'
import { Loading as LoadingComp } from '@nao-todo/components'
import { onMounted } from 'vue'

defineOptions({ name: 'TasksView' })

const { isLoading, error, init } = useTasksView()

onMounted(() => init())
</script>

<template>
    <!-- 加载组件 -->
    <loading-comp v-if="isLoading" height="100%" />
    <!-- 错误状态 -->
    <nue-empty v-else-if="error" :description="error" height="100%">
        <nue-button theme="primary,small" @click="init">重试</nue-button>
    </nue-empty>
    <!-- 视图主体 -->
    <nue-container v-else>
        <nue-main>
            <!-- 侧边栏 -->
            <tasks-view-aside />
            <!-- 内容区域 -->
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
    </nue-container>
</template>

