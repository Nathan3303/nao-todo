<script setup lang="ts">
import {
    type DialogManager,
    t,
    USER_DEACTIVE_DIALOG_KEY,
    USER_RESTORE_DIALOG_KEY
} from '@nao-todo/shared'
import { NueConfirm } from 'nue-ui'
import { storeToRefs } from 'pinia'
import { useUserStore } from '../../stores'

defineOptions({ name: 'UserDeactiveManager' })
const props = defineProps<{ dialogManager: DialogManager }>()

const userStore = useUserStore()
const { profile } = storeToRefs(userStore)

const handleDeactive = async () => {
    const [isByCancel] = await NueConfirm({
        title: t('user.deactiveConfirmTitle'),
        content: t('user.deactiveConfirmContent'),
        confirmButtonText: t('user.deactiveConfirmButton'),
        cancelButtonText: t('common.cancel')
    })
    if (isByCancel) return
    props.dialogManager.open(USER_DEACTIVE_DIALOG_KEY)
}

const handleRestore = async () => {
    props.dialogManager.open(USER_RESTORE_DIALOG_KEY)
}
</script>

<template>
    <nue-div v-if="!profile.deactivedAt" theme="deactive-user">
        <nue-div theme="title">
            <nue-text>{{ t('user.deactiveWarningTitle') }}</nue-text>
            <nue-text size="xs">{{ t('user.deactiveWarningContent') }}</nue-text>
        </nue-div>
        <nue-button
            :disabled="profile.isInDeactiveCooldown"
            @click="handleDeactive"
            icon="delete"
            theme="danger"
        >
            {{ t('user.deactiveWarningTitle') }}
        </nue-button>
    </nue-div>
    <nue-div v-else theme="restore-user">
        <nue-div theme="title">
            <nue-text>恢复账户</nue-text>
            <nue-text size="xs">{{ t('user.restoreWarningContent') }}</nue-text>
        </nue-div>
        <nue-button
            :disabled="profile.isInDeactiveCooldown"
            @click="handleRestore"
            icon="restore"
            theme="danger"
        >
            {{ t('user.restoreWarningTitle') }}
        </nue-button>
    </nue-div>
</template>

<style scoped>
.nue-div--deactive-user,
.nue-div--restore-user {
    /* color: var(--nue-error-color-50); */
    align-items: center;
    justify-content: space-between;
    gap: 3rem;
    /* font-weight: bold; */

    .nue-div--title {
        flex-direction: column;
        gap: var(--nue-gap-2xs);
        flex: auto;
    }
}
</style>

