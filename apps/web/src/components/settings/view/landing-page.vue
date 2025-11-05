<script setup lang="ts">
import { computed } from 'vue'
import { basicViewProps } from '@/stores/tasks/constants'
import { useViewSetterStore } from '@/stores/settings'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'SettingsViewLandingPage' })

// @stores 视图设置 store
const viewSetterStore = useViewSetterStore()
const { landingPage: userLandingPage } = storeToRefs(viewSetterStore)

// @state 默认落地页
const defaultLandingPages = { tasks: 'all' }

const landingPage = computed({
    get: () => userLandingPage.value || defaultLandingPages,
    set: (newValue) => (userLandingPage.value = newValue)
})
const tasksLandingPageOptions = basicViewProps.map((item) => {
    return { icon: item.icon, label: item.name, value: item.id }
})
</script>

<template>
    <nue-div theme="card" vertical>
        <nue-text size="var(--nue-text-md)">设置默认初始页</nue-text>
        <nue-divider />
        <nue-div vertical gap=".5rem">
            <nue-div align="start" justify="space-between" gap="2rem">
                <nue-div vertical gap=".25rem">
                    <nue-text color="var(--nue-primary-color-800)" size="var(--nue-text-df)">
                        任务界面默认初始页
                    </nue-text>
                    <nue-text color="var(--nue-primary-color-500)" size="var(--nue-text-xs)">
                        设置当用户访问任务界面时，默认跳转显示的页面。
                    </nue-text>
                </nue-div>
                <nue-select v-model="landingPage.tasks" size="small" placement="bottom-end">
                    <nue-select-option
                        v-for="item in tasksLandingPageOptions"
                        :key="item.value"
                        :value="item.value"
                        :label="item.label"
                    >
                        {{ item.label }}
                    </nue-select-option>
                </nue-select>
            </nue-div>
        </nue-div>
    </nue-div>
</template>

<style scoped>
.nue-container {
    > .nue-header,
    > .nue-main {
        height: auto;
        padding: 0.875rem 0;
    }
}
</style>
