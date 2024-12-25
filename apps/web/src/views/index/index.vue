<template>
    <nue-container class="index-view" theme="horizontal">
        <nue-header class="index-view__header">
            <template #logo>
                <user-dropdown
                    :user="user"
                    placement="right-start"
                    @logout="userStore.signOutWithConfirmation"
                    @show-profile="showProfileDialog"
                    @update-passwd="showUpdatePasswordDialog"
                />
            </template>
            <template #navigators>
                <nue-div vertical gap="24px">
                    <nue-tooltip content="任务" placement="right-center" size="small">
                        <nue-link
                            icon="square-check-fill"
                            route="/tasks"
                            theme="index-header-link"
                        />
                    </nue-tooltip>
                    <nue-tooltip content="日历视图" placement="right-center" size="small">
                        <nue-link icon="calendar" route="/calendar" theme="index-header-link" />
                    </nue-tooltip>
                    <nue-tooltip content="番茄专注" placement="right-center" size="small">
                        <nue-link icon="focus2" route="/fqfocus" theme="index-header-link" />
                    </nue-tooltip>
                    <nue-tooltip content="搜索" placement="right-center" size="small">
                        <nue-link icon="search2" route="/search" theme="index-header-link" />
                    </nue-tooltip>
                </nue-div>
            </template>
            <template #actions></template>
            <template #user></template>
        </nue-header>
        <nue-main class="index-view__main">
            <router-view />
        </nue-main>
    </nue-container>
    <!-- Dialogs -->
    <user-profile-dialog ref="userProfileDialogRef" />
    <update-password-dialog ref="updatePasswordDialogRef" />
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { UpdatePasswordDialog } from '@/layers'
import { useUserStore, useViewStore } from '@/stores'
import { UserDropdown } from '@nao-todo/components'
import { UserProfileDialog } from '@/layers/user-profile-dialog'

const userStore = useUserStore()
const viewStore = useViewStore()

await viewStore.indexViewInitTask()

const { user } = storeToRefs(userStore)
const userProfileDialogRef = ref<InstanceType<typeof UserProfileDialog>>()
const updatePasswordDialogRef = ref<InstanceType<typeof UpdatePasswordDialog>>()

const showProfileDialog = () => userProfileDialogRef.value?.show()
const showUpdatePasswordDialog = () => updatePasswordDialogRef.value?.show()
</script>
