<script lang="ts" setup>
import { AppAsideAdapter } from '@/components/app'
import { CalendarAside } from '@/components/calendar/aside'
import { env } from '@/env'
import { Loading as LoadingComp } from '@nao-todo/shared'
import { onMounted } from 'vue'
import { useCalendarView } from './calendar-view'

defineOptions({ name: 'CalendarView' })

const { init, isDisplayAside } = useCalendarView()

onMounted(() => init())
</script>

<template>
    <nue-container>
        <nue-main v-if="env.showUnimplementedFeatures">
            <calendar-aside />
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
        </nue-main>
        <nue-main v-else>
            <app-aside-adapter v-model:displayed="isDisplayAside" width="auto" min-width="unset" />
            <nue-content fill style="overflow: hidden">
                <nue-empty
                    image-src="/images/feature.webp"
                    image-size="8rem"
                    description="日历页面还在规划中，敬请期待"
                    style="height: 100%"
                >
                    <nue-button theme="small,primary" @click="$router.back()">返回</nue-button>
                </nue-empty>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped></style>
