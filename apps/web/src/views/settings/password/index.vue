<template>
    <nue-container theme="vertical,inner">
        <nue-header>
            <nue-text>设置 - 修改密码</nue-text>
        </nue-header>
        <nue-main>
            <template #default>
                <form action="" autocomplete="off" method="post" name="UpdatePasswordForm">
                    <nue-div align="stretch" vertical>
                        <nue-div align="stretch" vertical>
                            <nue-text color="gray" size="12px">
                                在下方输入旧密码，验证是否为当前用户。
                            </nue-text>
                            <nue-input
                                v-model="oldPassword"
                                allow-show-password
                                clearable
                                maxlength="16"
                                placeholder="旧密码"
                                type="password"
                            />
                            <nue-link style="font-size: 0.8rem">忘记了旧的密码？</nue-link>
                        </nue-div>
                        <nue-divider />
                        <nue-div gap="8px" vertical>
                            <nue-text color="gray" size="12px">
                                在下方输入新密码两次，点击修改按钮提交修改。
                            </nue-text>
                            <nue-text color="gray" size="12px">
                                密码格式要求长度为 8 - 24
                                位，且包含字母、数字以及特殊符号。（特殊符号包括：! @ # $ % ^ & * ?
                                . ）
                            </nue-text>
                        </nue-div>
                        <nue-div align="stretch" vertical>
                            <nue-input
                                v-model="password"
                                allow-show-password
                                clearable
                                maxlength="16"
                                placeholder="新密码"
                                type="password"
                            />
                            <nue-input
                                v-model="confirmPassword"
                                allow-show-password
                                clearable
                                maxlength="16"
                                placeholder="确认新密码"
                                type="password"
                            />
                        </nue-div>
                        <nue-divider />
                        <nue-div>
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
    await userStore.updatePasswordWithConfirmation(confirmPassword.value)
    oldPassword.value = password.value = confirmPassword.value = ''
}
</script>

<style scoped></style>
