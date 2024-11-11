<template>
    <nue-container theme="horizontal">
        <nue-header>
            <template #logo>
                <nue-tooltip size="small" content="更新日志" placement="right-center">
                    <img src="/favicon.ico" alt="logo" @click.stop="showUpdateLogDialog" />
                </nue-tooltip>
            </template>
            <template #navigators>
                <nue-tooltip size="small" content="任务" placement="right-center">
                    <nue-link theme="btnlike" icon="square-check-fill" route="/tasks" />
                </nue-tooltip>
                <nue-tooltip size="small" content="日历视图" placement="right-center">
                    <nue-link theme="btnlike" icon="calendar2" route="/calendar" />
                </nue-tooltip>
                <nue-tooltip size="small" content="番茄专注" placement="right-center">
                    <nue-link theme="btnlike" icon="scan" route="/fqfocus" />
                </nue-tooltip>
            </template>
            <template #user>
                <user-dropdown :user="user" @logout="signoutWithComfirmation" />
            </template>
        </nue-header>
        <router-view></router-view>
    </nue-container>
    <!-- Dialogs -->
    <update-log-dialog ref="updateLogDialogRef" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { UpdateLogDialog } from '@/layers'
import { useUserStore, useViewStore } from '@/stores'
import { UserDropdown } from '@nao-todo/components'
import { signoutWithComfirmation } from '@/handlers/auth'

const userStore = useUserStore()
const viewStore = useViewStore()

await viewStore.indexViewInitTask()

const { user } = storeToRefs(userStore)
const updateLogDialogRef = ref<InstanceType<typeof UpdateLogDialog>>()

const showUpdateLogDialog = () => updateLogDialogRef.value?.show()
</script>

<style scoped>
.nue-header {
    &:deep(.nue-header__logo img) {
        width: 24px;
        height: 24px;
    }

    &:deep(.nue-header__navigators) {
        & .nue-link--btnlike {
            --font-size: 18px;
        }
    }
}
</style>
