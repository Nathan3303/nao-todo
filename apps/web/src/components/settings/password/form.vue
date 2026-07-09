<template>
    <nue-container>
        <nue-main>
            <nue-content>
                <nue-div vertical>
                    <rule-hint :title="t('settings.passwordHintTitle')" icon="scan" variant="warning">
                        {{ t('settings.passwordHintContent') }}
                    </rule-hint>
                    <form
                        action=""
                        autocomplete="off"
                        method="post"
                        name="UpdatePasswordForm"
                        @submit.prevent="handleSubmit"
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

<script setup lang="ts">
import { reactive, computed, ref, inject } from 'vue'
import { useRouter } from 'vue-router'
import { PasswordRuleHint, RuleHint } from '@nao-todo/components'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import { t } from '@nao-todo/infrastructure/locales'
import { SETTINGS_VIEW_CONTEXT_KEY } from '@/views/index/settings/context'

defineOptions({ name: 'SettingsPasswordForm' })

const { userUseCase, authUseCase } = inject(SETTINGS_VIEW_CONTEXT_KEY)!
const router = useRouter()

const formData = reactive({
    oldPassword: '',
    newPassword: '',
    confirmNewPassword: ''
})

const loading = ref(false)

const submitButtonDisabled = computed(() => {
    return (
        formData.oldPassword.length < 8 ||
        formData.newPassword.length < 8 ||
        formData.confirmNewPassword.length < 8 ||
        formData.newPassword !== formData.confirmNewPassword
    )
})

const handleSubmit = async () => {
    loading.value = true
    const err = await userUseCase.updatePassword({
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
    await authUseCase.signOut()
    await router.replace('/auth/signin')
}
</script>
