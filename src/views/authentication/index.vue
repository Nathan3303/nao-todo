<template>
    <nue-container class="authentication-view">
        <nue-main aside-width="45%">
            <template #aside>
                <nue-div vertical justify="space-between" flex>
                    <nue-div align="center">
                        <nue-text size="32px" color="white">NaoTodo</nue-text>
                    </nue-div>
                    <nue-text size="16px" color="white">
                        使用专门为您量身定制的智能待办事项列表应用程序NaoTodo，
                        探索高效生活的新方式。无论是工作、学习还是日常生活，
                        NaoTodo都能帮助您轻松管理任务，提高生产力。
                        凭借其直观的界面和强大的功能，您可以毫不费力地添加、
                        编辑和跟踪任务、设置提醒，并且永远不会错过重要的细节。
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
import { useUserStore, type SubmitPayload } from '@/stores/use-user-store'
import { NueMessage } from 'nue-ui'
import { useRouter } from 'vue-router'
import './index.css'

const props = defineProps<{ operation?: string }>()

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)

const isLogin = computed(() => props.operation === 'login')
const switchButtonText = computed(() => (isLogin.value ? '注册' : '登录'))
const subView = computed(() => (isLogin.value ? AuthSignIn : AuthSignUp))
const switchRoute = computed(() =>
    isLogin.value ? '/authentication/signup' : '/authentication/login'
)

async function handleSubmit(payload: SubmitPayload) {
    loading.value = true
    if (isLogin.value) {
        try {
            const res = await userStore.login(payload)
            if (res.code === '20000') {
                router.push({ name: 'index' })
                setTimeout(() => {
                    NueMessage.success('登录成功')
                }, 256)
            } else {
                NueMessage.error(res.message)
                loading.value = false
            }
        } catch (e) {
            NueMessage.error('登录失败')
            requestIdleCallback(() => (loading.value = false))
        }
    } else {
        try {
            const res = await userStore.signup(payload)
            if (res.code === '20000') {
                router.push('/authentication/login')
                setTimeout(() => {
                    NueMessage.success('注册成功')
                    loading.value = false
                }, 256)
            } else {
                NueMessage.error(res.message)
                loading.value = false
            }
        } catch (e) {
            NueMessage.error(`注册失败, ${(e as Error).message}`)
            requestIdleCallback(() => (loading.value = false))
        }
    }
}
</script>
