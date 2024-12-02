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
            <nue-tooltip
                content="格式要求为 8 至 24 位字母、数字以及特殊符号（特殊符号包括：! @ # $ % ^ & * ? . ）。"
                placement="right-start"
                size="small"
                theme="password-rule"
            >
                <nue-input
                    v-model="password"
                    :disabled="loading"
                    allow-show-password
                    placeholder="密码"
                    type="password"
                />
            </nue-tooltip>
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
import validator from 'validator'

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
const matchPattern = /^\S*(?=\S{8})(?=\S*\d)(?=\S*[a-z])(?=\S*[!@#$%^&*?.])\S*$/

function handleSignUp() {
    if (email.value === '') {
        NueMessage.error('请输入邮箱')
        return
    }
    if (password.value.length < 8 || password.value.length > 24) {
        NueMessage.error('密码格式有误，需要 8 至 24 位的长度')
        return
    }
    if (!validator.matches(password.value, matchPattern)) {
        NueMessage.error('密码格式有误，需要包含字母、数字以及特殊符号')
        return
    }
    if (!validator.equals(password.value, passwordConfirm.value)) {
        NueMessage.error('两次输入的密码不一致')
        return
    }
    emit('submit', { email: email.value, password: password.value, nickname: nickname.value })
}
</script>
