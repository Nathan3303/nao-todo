<template>
    <nue-div vertical align="stretch" justify="center" flex width="320px" gap="24px">
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
import { useRouter } from 'vue-router'
import { NueMessage } from 'nue-ui'

const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)

function handleSignIn() {
    loading.value = true
    NueMessage.success('login success')
    setTimeout(() => {
        router.push('/')
    }, 1000)
}
</script>
