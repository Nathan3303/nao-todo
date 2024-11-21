<template>
    <nue-div
        align="stretch"
        flex
        gap="24px"
        justify="center"
        vertical
        width="320px"
        @keydown.enter="handleSignUp"
    >
        <nue-div align="center" gap="4px" vertical>
            <nue-text size="24px" weight="bold">创建您的账户</nue-text>
            <nue-text align="center" color="grey" size="12px">
                在下面输入您的电子邮件和密码以创建账户
            </nue-text>
        </nue-div>
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
            <nue-input
                v-model="passwordConfirm"
                :disabled="loading"
                allow-show-password
                placeholder="确认密码"
                type="password"
            />
            <nue-input v-model="nickname" :disabled="loading" placeholder="昵称（可选）" />
            <nue-button :loading="loading" theme="primary" @click="handleSignUp">注册</nue-button>
        </nue-div>
        <!--        <nue-divider align="center">-->
        <!--            <nue-text color="grey" size="12px">或以其他方式注册</nue-text>-->
        <!--        </nue-divider>-->
        <!--        <nue-button icon="logo">NueUI</nue-button>-->
        <nue-text align="center" color="gray" size="12px">
            点击注册按钮后，即表示您同意我们站点的
            <nue-link>服务条款</nue-link>
            和
            <nue-link>隐私政策</nue-link>
            。
        </nue-text>
    </nue-div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { NueMessage } from 'nue-ui'
import type { SignupOptions } from '@nao-todo/types'

defineProps<{
    loading: boolean
}>()
const emit = defineEmits<{
    (event: 'submit', payload: SignupOptions): void
}>()

const email = ref('')
const password = ref('')
const passwordConfirm = ref('')
const nickname = ref('')

function handleSignUp() {
    if (email.value === '') {
        NueMessage.error('请输入邮箱')
        return
    }
    if (password.value === '') {
        NueMessage.error('请输入密码')
        return
    }
    if (passwordConfirm.value !== password.value) {
        NueMessage.error('两次输入的密码不一致')
        return
    }
    emit('submit', { email: email.value, password: password.value, nickname: nickname.value })
}
</script>
