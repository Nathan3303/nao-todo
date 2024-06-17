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
            <nue-text size="24px" weight="bold"> Create an Account </nue-text>
            <nue-text size="12px" color="grey" align="center">
                Enter your email and password below to create
            </nue-text>
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
            <nue-input
                v-model="passwordConfirm"
                placeholder="Confirm your password"
                type="password"
                :disabled="loading"
                allow-show-password
            ></nue-input>
            <nue-button theme="primary" @click="handleSignUp" :loading="loading">
                Sign Up
            </nue-button>
        </nue-div>
        <nue-divider align="center">
            <nue-text color="grey" size="12px">OR SIGN UP WITH</nue-text>
        </nue-divider>
        <nue-button icon="logo">NueUI</nue-button>
        <nue-text size="12px" color="gray" align="center">
            By clicking continue, you agree to our
            <nue-link>Terms of Service</nue-link> and <nue-link>Privacy Policy</nue-link>.
        </nue-text>
    </nue-div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { SubmitPayload } from '@/stores/use-user-token'
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
        NueMessage.error('Email is required')
        return
    }
    if (password.value === '') {
        NueMessage.error('Password is required')
        return
    }
    if (passwordConfirm.value !== password.value) {
        NueMessage.error('Passwords do not match')
        return
    }
    emit('submit', { email: email.value, password: password.value })
}
</script>
