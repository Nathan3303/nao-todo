<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useSettingsViewStore } from '@/stores/settings'

defineOptions({ name: 'SettingsSmartlist' })

const settingsViewStore = useSettingsViewStore()

const { isDisplayAside, tasksAsideNavLinkVisible } = storeToRefs(settingsViewStore)

const hideAsideButtonIcon = computed(() => {
    return (isDisplayAside.value ? 'menu-close' : 'menu-open') as never
})
</script>

<template>
    <nue-container id="SettingsSmartlistContainer">
        <nue-header>
            <nue-button
                :icon="hideAsideButtonIcon"
                theme="icon,ghost"
                @click="settingsViewStore.switchIsDisplayAside"
            />
            <nue-text>智能列表</nue-text>
        </nue-header>
        <nue-main>
            <nue-content fill>
                <nue-div theme="area">
                    <nue-div theme="row">
                        <nue-icon name="more2"></nue-icon>
                        <nue-text>所有</nue-text>
                        <nue-switch v-model="tasksAsideNavLinkVisible.all" theme="small" />
                    </nue-div>
                    <nue-div theme="row">
                        <nue-icon name="calendar2"></nue-icon>
                        <nue-text>今天</nue-text>
                        <nue-switch v-model="tasksAsideNavLinkVisible.today" theme="small" />
                    </nue-div>
                    <nue-div theme="row">
                        <nue-icon name="tomorrow2"></nue-icon>
                        <nue-text>明天</nue-text>
                        <nue-switch v-model="tasksAsideNavLinkVisible.tomorrow" theme="small" />
                    </nue-div>
                    <nue-div theme="row">
                        <nue-icon name="week3"></nue-icon>
                        <nue-text>本周</nue-text>
                        <nue-switch v-model="tasksAsideNavLinkVisible.week" theme="small" />
                    </nue-div>
                    <nue-div theme="row">
                        <nue-icon name="inbox"></nue-icon>
                        <nue-text>收集箱</nue-text>
                        <nue-switch v-model="tasksAsideNavLinkVisible.inbox" theme="small" />
                    </nue-div>
                </nue-div>
                <nue-divider />
                <nue-div theme="area">
                    <nue-div theme="row">
                        <nue-icon name="filter"></nue-icon>
                        <nue-text>过滤器（收起与展开）</nue-text>
                        <nue-switch v-model="tasksAsideNavLinkVisible.filter" theme="small" />
                    </nue-div>
                </nue-div>
                <nue-divider />
                <nue-div theme="area">
                    <nue-div theme="row">
                        <nue-icon name="time"></nue-icon>
                        <nue-text>已过期</nue-text>
                        <nue-switch v-model="tasksAsideNavLinkVisible.overdue" theme="small" />
                    </nue-div>
                    <nue-div theme="row">
                        <nue-icon name="heart"></nue-icon>
                        <nue-text>已收藏</nue-text>
                        <nue-switch v-model="tasksAsideNavLinkVisible.favorite" theme="small" />
                    </nue-div>
                    <nue-div theme="row">
                        <nue-icon name="delete"></nue-icon>
                        <nue-text>垃圾桶</nue-text>
                        <nue-switch v-model="tasksAsideNavLinkVisible.deleted" theme="small" />
                    </nue-div>
                </nue-div>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped>
#SettingsSmartlistContainer {
    > .nue-main .nue-content {
        display: flex;
        flex-direction: column;
        padding: 1rem;
        gap: 1rem;

        .nue-div--area {
            flex-direction: column;
            padding: 0.625rem;

            .nue-div--row {
                align-items: center;
                color: var(--nue-primary-color-800);
                gap: 0.5rem;

                .nue-icon {
                    --nue-icon-size: var(--nue-text-md);
                }

                .nue-text {
                    flex: 1;
                }
            }
        }
    }
}
</style>
