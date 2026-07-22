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
    <template v-if="!profile.deactivedAt">
        <nue-div justify="space-between" gap="3rem">
            <nue-text size="xs">{{ t('user.deactiveWarningContent') }}</nue-text>
            <nue-button @click="handleDeactive" icon="delete" theme="small,danger">
                {{ t('user.deactiveWarningTitle') }}
            </nue-button>
        </nue-div>
    </template>
    <template v-else>
        <nue-div justify="space-between" gap="3rem">
            <nue-text size="xs">{{ t('user.restoreWarningContent') }}</nue-text>
            <nue-button @click="handleRestore" icon="delete" theme="small,secondary">
                {{ t('user.restoreWarningTitle') }}
            </nue-button>
        </nue-div>
    </template>
</template>

<style scoped></style>

