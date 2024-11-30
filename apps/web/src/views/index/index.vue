<template>
    <nue-container class="index-view" theme="horizontal">
        <nue-header class="index-view__header">
            <template #logo>
                <nue-tooltip content="更新日志" placement="right-center" size="small">
                    <img
                        class="index-view__header__logo"
                        alt="logo"
                        src="/favicon.ico"
                        @click.stop="showUpdateLogDialog"
                    />
                </nue-tooltip>
            </template>
            <template #navigators>
                <nue-div vertical>
                    <nue-tooltip content="任务" placement="right-center" size="small">
                        <nue-link
                            icon="square-check-fill"
                            route="/tasks"
                            theme="index-header-link"
                        />
                    </nue-tooltip>
                    <nue-tooltip content="日历视图" placement="right-center" size="small">
                        <nue-link icon="calendar2" route="/calendar" theme="index-header-link" />
                    </nue-tooltip>
                    <nue-tooltip content="番茄专注" placement="right-center" size="small">
                        <nue-link icon="scan" route="/fqfocus" theme="index-header-link" />
                    </nue-tooltip>
                </nue-div>
            </template>
            <template #actions></template>
            <template #user>
                <user-dropdown
                    :user="user"
                    placement="right-end"
                    @logout="userStore.signOutWithConfirmation"
                    @show-profile="showProfileDialog"
                    @update-passwd="showUpdatePasswordDialog"
                />
            </template>
        </nue-header>
        <nue-main class="index-view__main">
            <router-view />
        </nue-main>
    </nue-container>
    <!-- Dialogs -->
    <update-log-dialog ref="updateLogDialogRef" />
    <user-profile-dialog ref="userProfileDialogRef" />
    <update-password-dialog ref="updatePasswordDialogRef" />
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { UpdateLogDialog, UpdatePasswordDialog } from '@/layers'
import { useUserStore, useViewStore } from '@/stores'
import { UserDropdown } from '@nao-todo/components'
import { UserProfileDialog } from '@/layers/user-profile-dialog'

const userStore = useUserStore()
const viewStore = useViewStore()

await viewStore.indexViewInitTask()

const { user } = storeToRefs(userStore)
const updateLogDialogRef = ref<InstanceType<typeof UpdateLogDialog>>()
const userProfileDialogRef = ref<InstanceType<typeof UserProfileDialog>>()
const updatePasswordDialogRef = ref<InstanceType<typeof UpdatePasswordDialog>>()

const showUpdateLogDialog = () => updateLogDialogRef.value?.show()
const showProfileDialog = () => userProfileDialogRef.value?.show()
const showUpdatePasswordDialog = () => updatePasswordDialogRef.value?.show()
</script>
