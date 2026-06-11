<script lang="ts" setup>
import { onMounted } from 'vue'
import { AppAsideAdapter } from '@/layouts/app/'
import { CalendarAside } from '@/layouts/calendar/aside'
import { useCalendarView } from './calendar-view'
import { env } from '@/infrastructure/constants/env'

defineOptions({ name: 'CalendarView' })

const { init, isDisplayAside, asideWidth, handleResizeAside } = useCalendarView()

onMounted(() => init())
</script>

<template>
    <nue-container>
        <nue-main>
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
                <router-view v-if="env.showUnimplementedFeatures" />
                <nue-empty
                    v-else
                    image-src="/images/feature.webp"
                    image-size="8rem"
                    description="搜索页面还在规划中，敬请期待"
                    style="height: 100%"
                >
                    <nue-button theme="small,primary" @click="$router.back()">返回</nue-button>
                </nue-empty>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped></style>

