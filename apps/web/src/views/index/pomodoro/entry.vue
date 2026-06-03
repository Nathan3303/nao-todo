<script lang="ts" setup>
import { AppAsideAdapter } from '@/layouts/app/'
import { usePomodoroView } from './pomodoro-view'

defineOptions({ name: 'PomodoroView' })

const { isDisplayAside, handleResizeAside } = usePomodoroView()
</script>

<template>
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
                    description="番茄钟页面还在规划中，敬请期待"
                    style="height: 100%"
                >
                    <nue-button theme="small,primary" @click="$router.back()">返回</nue-button>
                </nue-empty>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped></style>

