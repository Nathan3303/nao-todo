<template>
    <nue-container theme="horizontal">
        <nue-header>
            <template #logo>
                <nue-tooltip content="更新日志" placement="right-center" size="small">
                    <img alt="logo" src="/favicon.ico" @click.stop="showUpdateLogDialog" />
                </nue-tooltip>
            </template>
            <template #navigators>
                <nue-tooltip content="任务" placement="right-center" size="small">
                    <nue-link icon="square-check-fill" route="/tasks" theme="btnlike" />
                </nue-tooltip>
                <nue-tooltip content="日历视图" placement="right-center" size="small">
                    <nue-link icon="calendar2" route="/calendar" theme="btnlike" />
                </nue-tooltip>
                <nue-tooltip content="番茄专注" placement="right-center" size="small">
                    <nue-link icon="scan" route="/fqfocus" theme="btnlike" />
                </nue-tooltip>
            </template>
            <template #actions>
                <nue-tooltip content="设置" placement="right-center" size="small">
                    <nue-link icon="setting" theme="btnlike" />
                </nue-tooltip>
            </template>
            <template #user>
                <user-dropdown
                    :user="user"
                    placement="right-end"
                    @logout="userStore.signOutWithConfirmation"
                    @show-profile="showProfileDialog"
                />
            </template>
        </nue-header>
        <router-view />
    </nue-container>
    <!-- Dialogs -->
    <update-log-dialog ref="updateLogDialogRef" />
    <user-profile-dialog ref="userProfileDialogRef" />
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { UpdateLogDialog } from '@/layers'
import { useUserStore, useViewStore } from '@/stores'
import { UserDropdown } from '@nao-todo/components'
import { UserProfileDialog } from '@/layers/user-profile-dialog'

const userStore = useUserStore()
const viewStore = useViewStore()

await viewStore.indexViewInitTask()

const { user } = storeToRefs(userStore)
const updateLogDialogRef = ref<InstanceType<typeof UpdateLogDialog>>()
const userProfileDialogRef = ref<InstanceType<typeof UserProfileDialog>>()

const showUpdateLogDialog = () => updateLogDialogRef.value?.show()

const showProfileDialog = () => {
    userProfileDialogRef.value?.show()
}
</script>

<style scoped>
.nue-header {
    &:deep(.nue-header__logo img) {
        width: 24px;
        height: 24px;
    }

    &:deep(.nue-header__navigators),
    &:deep(.nue-header__actions) {
        & .nue-link--btnlike {
            --font-size: 18px;
        }
    }
}
</style>
