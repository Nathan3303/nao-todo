<script lang="ts" setup>
import { CalendarAside } from '@/components/calendar/aside'
import { env } from '@/env'
import { Loading as LoadingComp, LoadingError } from '@nao-todo/shared'
import { onMounted } from 'vue'
import { useCalendarView } from './calendar-view'

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
                <!-- 开发环境日历主体 -->
                <template v-if="env.showUnimplementedFeatures">
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
                </template>
                <!-- 生产环境敬请期待 -->
                <template v-else>
                    <nue-content fill style="overflow: hidden">
                        <nue-empty
                            image-src="/images/feature.webp"
                            image-size="8rem"
                            description="日历页面还在规划中，敬请期待"
                            style="height: 100%"
                        >
                            <nue-button theme="small,primary" @click="$router.back()">
                                返回
                            </nue-button>
                        </nue-empty>
                    </nue-content>
                </template>
            </nue-main>
        </loading-error>
    </nue-container>
</template>

<style scoped></style>