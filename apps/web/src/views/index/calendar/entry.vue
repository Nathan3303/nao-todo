<script lang="ts" setup>
import { onMounted } from 'vue'
import { AppAsideAdapter } from '@/layouts/app/'
import { CalendarAside } from '@/layouts/calendar/aside'
import { useCalendarView } from './calendar-view'
import { env } from '@/infrastructure/constants/env'
import { Loading as LoadingComp } from '@nao-todo/components'

defineOptions({ name: 'CalendarView' })

const { init, isDisplayAside, asideWidth, handleResizeAside } = useCalendarView()

onMounted(() => init())
</script>

<template>
    <nue-container>
        <nue-main v-if="env.showUnimplementedFeatures">
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
        <nue-main v-else>
            <app-aside-adapter
                v-model:displayed="isDisplayAside"
                :width="asideWidth"
                :min-width="isDisplayAside ? '250px' : 'unset'"
                max-width="350px"
                @resize="handleResizeAside"
            >
                <calendar-aside />
            </app-aside-adapter>
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
    </nue-container>
</template>

<style scoped></style>

