<template>
    <nue-div
        vertical
        align="stretch"
        justify="center"
        flex
        width="320px"
        gap="24px"
        @keydown.enter="handleSignUp"
    >
        <nue-div vertical gap="4px" align="center">
            <nue-text size="24px" weight="bold"> 创建您的账户 </nue-text>
            <nue-text size="12px" color="grey" align="center">
                在下面输入您的电子邮件和密码以创建账户
            </nue-text>
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
            <nue-input
                v-model="passwordConfirm"
                placeholder="确认密码"
                type="password"
                :disabled="loading"
                allow-show-password
            ></nue-input>
            <nue-button theme="primary" @click="handleSignUp" :loading="loading"> 注册 </nue-button>
        </nue-div>
        <nue-divider align="center">
            <nue-text color="grey" size="12px">或以其他方式注册</nue-text>
        </nue-divider>
        <nue-button icon="logo">NueUI</nue-button>
        <nue-text size="12px" color="gray" align="center">
            点击注册按钮后，即表示您同意我们站点的
            <nue-link>服务条款</nue-link> 和 <nue-link>隐私政策</nue-link>。
        </nue-text>
    </nue-div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { SubmitPayload } from '@nao-todo/stores/use-user-store'
import { NueMessage } from 'nue-ui'

const props = defineProps<{ loading: boolean }>()
const emit = defineEmits<{
    (event: 'submit', payload: SubmitPayload): void
}>()

const email = ref('')
const password = ref('')
const passwordConfirm = ref('')

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
    emit('submit', { email: email.value, password: password.value })
}
</script>
