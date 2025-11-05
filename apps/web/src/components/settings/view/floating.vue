<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useViewSetterStore } from '@/stores/settings'

defineOptions({ name: 'SettingsViewTasks' })

const viewSetterStore = useViewSetterStore()

const {
    isUseFloatTasksAsideDefaultly,
    isUseFloatTasksOutlineDefaultly,
    isUseFloatSettingsAsideDefaultly
} = storeToRefs(viewSetterStore)
</script>

<template>
    <nue-div theme="card" vertical>
        <nue-container>
            <nue-header height="auto">浮动侧边栏偏好设置</nue-header>
            <nue-main>
                <nue-content>
                    <nue-div vertical gap=".5rem">
                        <nue-div align="center" justify="space-between">
                            <nue-text color="gray" size="var(--nue-text-sm)">
                                在 任务界面 中默认使用浮动侧边栏
                            </nue-text>
                            <nue-switch size="small" v-model="isUseFloatTasksAsideDefaultly" />
                        </nue-div>
                        <nue-div align="center" justify="space-between">
                            <nue-text color="gray" size="var(--nue-text-sm)">
                                在 设置界面 中默认使用浮动详情栏
                            </nue-text>
                            <nue-switch size="small" v-model="isUseFloatSettingsAsideDefaultly" />
                        </nue-div>
                    </nue-div>
                </nue-content>
            </nue-main>
        </nue-container>
        <nue-container>
            <nue-header>浮动详情栏偏好设置</nue-header>
            <nue-main>
                <nue-content>
                    <nue-div vertical gap=".5rem">
                        <nue-div align="center" justify="space-between">
                            <nue-text color="gray" size="var(--nue-text-sm)">
                                在 任务界面 中默认使用浮动详情栏
                            </nue-text>
                            <nue-switch size="small" v-model="isUseFloatTasksOutlineDefaultly" />
                        </nue-div>
                    </nue-div>
                </nue-content>
            </nue-main>
        </nue-container>
    </nue-div>
</template>

<style scoped>
.nue-container {
    gap: 0.5rem;

    > .nue-header,
    > .nue-main {
        height: auto;
        padding: 0;
        border: none;
    }
}
</style>
