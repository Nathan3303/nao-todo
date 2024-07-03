<template>
    <nue-container class="authentication-view">
        <nue-main aside-width="45%">
            <template #aside>
                <nue-div vertical justify="space-between" flex>
                    <nue-div align="center">
                        <nue-text size="32px" color="white">NaoTodo</nue-text>
                    </nue-div>
                    <nue-text size="16px" color="white">
                        Discover a new way to live efficiently with NaoTodo, the smart to-do list
                        app tailored just for you. Whether it's work, study, or daily life, NaoTodo
                        helps you easily manage tasks and boost productivity. With its intuitive
                        interface and powerful features, you can effortlessly add, edit, and track
                        tasks, set reminders, and never miss an important detail.
                    </nue-text>
                </nue-div>
            </template>
            <template #content>
                <nue-div vertical height="100%" align="center" gap="0px">
                    <nue-div align="center" justify="end" height="0px">
                        <nue-button @click="$router.push(switchRoute)">
                            {{ switchButtonText }}
                        </nue-button>
                    </nue-div>
                    <component :is="subView" @submit="handleSubmit" :loading="loading"></component>
                </nue-div>
            </template>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { AuthSignIn, AuthSignUp } from '@/layers/authentication'
import { useUserStore, type SubmitPayload } from '@/stores/use-user-token'
import { NueMessage } from 'nue-ui'
import { useRouter } from 'vue-router'
import './index.css'

const props = defineProps<{ operation?: string }>()

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)

const isLogin = computed(() => props.operation === 'login')
const switchButtonText = computed(() => (isLogin.value ? 'Sign Up' : 'Sign In'))
const subView = computed(() => (isLogin.value ? AuthSignIn : AuthSignUp))
const switchRoute = computed(() =>
    isLogin.value ? '/authentication/signup' : '/authentication/login'
)

async function handleSubmit(payload: SubmitPayload) {
    loading.value = true
    if (isLogin.value) {
        const res = await userStore.login(payload)
        if (res.code === '20000') {
            router.push({ name: 'index' })
            loading.value = false
            NueMessage.success('Login successful')
            // setTimeout(() => {}, 1000)
        } else {
            NueMessage.error(res.message)
            loading.value = false
        }
    } else {
        const res = await userStore.signup(payload)
        if (res.code === '20000') {
            router.push('/authentication/login')
            loading.value = false
            NueMessage.success('Sign up successful')
            // setTimeout(() => {}, 1000)
        } else {
            NueMessage.error(res.message)
            loading.value = false
        }
    }
}
</script>
