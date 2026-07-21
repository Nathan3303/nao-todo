<script setup lang="ts">
import { PasswordRuleHint, RuleHint, t, unwrapError } from '@nao-todo/shared'
import { NueMessage } from 'nue-ui'
import { computed, reactive, ref } from 'vue'
import type { UserRestoreEmits, UserRestoreFormData, UserRestoreProps } from './types'

defineOptions({ name: 'UserRestore' })
const props = defineProps<UserRestoreProps>()
const emits = defineEmits<UserRestoreEmits>()

const loading = ref(false)
const formData = reactive<UserRestoreFormData>({ password: '', agreed: false })

const passwordError = computed(() => {
    if (formData.password.length === 0) return t('user.restorePasswordRequired')
    if (formData.password.length < 8) return t('component.passwordHint.content')
    return ''
})

const agreeError = computed(() => {
    return !formData.agreed ? t('user.restoreAgreeRequired') : ''
})

const submitButtonDisabled = computed(() => {
    return formData.password.length < 8 || !formData.agreed
})

const submit = async () => {
    loading.value = true
    const err = await props.userUseCase.restore({
        password: formData.password,
        agreed: formData.agreed
    })
    loading.value = false
    if (err !== null) {
        NueMessage.error(t('user.restoreFailed') + `(${unwrapError(err)})`)
        return
    }
    NueMessage.success(t('user.restoreSuccess'))
    emits('restored')
}
</script>

<template>
    <nue-container>
        <nue-main>
            <nue-content>
                <nue-div vertical>
                    <rule-hint
                        :title="t('user.restoreWarningTitle')"
                        icon="alert-circle"
                        variant="warning"
                    >
                        {{ t('user.restoreWarningContent') }}
                    </rule-hint>
                    <nue-div theme="form-item">
                        <nue-text theme="label">{{ t('user.deletionDeadline') }}</nue-text>
                        <nue-text theme="value">{{
                            props.deletionDeadline || t('user.deletionDeadlineUnknown')
                        }}</nue-text>
                    </nue-div>
                    <form
                        action=""
                        autocomplete="off"
                        method="post"
                        name="RestoreUserForm"
                        @submit.prevent="submit"
                    >
                        <nue-div align="stretch" vertical>
                            <nue-div theme="form-item">
                                <nue-text theme="label">{{ t('user.password') }}</nue-text>
                                <password-rule-hint />
                                <nue-input
                                    v-model="formData.password"
                                    allow-show-password
                                    clearable
                                    maxlength="24"
                                    :placeholder="t('user.passwordPlaceholder')"
                                    type="password"
                                />
                                <nue-text v-if="passwordError" theme="error">
                                    {{ passwordError }}
                                </nue-text>
                            </nue-div>
                            <nue-div theme="form-item">
                                <nue-checkbox v-model="formData.agreed">
                                    {{ t('user.restoreAgreement') }}
                                </nue-checkbox>
                                <nue-text v-if="agreeError" theme="error">
                                    {{ agreeError }}
                                </nue-text>
                            </nue-div>
                            <nue-div style="margin-top: 0.5rem">
                                <nue-button
                                    :disabled="submitButtonDisabled"
                                    :loading="loading"
                                    theme="primary"
                                    type="submit"
                                >
                                    {{ t('user.restoreSubmit') }}
                                </nue-button>
                            </nue-div>
                        </nue-div>
                    </form>
                </nue-div>
            </nue-content>
        </nue-main>
    </nue-container>
</template>
