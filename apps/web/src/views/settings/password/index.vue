<template>
    <nue-container theme="vertical,inner">
        <nue-header>
            <nue-text>设置 - 修改密码</nue-text>
        </nue-header>
        <nue-main>
            <template #default>
                <form action="" autocomplete="off" method="post" name="UpdatePasswordForm">
                    <nue-div align="stretch" vertical>
                        <nue-div class="settings-view__form-row">
                            <nue-text color="gray" size=".875rem">旧密码</nue-text>
                            <nue-input
                                v-model="oldPassword"
                                allow-show-password
                                clearable
                                maxlength="24"
                                placeholder="请输入旧密码"
                                type="password"
                                flex="1"
                            />
                            <nue-link style="font-size: 0.8rem">忘记了旧的密码？</nue-link>
                        </nue-div>
                        <nue-div class="settings-view__form-row">
                            <nue-text color="gray" size=".875rem">新密码</nue-text>
                            <nue-text color="#999" size=".75rem">
                                密码格式要求长度为 8 - 24 位，且包含字母、数字以及特殊符号。<br />
                                允许的特殊符号包括：
                                <nue-text color="orange" weight="bold" size=".75rem">
                                    ! @ # $ % ^ & * ? .
                                </nue-text>
                            </nue-text>
                        </nue-div>
                        <nue-div class="settings-view__form-row">
                            <nue-input
                                v-model="password"
                                allow-show-password
                                clearable
                                maxlength="24"
                                placeholder="请输入新密码"
                                type="password"
                            />
                            <nue-input
                                v-model="confirmPassword"
                                allow-show-password
                                clearable
                                maxlength="24"
                                placeholder="请确认新密码"
                                type="password"
                            />
                        </nue-div>
                        <nue-div style="margin-top: 0.5rem">
                            <nue-button
                                :disabled="!oldPassword || !password || !confirmPassword"
                                :loading="loading"
                                theme="primary"
                                @click.stop="handleUpdatePassword"
                            >
                                提交修改
                            </nue-button>
                        </nue-div>
                    </nue-div>
                </form>
            </template>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '@/stores'
import { NueMessage } from 'nue-ui'

defineOptions({ name: 'UpdatePasswordDialog' })

const userStore = useUserStore()

const oldPassword = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const matchPattern = /^\S*(?=\S{8})(?=\S*\d)(?=\S*[a-z])(?=\S*[!@#$%^&*?.])\S*$/

const handleUpdatePassword = async () => {
    // console.log('[UpdatePasswordDialog]', password.value, confirmPassword.value)
    if (
        oldPassword.value.length < 8 ||
        oldPassword.value.length > 24 ||
        !RegExp(matchPattern).test(oldPassword.value)
    ) {
        NueMessage.warn('旧密码错误')
        return
    } else if (password.value.length < 8 || password.value.length > 24) {
        NueMessage.warn('新密码格式有误，需要 8 至 24 位的长度')
        return
    } else if (!RegExp(matchPattern).test(password.value)) {
        NueMessage.warn('新密码格式有误，需要包含字母、数字以及特殊符号')
        return
    } else if (password.value !== confirmPassword.value) {
        NueMessage.warn('新密码的两次输入不一致')
        return
    }
    const result = await userStore.updatePasswordWithConfirmation(
        oldPassword.value,
        confirmPassword.value
    )
    if (result) {
        oldPassword.value = password.value = confirmPassword.value = ''
    } else {
        oldPassword.value = ''
    }
}
</script>

<style scoped></style>
