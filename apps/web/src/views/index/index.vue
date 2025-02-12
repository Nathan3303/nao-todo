<template>
    <nue-container class="index-view" theme="horizontal">
        <nue-header
            v-if="viewStore.indexHeaderVisible"
            class="index-view__header"
        >
            <template #logo>
                <user-dropdown
                    :user="user"
                    placement="right-start"
                    @logout="userStore.signOutWithConfirmation"
                    @show-profile="userProfileDialogRef?.show"
                    @update-passwd="updatePasswordDialogRef?.show"
                />
            </template>
            <template #navigators>
                <nue-div vertical gap="24px">
                    <nue-tooltip
                        content="任务"
                        placement="right-center"
                        size="small"
                    >
                        <nue-link
                            icon="square-check-fill"
                            route="/tasks"
                            theme="index-header-link"
                        />
                    </nue-tooltip>
                    <nue-tooltip
                        content="日历视图"
                        placement="right-center"
                        size="small"
                    >
                        <nue-link
                            icon="calendar"
                            route="/calendar"
                            theme="index-header-link"
                        />
                    </nue-tooltip>
                    <nue-tooltip
                        content="番茄专注"
                        placement="right-center"
                        size="small"
                    >
                        <nue-link
                            icon="focus2"
                            route="/fqfocus"
                            theme="index-header-link"
                        />
                    </nue-tooltip>
                    <nue-tooltip
                        content="搜索"
                        placement="right-center"
                        size="small"
                    >
                        <nue-link
                            icon="search2"
                            route="/search"
                            theme="index-header-link"
                        />
                    </nue-tooltip>
                    <nue-tooltip
                        content="对话大模型"
                        placement="right-center"
                        size="small"
                    >
                        <nue-link
                            icon="chat"
                            route="/ai"
                            theme="index-header-link"
                        />
                    </nue-tooltip>
                </nue-div>
            </template>
        </nue-header>
        <nue-main class="index-view__main">
            <router-view />
            <!-- Index aside (For mobile device) -->
            <nue-drawer
                v-if="!viewStore.projectAsideVisible"
                v-model:visible="viewStore.indexAsideVisible"
                class="nue-drawer--no-header"
                min-span="240px"
                open-from="left"
                span="260px"
            >
                <index-aside />
            </nue-drawer>
        </nue-main>
    </nue-container>
    <!-- Dialogs -->
    <user-profile-dialog ref="userProfileDialogRef" />
    <update-password-dialog ref="updatePasswordDialogRef" />
</template>

<script lang="ts" setup>
import { provide, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { UpdatePasswordDialog, IndexAside } from '@/layers'
import { useUserStore, useViewStore } from '@/stores'
import { UserDropdown } from '@nao-todo/components'
import { UserProfileDialog } from '@/layers/user-profile-dialog'
import {
    type IndexViewCtx,
    IndexViewCtxKey
} from '@nao-todo/types/views/index-view'

const userStore = useUserStore()
const viewStore = useViewStore()

await viewStore.indexViewInitTask()

const { user } = storeToRefs(userStore)
const userProfileDialogRef = ref<InstanceType<typeof UserProfileDialog>>()
const updatePasswordDialogRef = ref<InstanceType<typeof UpdatePasswordDialog>>()

provide<IndexViewCtx>(IndexViewCtxKey, {
    dialogsRef: {
        userProfile: userProfileDialogRef,
        updatePassword: updatePasswordDialogRef
    }
})
</script>
