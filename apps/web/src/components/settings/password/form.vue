<template>
    <nue-container>
        <nue-header>修改密码</nue-header>
        <nue-main>
            <nue-content>
                <form action="" autocomplete="off" method="post" name="UpdatePasswordForm">
                    <nue-div align="stretch" vertical>
                        <nue-div theme="form-item">
                            <nue-text theme="label">旧密码</nue-text>
                            <nue-input
                                v-model="passwordVO.oldPassword"
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
                                v-model="passwordVO.newPassword"
                                allow-show-password
                                clearable
                                maxlength="24"
                                placeholder="请输入新密码"
                                type="password"
                            />
                            <nue-input
                                v-model="passwordVO.confirmNewPassword"
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
                                :loading="passwordVO.loading"
                                theme="primary"
                                @click.stop="passwordStore.handleUpdatePassword"
                            >
                                提交修改
                            </nue-button>
                        </nue-div>
                    </nue-div>
                </form>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { usePasswordStore } from '@/stores/settings'
import { PasswordRuleHint } from '@/components/ui'

defineOptions({ name: 'SettingsPasswordForm' })

const passwordStore = usePasswordStore()

const { passwordVO, submitButtonDisabled } = storeToRefs(passwordStore)
</script>

<style scoped>
.nue-container {
    > .nue-header,
    > .nue-main {
        height: auto;
        padding: 0.875rem 0;
    }
}
</style>
