<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useViewSetterStore } from '@/stores/settings'

defineOptions({ name: 'SettingsViewTasks' })

const viewSetterStore = useViewSetterStore()

const { tasksDefaults } = storeToRefs(viewSetterStore)
</script>

<template>
    <nue-div vertical>
        <nue-text>浮动侧边栏偏好设置</nue-text>
        <nue-div vertical>
            <nue-div align="center" gap="2rem">
                <nue-text color="gray" size="var(--nue-text-sm)">默认使用浮动详情栏</nue-text>
                <nue-switch size="small" v-model="tasksDefaults.isUseFloatAside" />
            </nue-div>
            <nue-div align="center" gap="2rem">
                <nue-text color="gray" size="var(--nue-text-sm)">默认使用浮动侧边栏</nue-text>
                <nue-switch size="small" v-model="tasksDefaults.isUseFloatOutline" />
            </nue-div>
        </nue-div>
    </nue-div>
</template>

<style scoped></style>
