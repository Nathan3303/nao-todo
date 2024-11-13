<template>
    <nue-div
        vertical
        align="stretch"
        justify="center"
        flex
        width="320px"
        gap="24px"
        @keydown.enter="handleSignIn"
    >
        <nue-div vertical gap="4px" align="center">
            <nue-text size="24px" weight="bold"> 登录到 NaoTodo </nue-text>
            <nue-text size="12px" color="grey"> 使用您的电子邮件和密码进行登录 </nue-text>
        </nue-div>
        <nue-div vertical align="stretch">
            <nue-input
                v-model="email"
                placeholder="电子邮箱 (name@example.com)"
                type="email"
                :disabled="loading"
            ></nue-input>
            <nue-input
                v-model="password"
                placeholder="密码"
                type="password"
                :disabled="loading"
                allow-show-password
            ></nue-input>
            <nue-button theme="primary" @click="handleSignIn" :loading="loading"> 登录 </nue-button>
        </nue-div>
        <nue-divider align="center">
            <nue-text color="grey" size="12px">或以其他方式登录</nue-text>
        </nue-divider>
        <nue-button icon="logo">NueUI</nue-button>
    </nue-div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { NueMessage } from 'nue-ui'
import type { SigninOptions } from '@nao-todo/types'

defineProps<{ loading: boolean }>()
const emit = defineEmits<{
    (event: 'submit', payload: SigninOptions): void
}>()

const email = ref('')
const password = ref('')

function handleSignIn() {
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
