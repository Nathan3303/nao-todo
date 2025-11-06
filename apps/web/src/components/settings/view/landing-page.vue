<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { GlobalAsideNavItems } from '@/stores/global/constants'
import { useViewSetterStore } from '@/stores/settings'

defineOptions({ name: 'SettingsViewLandingPage' })

// @stores 视图设置 store
const viewSetterStore = useViewSetterStore()

// @state 用户偏好中的默认落地页
const { landingPage } = storeToRefs(viewSetterStore)

// @state 默认落地页
const landingPageOptions = GlobalAsideNavItems.map((item) => ({
    icon: item.icon,
    label: item.name,
    value: item.routeName
}))
</script>

<template>
    <nue-div theme="card" vertical>
        <nue-div vertical gap=".5rem">
            <nue-div align="start" justify="space-between" gap="2rem">
                <nue-div vertical gap=".25rem">
                    <nue-text color="var(--nue-primary-color-800)" size="var(--nue-text-df)">
                        落地页设置
                    </nue-text>
                    <nue-text color="var(--nue-primary-color-500)" size="var(--nue-text-xs)">
                        设置访问应用时默认跳转的页面。
                    </nue-text>
                </nue-div>
                <nue-select v-model="landingPage" size="small" placement="bottom-end">
                    <nue-select-option
                        v-for="item in landingPageOptions"
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
