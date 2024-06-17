<template>
    <nue-container class="authentication-view">
        <nue-main aside-width="45%">
            <template #aside>
                <nue-div vertical justify="space-between" flex>
                    <nue-div align="center">
                        <nue-text size="32px" color="white">NaoTodo</nue-text>
                    </nue-div>
                    <nue-text size="16px" color="white">
                        Lorem ipsum dolor sit amet consectetur adipisicing elit. Atque quod porro ex
                        fuga. Possimus sequi dolorem laborum? Eveniet, vero molestiae error ut quam
                        laborum, debitis cumque hic assumenda pariatur voluptatum!
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
import { AuthSignIn, AuthSignUp } from '@/layers'
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

function handleSubmit(payload: SubmitPayload) {
    loading.value = true
    if (isLogin.value) {
        userStore.login(payload).then(
            () => {
                NueMessage.success('Login successful')
                setTimeout(() => {
                    router.push('/')
                    loading.value = false
                }, 1000)
            },
            () => {
                NueMessage.error('Invalid username or password')
                loading.value = false
            }
        )
    } else {
        userStore.signup(payload).then(
            () => {
                NueMessage.success('Sign up successful')
                setTimeout(() => {
                    router.push('/authentication/login')
                    loading.value = false
                }, 1000)
            },
            () => {
                NueMessage.error('Username already exists')
                loading.value = false
            }
        )
    }
}
</script>
