<script setup lang="ts">
import { PasswordRuleHint, RuleHint, t, unwrapError } from '@nao-todo/shared'
import { NueInput, NueMessage } from 'nue-ui'
import { computed, onMounted, reactive, ref } from 'vue'
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

// @autocomplete 改密表单语义隔离（防浏览器凭据自动填充误判为登录表单，见 SHELL-01-DEF-01）：
// 旧密码 = current-password；新密码/确认 = new-password。nue-input 不透传 autocomplete
// 至内层 input，经暴露的 innerInputRef 设于真实输入元素。
const oldPasswordInput = ref<InstanceType<typeof NueInput>>()
const newPasswordInput = ref<InstanceType<typeof NueInput>>()
const confirmPasswordInput = ref<InstanceType<typeof NueInput>>()
onMounted(() => {
    oldPasswordInput.value?.innerInputRef?.setAttribute('autocomplete', 'current-password')
    newPasswordInput.value?.innerInputRef?.setAttribute('autocomplete', 'new-password')
    confirmPasswordInput.value?.innerInputRef?.setAttribute('autocomplete', 'new-password')
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
                    <nue-div align="stretch" vertical>
                        <nue-div theme="form-item">
                            <nue-text theme="label">{{ t('settings.passwordOld') }}</nue-text>
                            <nue-input
                                ref="oldPasswordInput"
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
                            <nue-input
                                ref="newPasswordInput"
                                v-model="formData.newPassword"
                                allow-show-password
                                clearable
                                maxlength="24"
                                :placeholder="t('settings.passwordNewPlaceholder')"
                                type="password"
                            />
                            <password-rule-hint />
                            <nue-input
                                ref="confirmPasswordInput"
                                v-model="formData.confirmNewPassword"
                                allow-show-password
                                clearable
                                maxlength="24"
                                :placeholder="t('settings.passwordConfirmPlaceholder')"
                                type="password"
                            />
                        </nue-div>
                        <rule-hint :title="t('settings.passwordHintTitle')" variant="warning">
                            {{ t('settings.passwordHintContent') }}
                        </rule-hint>
                        <nue-button
                            :disabled="submitButtonDisabled"
                            :loading="loading"
                            theme="primary"
                            @click="submit"
                        >
                            {{ t('settings.passwordSubmit') }}
                        </nue-button>
                    </nue-div>
                </nue-div>
            </nue-content>
        </nue-main>
    </nue-container>
</template>