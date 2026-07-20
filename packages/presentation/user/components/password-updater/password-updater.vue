<script setup lang="ts">
import { PasswordRuleHint, RuleHint, t, unwrapError } from '@nao-todo/shared'
import { NueMessage } from 'nue-ui'
import { computed, reactive, ref } from 'vue'
import type {
    UserPasswordUpdaterEmits,
    UserPasswordUpdaterFormData,
    UserPasswordUpdaterProps
} from './types'

defineOptions({ name: 'SettingsPasswordForm' })
const props = defineProps<UserPasswordUpdaterProps>()
const emits = defineEmits<UserPasswordUpdaterEmits>()

const loading = ref(false)
const formData = reactive<UserPasswordUpdaterFormData>({
    oldPassword: '',
    newPassword: '',
    confirmNewPassword: ''
})

const submitButtonDisabled = computed(() => {
    return (
        formData.oldPassword.length < 8 ||
        formData.newPassword.length < 8 ||
        formData.confirmNewPassword.length < 8 ||
        formData.newPassword !== formData.confirmNewPassword
    )
})

const submit = async () => {
    loading.value = true
    const err = await props.userUseCase.updatePassword({
        password: formData.oldPassword,
        confirmNewPassword: formData.confirmNewPassword,
        newPassword: formData.newPassword
    })
    loading.value = false
    if (err !== null) {
        NueMessage.error(t('settings.passwordChangeFailed') + `(${unwrapError(err)})`)
        return
    }
    NueMessage.success(t('settings.passwordChangeSuccess'))
    formData.oldPassword = ''
    formData.newPassword = ''
    formData.confirmNewPassword = ''
    emits('signOut')
}
</script>

<template>
    <nue-container>
        <nue-main>
            <nue-content>
                <nue-div vertical>
                    <rule-hint
                        :title="t('settings.passwordHintTitle')"
                        icon="scan"
                        variant="warning"
                    >
                        {{ t('settings.passwordHintContent') }}
                    </rule-hint>
                    <form
                        action=""
                        autocomplete="off"
                        method="post"
                        name="UpdatePasswordForm"
                        @submit.prevent="submit"
                    >
                        <nue-div align="stretch" vertical>
                            <nue-div theme="form-item">
                                <nue-text theme="label">{{ t('settings.passwordOld') }}</nue-text>
                                <nue-input
                                    v-model="formData.oldPassword"
                                    allow-show-password
                                    clearable
                                    maxlength="24"
                                    :placeholder="t('settings.passwordOldPlaceholder')"
                                    type="password"
                                    flex="1"
                                />
                            </nue-div>
                            <nue-div theme="form-item">
                                <nue-text theme="label">{{ t('settings.passwordNew') }}</nue-text>
                                <password-rule-hint />
                                <nue-input
                                    v-model="formData.newPassword"
                                    allow-show-password
                                    clearable
                                    maxlength="24"
                                    :placeholder="t('settings.passwordNewPlaceholder')"
                                    type="password"
                                />
                                <nue-input
                                    v-model="formData.confirmNewPassword"
                                    allow-show-password
                                    clearable
                                    maxlength="24"
                                    :placeholder="t('settings.passwordConfirmPlaceholder')"
                                    type="password"
                                />
                            </nue-div>
                            <nue-div style="margin-top: 0.5rem">
                                <nue-button
                                    :disabled="submitButtonDisabled"
                                    :loading="loading"
                                    theme="primary"
                                    type="submit"
                                >
                                    {{ t('settings.passwordSubmit') }}
                                </nue-button>
                            </nue-div>
                        </nue-div>
                    </form>
                </nue-div>
            </nue-content>
        </nue-main>
    </nue-container>
</template>
