<template>
    <nue-container>
        <nue-main>
            <nue-content>
                <nue-div vertical>
                    <rule-hint title="密码安全提醒" icon="scan" variant="warning">
                        为保护您的账号安全，建议您定期更换密码。修改密码后，您需要重新登录才能继续使用应用。
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
                                <nue-text theme="label">旧密码</nue-text>
                                <nue-input
                                    v-model="formData.oldPassword"
                                    allow-show-password
                                    clearable
                                    maxlength="24"
                                    placeholder="请输入旧密码"
                                    type="password"
                                    flex="1"
                                />
                            </nue-div>
                            <nue-div theme="form-item">
                                <nue-text theme="label">新密码</nue-text>
                                <password-rule-hint />
                                <nue-input
                                    v-model="formData.newPassword"
                                    allow-show-password
                                    clearable
                                    maxlength="24"
                                    placeholder="请输入新密码"
                                    type="password"
                                />
                                <nue-input
                                    v-model="formData.confirmNewPassword"
                                    allow-show-password
                                    clearable
                                    maxlength="24"
                                    placeholder="请确认新密码"
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
                                    提交修改
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
import { SETTINGS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import type { SettingsViewContext } from '@/views/index/settings/settings-view'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'

defineOptions({ name: 'SettingsPasswordForm' })

const { userUseCase, authUseCase } = inject<SettingsViewContext>(SETTINGS_VIEW_CONTEXT_KEY)!
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
        NueMessage.error('密码修改失败' + `(${unwrapError(err)})`)
        return
    }
    NueMessage.success('密码修改成功，请重新登录')
    formData.oldPassword = ''
    formData.newPassword = ''
    formData.confirmNewPassword = ''
    await authUseCase.signOut()
    await router.replace('/auth/signin')
}
</script>

