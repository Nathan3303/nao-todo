<script setup lang="ts">
import {
    type DialogInstanceType,
    RuleHint,
    t,
    useDialogWrapper,
    USER_RESTORE_DIALOG_KEY
} from '@nao-todo/shared'
import dayjs from 'dayjs'
import { onMounted, ref } from 'vue'
import type { UserRestoreEmits, UserRestoreProps } from './types'
import { useRestoreUserDialog } from './use-restore-user'
import { useUserStore } from '../../../stores'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'UserRestoreDialog' })
const props = defineProps<UserRestoreProps>()
const emits = defineEmits<UserRestoreEmits>()

const dialogRef = ref<DialogInstanceType>()
const { visible, close } = useDialogWrapper(dialogRef)
const { loading, formData, submitButtonDisabled, submit } = useRestoreUserDialog(
    props,
    emits,
    close
)
const userDeletionStore = useUserStore()
const { userDeletion } = storeToRefs(userDeletionStore)

const open = () => (visible.value = true)

const cancel = () => {
    emits('confirm-unrestore')
    close()
}

onMounted(() => {
    props.dialogManager.register(USER_RESTORE_DIALOG_KEY, { open, close })
})
</script>

<template>
    <nue-dialog ref="dialogRef" v-model="visible" title="恢复账户">
        <nue-container theme="restore-user">
            <nue-main>
                <nue-content>
                    <nue-div vertical gap=".75rem" style="width: 100%; max-width: 28rem">
                        <rule-hint :title="t('user.deletionDeadline')" variant="error">
                            数据将于
                            {{
                                dayjs(userDeletion.deadline)
                                    .add(7, 'days')
                                    .format('YYYY年MM月DD日HH时mm分') ||
                                t('user.deletionDeadlineUnknown')
                            }}
                            删除
                        </rule-hint>
                        <nue-divider />
                        <nue-div vertical gap=".25rem" theme="form-item">
                            <nue-text theme="label">{{ t('user.password') }}</nue-text>
                            <nue-input
                                v-model="formData.password"
                                allow-show-password
                                clearable
                                maxlength="24"
                                :placeholder="t('user.passwordPlaceholder')"
                                type="password"
                            />
                        </nue-div>
                        <rule-hint :title="t('user.restoreWarningTitle')" icon="" variant="warning">
                            {{ t('user.restoreWarningContent') }}
                        </rule-hint>
                        <nue-checkbox theme="pure" v-model="formData.agreed">
                            {{ t('user.restoreAgreement') }}
                        </nue-checkbox>
                        <nue-button
                            :disabled="submitButtonDisabled"
                            :loading="loading"
                            theme="primary"
                            @click="submit"
                        >
                            {{ t('user.restoreSubmit') }}
                        </nue-button>
                        <nue-button @click="cancel">{{ t('user.cancelRestore') }}</nue-button>
                    </nue-div>
                </nue-content>
            </nue-main>
        </nue-container>
    </nue-dialog>
</template>

<style scoped>
.nue-container--restore-user > .nue-main {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100%;
}

.nue-container--restore-user .nue-content {
    width: 100%;
    max-width: 20rem;
    flex: none;

    .nue-checkbox--pure {
        padding: 0;
    }

    form {
        display: flex;
        flex-direction: column;
        gap: var(--nue-gap-sm);
    }
}
</style>

