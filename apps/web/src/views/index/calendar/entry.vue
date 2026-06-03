<script lang="ts" setup>
import { AppAsideAdapter } from '@/layouts/app/'
// import { CalendarAside } from '@/layouts/calendar'
import { useCalendarView } from './calendar-view'
// import { Loading as LoadingComp } from '@nao-todo/components'

defineOptions({ name: 'CalendarView' })

const {
    init,
    // isLoading,
    // error,
    isDisplayAside,
    // switchDisplayAside,
    // asideWidth,
    handleResizeAside
} = useCalendarView()

init()
</script>

<template>
    <!-- <loading-comp v-if="isLoading" height="100%" />
    <nue-empty v-else-if="error" :description="error || '发生错误了'" />
    <nue-container v-else>
        <nue-main>
            <app-aside-adapter
                v-model:displayed="isDisplayAside"
                :width="asideWidth"
                :min-width="isDisplayAside ? '250px' : 'unset'"
                max-width="350px"
                @resize="handleResizeAside"
            >
                <calendar-aside v-if="isDisplayAside" />
            </app-aside-adapter>
            <nue-content fill style="overflow: hidden">
                <router-view v-slot="{ Component }">
                    <suspense>
                        <component
                            :is="Component"
                            :switch-display-aside="switchDisplayAside"
                            :is-display-aside="isDisplayAside"
                        />
                        <template #fallback>
                            <loading-comp height="100%" />
                        </template>
                    </suspense>
                </router-view>
            </nue-content>
        </nue-main>
    </nue-container> -->
    <nue-container>
        <nue-main>
            <app-aside-adapter
                v-model:displayed="isDisplayAside"
                width="auto"
                min-width="unset"
                max-width="350px"
                @resize="handleResizeAside"
            />
            <nue-content fill>
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

