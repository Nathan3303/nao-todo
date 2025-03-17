<template>
    <nue-div
        align="stretch"
        flex
        gap="24px"
        justify="center"
        vertical
        width="320px"
        @keydown.enter="handleSignIn"
    >
        <nue-div align="center" gap="4px" vertical>
            <nue-text size="24px" weight="bold">登录到 NaoTodo</nue-text>
            <nue-text color="gray" size="12px">使用您的电子邮件和密码进行登录</nue-text>
        </nue-div>
        <form autocomplete="off" name="NaoTodoSignInForm">
            <nue-div align="stretch" vertical>
                <nue-input
                    v-model="email"
                    :disabled="loading"
                    placeholder="电子邮箱 (name@example.com)"
                    type="email"
                />
                <nue-input
                    v-model="password"
                    :disabled="loading"
                    allow-show-password
                    placeholder="密码"
                    type="password"
                />
                <nue-button :loading="loading" theme="primary" type="submit" @click="handleSignIn">
                    登录
                </nue-button>
            </nue-div>
        </form>
        <nue-text align="center" color="gray" size="12px">
            点击登录按钮并成功认证后，您可以在接下来的 7
            日期限内免密访问您的账户，直到您退出或在别处登录。
        </nue-text>
    </nue-div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { NueMessage } from 'nue-ui'
import type { SigninOptions } from '@nao-todo/types'

defineProps<{ loading: boolean }>()
const emit = defineEmits<{ (event: 'submit', payload: SigninOptions): void }>()

const email = ref('')
const password = ref('')

function handleSignIn(e: Event) {
    e.preventDefault()
    if (email.value === '') {
        NueMessage.error('请输入邮箱')
        return
    }
    if (password.value === '') {
        NueMessage.error('请输入密码')
        return
    }
    emit('submit', { email: email.value, password: password.value })
}
</script>
