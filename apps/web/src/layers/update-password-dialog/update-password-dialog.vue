<template>
    <nue-dialog v-model="visible" title="修改密码">
        <template #default>
            <nue-div align="stretch" vertical>
                <nue-div gap="8px" vertical>
                    <nue-text color="gray" size="12px">
                        在下方输入新密码两次，点击修改按钮提交修改。
                    </nue-text>
                    <nue-text color="gray" size="12px">
                        密码格式要求长度为 8 - 24
                        位，且包含字母、数字以及特殊符号。（特殊符号包括：! @ # $ % ^ & * ? . ）
                    </nue-text>
                </nue-div>
                <form action="" autocomplete="off" method="post" name="UpdatePasswordForm">
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
                </form>
            </nue-div>
        </template>
        <template #footer>
            <nue-button :disabled="loading" @click.stop="handleHideDialog">取消</nue-button>
            <nue-button :loading="loading" theme="primary" @click.stop="handleUpdatePassword">
                修改
            </nue-button>
        </template>
    </nue-dialog>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useUserStore } from '@/stores'
import { NueMessage } from 'nue-ui'
import validator from 'validator'

defineOptions({ name: 'UpdatePasswordDialog' })

const userStore = useUserStore()

const visible = ref(false)
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const matchPattern = /^\S*(?=\S{8})(?=\S*\d)(?=\S*[a-z])(?=\S*[!@#$%^&*?.])\S*$/

const handleHideDialog = () => {
    password.value = confirmPassword.value = ''
    visible.value = false
}

const handleUpdatePassword = async () => {
    // console.log('[UpdatePasswordDialog]', password.value, confirmPassword.value)
    if (password.value.length < 8 || password.value.length > 24) {
        NueMessage.warn('密码格式有误，需要 8 至 24 位的长度')
        return
    }
    if (!validator.matches(password.value, matchPattern)) {
        NueMessage.warn('密码格式有误，需要包含字母、数字以及特殊符号')
        return
    }
    if (!validator.equals(password.value, confirmPassword.value)) {
        NueMessage.warn('两次输入的密码不一致')
        return
    }
    const result = await userStore.updatePasswordWithConfirmation(confirmPassword.value)
    if (result) handleHideDialog()
}

defineExpose({
    show: () => (visible.value = true)
})
</script>
