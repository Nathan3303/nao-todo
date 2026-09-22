<script lang="ts" setup>
import { CalendarAside } from '@/components/calendar/aside'
import { TaskDetailsAdapter } from '@nao-todo/presentation/task'
import { LoadingError } from '@nao-todo/shared'
import { onMounted } from 'vue'
import { useCalendarView } from './calendar-view'
import CalendarHost from './host.vue'

defineOptions({ name: 'CalendarView' })

const { isLoading, error, init } = useCalendarView()

onMounted(() => init())
</script>

<template>
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
                <calendar-aside />
                <!-- 日历主体（状态宿主 + 三视图子路由） -->
                <nue-content fill style="overflow: hidden">
                    <calendar-host />
                </nue-content>
                <!-- 任务详情适配器（Q5-B：日历区内嵌） -->
                <task-details-adapter />
            </nue-main>
        </loading-error>
    </nue-container>
</template>

<style scoped></style>