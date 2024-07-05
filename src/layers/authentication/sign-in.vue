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
            <nue-text size="24px" weight="bold"> Login to NaoTodo </nue-text>
            <nue-text size="12px" color="grey"> Sign in with your email and password </nue-text>
        </nue-div>
        <nue-div vertical align="stretch">
            <nue-input
                v-model="email"
                placeholder="name@example.com"
                type="email"
                :disabled="loading"
            ></nue-input>
            <nue-input
                v-model="password"
                placeholder="Your password"
                type="password"
                :disabled="loading"
                allow-show-password
            ></nue-input>
            <nue-button theme="primary" @click="handleSignIn" :loading="loading"
                >Sign In</nue-button
            >
        </nue-div>
        <nue-divider align="center">
            <nue-text color="grey" size="12px">OR SIGN IN WITH</nue-text>
        </nue-divider>
        <nue-button icon="logo">NueUI</nue-button>
    </nue-div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { SubmitPayload } from '@/stores/use-user-store'
import { NueMessage } from 'nue-ui'

const props = defineProps<{ loading: boolean }>()
const emit = defineEmits<{
    (event: 'submit', payload: SubmitPayload): void
}>()

const email = ref('')
const password = ref('')

function handleSignIn() {
    if (email.value === '') {
        NueMessage.error('Please enter your email')
        return
    }
    if (password.value === '') {
        NueMessage.error('Please enter your password')
        return
    }
    emit('submit', { email: email.value, password: password.value })
}
</script>
